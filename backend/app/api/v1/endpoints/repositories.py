"""Repository API endpoints."""

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.github import Repository
from app.schemas.pagination import (
    PaginatedResponse,
    PaginationParams,
    get_pagination_params,
)

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.get("", response_model=PaginatedResponse[dict[str, Any]])
async def get_repositories(
    pagination: PaginationParams = Depends(get_pagination_params),
    db: AsyncSession = Depends(get_db),
):
    """List all synced repositories."""
    count_result = await db.execute(select(func.count(Repository.id)))
    total = count_result.scalar() or 0

    result = await db.execute(
        select(Repository)
        .order_by(Repository.full_name)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    repos = result.scalars().all()

    items = [
        {
            "id": repo.id,
            "github_id": repo.github_id,
            "name": repo.name,
            "full_name": repo.full_name,
            "default_branch": repo.default_branch,
        }
        for repo in repos
    ]
    return PaginatedResponse.create(items, total, pagination)
