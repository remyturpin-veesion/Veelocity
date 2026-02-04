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
    return {
        "greptile_repo_id": str(repo_id).strip() or None,
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
    Uses list_repositories when available; otherwise fetches per repo from configured GitHub repos.
    Returns number of repositories upserted.
    """
    from datetime import datetime

    now = datetime.utcnow()
    items = 0

    repos_to_upsert: list[dict] = []

    repos_list = await list_repositories(api_key)
    if repos_list is not None and len(repos_list) > 0:
        for r in repos_list:
            if not isinstance(r, dict):
                continue
            info = _normalize_repo(r)
            if info.get("greptile_repo_id"):
                repos_to_upsert.append(info)
    else:
        # Fallback: fetch by configured GitHub repos (github:branch:owner/repo)
        creds = await CredentialsService(db).get_credentials()
        github_repos = (creds.github_repos or "").strip()
        if github_repos:
            for part in github_repos.split(","):
                part = part.strip()
                if not part or "/" not in part:
                    continue
                repo_id = f"github:main:{part}"
                info_raw = await get_repository(api_key, repo_id)
                if info_raw:
                    info = _normalize_repo(info_raw)
                    info["greptile_repo_id"] = repo_id
                    repos_to_upsert.append(info)

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
