"""Developer statistics API endpoints."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.metrics.developers import DeveloperStatsService

router = APIRouter(prefix="/developers", tags=["developers"])


def get_default_date_range() -> tuple[datetime, datetime]:
    """Default to last 30 days."""
    end = datetime.utcnow()
    start = end - timedelta(days=30)
    return start, end


@router.get("")
async def get_developers(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    List all developers with basic contribution stats.

    Returns developers sorted by total contributions (PRs + reviews).
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DeveloperStatsService(db)
    developers = await service.get_all_developers(start_date, end_date, repo_id)

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "count": len(developers),
        "developers": developers,
    }


@router.get("/leaderboard")
async def get_leaderboard(
    metric: Literal[
        "prs_created", "prs_merged", "reviews_given", "comments_made", "commits"
    ] = "prs_merged",
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Get developers ranked by a specific metric.

    Metrics:
    - prs_created: Number of PRs opened
    - prs_merged: Number of PRs merged
    - reviews_given: Number of code reviews
    - comments_made: Number of PR comments
    - commits: Number of commits
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DeveloperStatsService(db)
    leaderboard = await service.get_leaderboard(
        metric, start_date, end_date, repo_id, limit
    )

    return {
        "metric": metric,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "leaderboard": leaderboard,
    }


@router.get("/{login}")
async def get_developer_stats(
    login: str,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed statistics for a specific developer.

    Returns:
    - PRs created, merged, open
    - Lines added/deleted
    - Average PR size and merge time
    - Reviews given
    - Comments made
    - Commits made
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DeveloperStatsService(db)
    stats = await service.get_developer_stats(login, start_date, end_date, repo_id)

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        **stats,
    }
