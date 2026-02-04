"""Greptile connection status and overview (indexed repos). Data is synced to DB."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.github import Repository
from app.models.greptile import GreptileRepository
from app.services.credentials import CredentialsService
from app.services.greptile_client import list_repositories, validate_api_key

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/greptile", tags=["greptile"])


def _repo_to_info(r: GreptileRepository) -> dict:
    """Build overview repo info from stored row."""
    return {
        "repository": r.repository or "",
        "remote": r.remote or "",
        "branch": r.branch or "",
        "private": r.private,
        "status": r.status or "",
        "files_processed": r.files_processed,
        "num_files": r.num_files,
        "sha": r.sha,
    }


@router.get("/status")
async def greptile_status(db: AsyncSession = Depends(get_db)):
    """Return whether Greptile is connected (API key set) and optionally validate it."""
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.greptile_api_key:
        return {"connected": False, "message": "No Greptile API key configured."}
    # Prefer count from DB (no API call)
    count_result = await db.execute(select(func.count(GreptileRepository.id)))
    stored_count = count_result.scalar() or 0
    if stored_count > 0:
        return {
            "connected": True,
            "valid": True,
            "repos_count": stored_count,
        }
    # No data in DB yet: validate with API
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
    repo_ids: list[int] | None = Query(
        None, description="Filter to these repository IDs (our DB ids)."
    ),
):
    """
    Return Greptile overview from DB: indexed repos count and list with status.
    Data is synced by the scheduler. Optional repo_ids filters to our repositories.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.greptile_api_key:
        raise HTTPException(
            status_code=403,
            detail="Greptile not connected. Add your Greptile API key in Settings.",
        )

    overview: dict = {
        "repos_count": 0,
        "repositories": [],
        "repos_by_status": {},
        "repos_by_remote": {},
        "total_files_processed": 0,
        "total_num_files": 0,
        "indexing_complete_pct": None,
    }

    result = await db.execute(
        select(GreptileRepository).order_by(GreptileRepository.repository)
    )
    rows = result.scalars().all()

    allowed_full_names: set[str] | None = None
    if repo_ids:
        names_result = await db.execute(
            select(Repository.full_name).where(Repository.id.in_(repo_ids))
        )
        allowed_full_names = {row[0] for row in names_result.scalars().all()}

    for r in rows:
        info = _repo_to_info(r)
        if allowed_full_names is not None and (info.get("repository") or "").strip() not in allowed_full_names:
            continue
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
    total_fp = overview["total_files_processed"]
    total_nf = overview["total_num_files"]
    if total_nf and total_nf > 0:
        overview["indexing_complete_pct"] = round(100.0 * total_fp / total_nf, 1)

    return overview
