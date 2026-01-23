"""Pagination schemas and utilities with guard rails."""

from typing import Annotated, Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

from app.core.config import settings

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Validated pagination parameters with enforced limits."""

    page: int = 1
    limit: int = settings.pagination_default_limit

    @property
    def offset(self) -> int:
        """Calculate offset for SQL queries."""
        return (self.page - 1) * self.limit


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response with metadata."""

    items: list[T]
    total: int
    page: int
    limit: int
    pages: int
    has_next: bool
    has_prev: bool

    @classmethod
    def create(
        cls, items: list[T], total: int, params: PaginationParams
    ) -> "PaginatedResponse[T]":
        """Factory method to create paginated response."""
        pages = (total + params.limit - 1) // params.limit if params.limit > 0 else 0
        return cls(
            items=items,
            total=total,
            page=params.page,
            limit=params.limit,
            pages=pages,
            has_next=params.page < pages,
            has_prev=params.page > 1,
        )


def get_pagination_params(
    page: Annotated[int, Query(ge=1, description="Page number (1-indexed)")] = 1,
    limit: Annotated[
        int,
        Query(
            ge=1,
            le=settings.pagination_max_limit,
            description=f"Items per page (max {settings.pagination_max_limit})",
        ),
    ] = settings.pagination_default_limit,
) -> PaginationParams:
    """
    FastAPI dependency for pagination parameters.
    
    Enforces:
    - page >= 1
    - 1 <= limit <= MAX_LIMIT (guard rail)
    """
    return PaginationParams(page=page, limit=limit)
