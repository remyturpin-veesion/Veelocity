"""Greptile connection status, overview (indexed repos), and usage metrics."""

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.github import PRComment, PRReview, Repository
from app.models.greptile import GreptileRepository
from app.services.credentials import CredentialsService
from app.services.greptile_client import list_repositories, validate_api_key
from app.services.metrics.greptile import GreptileMetricsService

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
    repos = await list_repositories(creds.greptile_api_key, github_token=creds.github_token)
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


@router.get("/metrics")
async def greptile_metrics(
    db: AsyncSession = Depends(get_db),
    start_date: str | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="End date (YYYY-MM-DD)"),
    repo_ids: list[int] | None = Query(None, description="Filter to these repository IDs"),
):
    """
    Return Greptile usage metrics: review coverage, response time, comments per PR,
    index health, per-repo breakdown, weekly trend, and recommendations.

    Cross-references GitHub PR review/comment data with Greptile index status.
    """
    now = datetime.utcnow()
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
    else:
        start_dt = now - timedelta(days=30)
    if end_date:
        end_dt = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59)
    else:
        end_dt = now

    service = GreptileMetricsService(db)
    return await service.get_metrics(start_dt, end_dt, repo_ids)


@router.get("/debug/bot-reviewers")
async def greptile_debug_bot_reviewers(db: AsyncSession = Depends(get_db)):
    """
    Diagnostic: list all distinct reviewer logins that look like bots,
    so the user can identify the correct Greptile bot username.
    Also shows the currently configured bot login.
    """
    from app.core.config import settings

    # All distinct reviewer logins containing 'bot' or 'greptile' (case-insensitive)
    reviewer_q = (
        select(
            PRReview.reviewer_login,
            func.count(PRReview.id).label("review_count"),
        )
        .where(
            PRReview.reviewer_login.ilike("%bot%")
            | PRReview.reviewer_login.ilike("%greptile%")
        )
        .group_by(PRReview.reviewer_login)
        .order_by(func.count(PRReview.id).desc())
    )
    reviewer_result = await db.execute(reviewer_q)
    reviewers = [
        {"login": row.reviewer_login, "reviews": row.review_count}
        for row in reviewer_result.all()
    ]

    # Same for comment authors
    commenter_q = (
        select(
            PRComment.author_login,
            func.count(PRComment.id).label("comment_count"),
        )
        .where(
            PRComment.author_login.ilike("%bot%")
            | PRComment.author_login.ilike("%greptile%")
        )
        .group_by(PRComment.author_login)
        .order_by(func.count(PRComment.id).desc())
    )
    commenter_result = await db.execute(commenter_q)
    commenters = [
        {"login": row.author_login, "comments": row.comment_count}
        for row in commenter_result.all()
    ]

    return {
        "configured_bot_login": settings.greptile_bot_login,
        "bot_reviewers_found": reviewers,
        "bot_commenters_found": commenters,
        "hint": (
            "If Greptile appears under a different login than the configured one, "
            "set GREPTILE_BOT_LOGIN in your .env to match."
        ),
    }
