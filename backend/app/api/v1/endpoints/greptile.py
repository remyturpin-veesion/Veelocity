"""Greptile connection status and overview (indexed repos, status)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.github import Repository
from app.services.credentials import CredentialsService
from app.services.greptile_client import (
    get_repository,
    list_repositories,
    validate_api_key,
)
from app.services.sync_state import SyncStateService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/greptile", tags=["greptile"])


def _normalize_repo_info(raw: dict) -> dict:
    """Normalize a repo info dict from Greptile GET /repositories/{id} or list item."""
    return {
        "repository": raw.get("repository", ""),
        "remote": raw.get("remote", ""),
        "branch": raw.get("branch", ""),
        "private": raw.get("private"),
        "status": raw.get("status", ""),
        "files_processed": raw.get("filesProcessed", raw.get("files_processed")),
        "num_files": raw.get("numFiles", raw.get("num_files")),
        "sha": raw.get("sha"),
    }


@router.get("/status")
async def greptile_status(db: AsyncSession = Depends(get_db)):
    """Return whether Greptile is connected (API key set) and optionally validate it."""
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.greptile_api_key:
        return {"connected": False, "message": "No Greptile API key configured."}
    valid = await validate_api_key(creds.greptile_api_key)
    if not valid:
        return {
            "connected": True,
            "valid": False,
            "message": "API key may be invalid or expired. Check Settings.",
        }
    repos = await list_repositories(creds.greptile_api_key)
    count = len(repos) if repos is not None else 0
    return {
        "connected": True,
        "valid": True,
        "repos_count": count,
    }


@router.get("/overview")
async def greptile_overview(
    db: AsyncSession = Depends(get_db),
    repo_ids: list[int] | None = Query(None, description="Filter to these repository IDs (our DB ids)."),
):
    """
    Return Greptile overview: indexed repos count and list with status.
    Optional repo_ids filters to only repos matching our configured repositories.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.greptile_api_key:
        raise HTTPException(
            status_code=403,
            detail="Greptile not connected. Add your Greptile API key in Settings.",
        )

    key = creds.greptile_api_key
    overview: dict = {
        "repos_count": 0,
        "repositories": [],
        "repos_by_status": {},
        "repos_by_remote": {},
        "total_files_processed": 0,
        "total_num_files": 0,
        "indexing_complete_pct": None,
    }

    # Try list endpoint first
    repos_list = await list_repositories(key)
    if repos_list is None:
        raise HTTPException(
            status_code=502,
            detail="Greptile API error or invalid key.",
        )

    if repos_list:
        # We got a list from the API
        for r in repos_list:
            if isinstance(r, dict):
                info = _normalize_repo_info(r)
                overview["repositories"].append(info)
                status = (info.get("status") or "unknown") or "unknown"
                overview["repos_by_status"][status] = (
                    overview["repos_by_status"].get(status, 0) + 1
                )
                remote = (info.get("remote") or "unknown") or "unknown"
                overview["repos_by_remote"][remote] = (
                    overview["repos_by_remote"].get(remote, 0) + 1
                )
                fp = info.get("files_processed")
                nf = info.get("num_files")
                if fp is not None:
                    overview["total_files_processed"] += fp
                if nf is not None:
                    overview["total_num_files"] += nf
        overview["repos_count"] = len(overview["repositories"])
    else:
        # No list endpoint or empty; optionally check configured GitHub repos
        github_repos = (creds.github_repos or "").strip()
        if github_repos:
            for part in github_repos.split(","):
                part = part.strip()
                if not part or "/" not in part:
                    continue
                # Greptile repo id format: remote:branch:owner/repo
                repo_id = f"github:main:{part}"
                info_raw = await get_repository(key, repo_id)
                if info_raw:
                    info = _normalize_repo_info(info_raw)
                    overview["repositories"].append(info)
                    status = (info.get("status") or "unknown") or "unknown"
                    overview["repos_by_status"][status] = (
                        overview["repos_by_status"].get(status, 0) + 1
                    )
                    remote = (info.get("remote") or "unknown") or "unknown"
                    overview["repos_by_remote"][remote] = (
                        overview["repos_by_remote"].get(remote, 0) + 1
                    )
                    fp = info.get("files_processed")
                    nf = info.get("num_files")
                    if fp is not None:
                        overview["total_files_processed"] += fp
                    if nf is not None:
                        overview["total_num_files"] += nf
            overview["repos_count"] = len(overview["repositories"])

    # Optionally filter by repo_ids (match Greptile "repository" to our full_name)
    allowed_full_names: set[str] | None = None
    if repo_ids:
        result = await db.execute(
            select(Repository.full_name).where(Repository.id.in_(repo_ids))
        )
        allowed_full_names = {row[0] for row in result.scalars().all()}

    if allowed_full_names is not None and overview["repositories"]:
        filtered = [
            info
            for info in overview["repositories"]
            if (info.get("repository") or "").strip() in allowed_full_names
        ]
        overview["repositories"] = filtered
        overview["repos_count"] = len(filtered)
        overview["repos_by_status"] = {}
        overview["repos_by_remote"] = {}
        overview["total_files_processed"] = 0
        overview["total_num_files"] = 0
        for info in filtered:
            status = (info.get("status") or "unknown") or "unknown"
            overview["repos_by_status"][status] = (
                overview["repos_by_status"].get(status, 0) + 1
            )
            remote = (info.get("remote") or "unknown") or "unknown"
            overview["repos_by_remote"][remote] = (
                overview["repos_by_remote"].get(remote, 0) + 1
            )
            fp = info.get("files_processed")
            nf = info.get("num_files")
            if fp is not None:
                overview["total_files_processed"] += fp
            if nf is not None:
                overview["total_num_files"] += nf

    # Aggregate metrics
    total_fp = overview["total_files_processed"]
    total_nf = overview["total_num_files"]
    if total_nf and total_nf > 0:
        overview["indexing_complete_pct"] = round(
            100.0 * total_fp / total_nf, 1
        )

    # Record last "sync" for data coverage page
    sync_state = SyncStateService(db)
    await sync_state.update_last_sync("greptile")
    await db.commit()

    return overview
