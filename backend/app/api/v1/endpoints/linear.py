"""Linear API endpoints."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.linear import LinearIssue, LinearTeam
from app.schemas.pagination import (
    PaginatedResponse,
    PaginationParams,
    get_pagination_params,
)

router = APIRouter(prefix="/linear", tags=["linear"])


@router.get("/teams", response_model=PaginatedResponse[dict[str, Any]])
async def get_teams(
    pagination: PaginationParams = Depends(get_pagination_params),
    db: AsyncSession = Depends(get_db),
):
    """List all Linear teams."""
    count_result = await db.execute(select(func.count(LinearTeam.id)))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(LinearTeam)
        .order_by(LinearTeam.name)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    teams = result.scalars().all()

    items = [
        {
            "id": team.id,
            "linear_id": team.linear_id,
            "name": team.name,
            "key": team.key,
        }
        for team in teams
    ]
    return PaginatedResponse.create(items, total, pagination)


@router.get("/issues", response_model=PaginatedResponse[dict[str, Any]])
async def get_issues(
    team_id: int | None = None,
    state: str | None = None,
    linked: bool | None = None,
    pagination: PaginationParams = Depends(get_pagination_params),
    db: AsyncSession = Depends(get_db),
):
    """
    List Linear issues with optional filters.
    
    - team_id: Filter by team
    - state: Filter by state (e.g., "Done", "In Progress")
    - linked: Filter by PR link status (true=linked, false=not linked)
    """
    query = select(LinearIssue)
    count_query = select(func.count(LinearIssue.id))

    if team_id is not None:
        query = query.where(LinearIssue.team_id == team_id)
        count_query = count_query.where(LinearIssue.team_id == team_id)

    if state is not None:
        query = query.where(LinearIssue.state == state)
        count_query = count_query.where(LinearIssue.state == state)

    if linked is not None:
        if linked:
            query = query.where(LinearIssue.linked_pr_id.isnot(None))
            count_query = count_query.where(LinearIssue.linked_pr_id.isnot(None))
        else:
            query = query.where(LinearIssue.linked_pr_id.is_(None))
            count_query = count_query.where(LinearIssue.linked_pr_id.is_(None))

    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    result = await db.execute(
        query.order_by(LinearIssue.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    issues = result.scalars().all()

    items = [
        {
            "id": issue.id,
            "linear_id": issue.linear_id,
            "identifier": issue.identifier,
            "title": issue.title,
            "state": issue.state,
            "priority": issue.priority,
            "assignee_name": issue.assignee_name,
            "created_at": issue.created_at,
            "started_at": issue.started_at,
            "completed_at": issue.completed_at,
            "linked_pr_id": issue.linked_pr_id,
        }
        for issue in issues
    ]
    return PaginatedResponse.create(items, total, pagination)
