"""Sync Greptile API data into PostgreSQL (indexed repositories)."""

import logging

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.greptile import GreptileRepository
from app.services.credentials import CredentialsService
from app.services.greptile_client import get_repository, list_repositories
from app.services.sync_state import SyncStateService

logger = logging.getLogger(__name__)


def _normalize_repo(raw: dict) -> dict:
    """Normalize a repo dict from Greptile API."""
    repo_id = raw.get("id") or raw.get("repositoryId") or ""
    if isinstance(repo_id, dict):
        repo_id = str(repo_id.get("id", ""))
    repo_id = str(repo_id).strip()

    # Fallback: construct ID from remote:branch:repository if no explicit ID
    if not repo_id:
        remote = raw.get("remote", "") or ""
        branch = raw.get("branch", "") or ""
        repository = raw.get("repository", "") or ""
        if remote and branch and repository:
            repo_id = f"{remote}:{branch}:{repository}"
            logger.debug("Constructed Greptile repo ID: %s (no id/repositoryId in response)", repo_id)
        else:
            logger.warning("Greptile repo missing id and cannot construct one: %s", raw)

    return {
        "greptile_repo_id": repo_id or None,
        "repository": raw.get("repository", "") or "",
        "remote": raw.get("remote", "") or "",
        "branch": raw.get("branch", "") or "",
        "private": raw.get("private"),
        "status": raw.get("status", "") or "",
        "files_processed": raw.get("filesProcessed", raw.get("files_processed")),
        "num_files": raw.get("numFiles", raw.get("num_files")),
        "sha": raw.get("sha"),
    }


async def sync_greptile(db: AsyncSession, api_key: str) -> int:
    """
    Fetch Greptile API data and upsert into DB. Updates SyncState for "greptile".
    Uses list_repositories when available; also fetches configured GitHub repos individually
    since the list endpoint is undocumented and often returns incomplete results.
    Returns number of repositories upserted.
    """
    from datetime import datetime

    now = datetime.utcnow()
    items = 0

    # Resolve GitHub token (needed by Greptile API for private repos)
    creds = await CredentialsService(db).get_credentials()
    github_token = creds.github_token

    repos_to_upsert: list[dict] = []

    repos_list = await list_repositories(api_key, github_token=github_token)
    if repos_list is not None and len(repos_list) > 0:
        logger.info("Greptile API returned %d repos", len(repos_list))
        skipped = 0
        for r in repos_list:
            if not isinstance(r, dict):
                continue
            info = _normalize_repo(r)
            if info.get("greptile_repo_id"):
                repos_to_upsert.append(info)
            else:
                skipped += 1
                logger.warning("Greptile repo skipped (no ID): keys=%s, repository=%s", list(r.keys()), r.get("repository", "?"))
        if skipped:
            logger.warning("Greptile sync: %d repos skipped due to missing ID", skipped)

    # Also try to fetch configured GitHub repos individually if not already found.
    # The GET /repositories (list) endpoint is undocumented and often returns
    # incomplete results; the official GET /repositories/{id} is more reliable.
    found_repos = {(info.get("repository") or "").lower() for info in repos_to_upsert}
    github_repos = (creds.github_repos or "").strip()
    if github_repos:
        for part in github_repos.split(","):
            part = part.strip()
            if not part or "/" not in part:
                continue
            if part.lower() in found_repos:
                continue  # already in list
            # Try common default branches
            info_raw = None
            used_branch = None
            for branch in ("main", "master"):
                repo_id = f"github:{branch}:{part}"
                info_raw = await get_repository(api_key, repo_id, github_token=github_token)
                if info_raw:
                    used_branch = branch
                    break
            if info_raw:
                info = _normalize_repo(info_raw)
                info["greptile_repo_id"] = info.get("greptile_repo_id") or f"github:{used_branch}:{part}"
                repos_to_upsert.append(info)
                logger.info("Greptile: fetched %s individually on branch %s (not in list response)", part, used_branch)

    for info in repos_to_upsert:
        greptile_repo_id = info.get("greptile_repo_id")
        if not greptile_repo_id:
            continue
        stmt = pg_insert(GreptileRepository).values(
            greptile_repo_id=greptile_repo_id,
            repository=info.get("repository", "")[:512],
            remote=info.get("remote", "")[:255],
            branch=info.get("branch", "")[:255],
            private=info.get("private"),
            status=info.get("status", "")[:100],
            files_processed=info.get("files_processed"),
            num_files=info.get("num_files"),
            sha=info.get("sha"),
            synced_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["greptile_repo_id"],
            set_={
                GreptileRepository.repository: stmt.excluded.repository,
                GreptileRepository.remote: stmt.excluded.remote,
                GreptileRepository.branch: stmt.excluded.branch,
                GreptileRepository.private: stmt.excluded.private,
                GreptileRepository.status: stmt.excluded.status,
                GreptileRepository.files_processed: stmt.excluded.files_processed,
                GreptileRepository.num_files: stmt.excluded.num_files,
                GreptileRepository.sha: stmt.excluded.sha,
                GreptileRepository.synced_at: stmt.excluded.synced_at,
            },
        )
        await db.execute(stmt)
        items += 1

    await db.flush()
    sync_state = SyncStateService(db)
    await sync_state.update_last_sync("greptile", sync_at=now)
    await db.flush()
    logger.info("Greptile sync: %s repos", items)
    return items
