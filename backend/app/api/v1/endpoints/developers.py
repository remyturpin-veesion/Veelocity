"""Developer statistics API endpoints."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import get_db
from app.models.developer_linear_link import DeveloperLinearLink
from app.models.linear import LinearIssue
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


@router.get("/linear-assignees")
async def get_linear_assignees(db: AsyncSession = Depends(get_db)):
    """
    List distinct Linear assignee names (from synced issues) for dropdown in Team UI.
    """
    result = await db.execute(
        select(LinearIssue.assignee_name)
        .where(LinearIssue.assignee_name.isnot(None))
        .distinct()
        .order_by(LinearIssue.assignee_name)
    )
    names = [row[0] for row in result.all() if row[0]]
    return {"assignees": names}


@router.get("/linear-links")
async def get_linear_links(db: AsyncSession = Depends(get_db)):
    """
    List developer → Linear assignee links for the Team UI.
    """
    result = await db.execute(
        select(DeveloperLinearLink.developer_login, DeveloperLinearLink.linear_assignee_name)
    )
    links = [
        {"developer_login": row[0], "linear_assignee_name": row[1]}
        for row in result.all()
    ]
    return {"links": links}


class SetLinearAssigneeBody(BaseModel):
    """Body for setting or clearing the Linear assignee link."""

    linear_assignee_name: str | None = None


@router.put("/{login}/linear-assignee")
async def set_developer_linear_assignee(
    login: str,
    body: SetLinearAssigneeBody,
    db: AsyncSession = Depends(get_db),
):
    """
    Set or clear the Linear assignee link for a developer.
    Pass linear_assignee_name: null to remove the link.
    """
    if body.linear_assignee_name is None or body.linear_assignee_name.strip() == "":
        await db.execute(delete(DeveloperLinearLink).where(
            DeveloperLinearLink.developer_login == login
        ))
        await db.commit()
        return {"developer_login": login, "linear_assignee_name": None}
    name = body.linear_assignee_name.strip()
    stmt = pg_insert(DeveloperLinearLink).values(
        developer_login=login,
        linear_assignee_name=name,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["developer_login"],
        set_={"linear_assignee_name": name},
    )
    await db.execute(stmt)
    await db.commit()
    return {"developer_login": login, "linear_assignee_name": name}


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
