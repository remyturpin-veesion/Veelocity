"""DORA and development metrics API endpoints."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.metrics.development import DevelopmentMetricsService
from app.services.metrics.dora import DORAMetricsService

router = APIRouter(prefix="/metrics", tags=["metrics"])


def get_default_date_range() -> tuple[datetime, datetime]:
    """Default to last 30 days."""
    end = datetime.utcnow()
    start = end - timedelta(days=30)
    return start, end


@router.get("/dora")
async def get_dora_metrics(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all DORA metrics.

    Query params:
    - start_date: Start of period (default: 30 days ago)
    - end_date: End of period (default: now)
    - period: Grouping period - day, week, or month (default: week)
    - repo_id: Optional repository filter
    - author_login: Optional developer filter (by GitHub login)
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)

    deployment_freq = await service.get_deployment_frequency(
        start_date, end_date, period, repo_id, author_login
    )
    lead_time = await service.get_lead_time_for_changes(
        start_date, end_date, repo_id, author_login
    )

    return {
        "deployment_frequency": deployment_freq,
        "lead_time_for_changes": lead_time,
    }


@router.get("/dora/deployment-frequency")
async def get_deployment_frequency(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get deployment frequency metric.

    Measures how often successful deployments occur.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)
    return await service.get_deployment_frequency(
        start_date, end_date, period, repo_id, author_login
    )


@router.get("/dora/lead-time")
async def get_lead_time(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get lead time for changes metric.

    Measures time from first commit to deployment.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)
    return await service.get_lead_time_for_changes(
        start_date, end_date, repo_id, author_login
    )


# ============================================================================
# Development Metrics
# ============================================================================


@router.get("/development")
async def get_development_metrics(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all development metrics.

    Includes PR review time, merge time, cycle time, and throughput.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DevelopmentMetricsService(db)

    pr_review_time = await service.get_pr_review_time(
        start_date, end_date, repo_id, author_login
    )
    pr_merge_time = await service.get_pr_merge_time(
        start_date, end_date, repo_id, author_login
    )
    cycle_time = await service.get_cycle_time(start_date, end_date)
    throughput = await service.get_throughput(
        start_date, end_date, period, repo_id, author_login
    )

    return {
        "pr_review_time": pr_review_time,
        "pr_merge_time": pr_merge_time,
        "cycle_time": cycle_time,
        "throughput": throughput,
    }


@router.get("/development/pr-review-time")
async def get_pr_review_time(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get PR review time metric.

    Measures time from PR opened to first review.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DevelopmentMetricsService(db)
    return await service.get_pr_review_time(
        start_date, end_date, repo_id, author_login
    )


@router.get("/development/pr-merge-time")
async def get_pr_merge_time(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get PR merge time metric.

    Measures time from PR opened to merged.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DevelopmentMetricsService(db)
    return await service.get_pr_merge_time(
        start_date, end_date, repo_id, author_login
    )


@router.get("/development/cycle-time")
async def get_cycle_time(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    team_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get cycle time metric.

    Measures time from issue started to linked PR merged.
    Requires Linear integration and PR-issue linking.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DevelopmentMetricsService(db)
    return await service.get_cycle_time(start_date, end_date, team_id)


@router.get("/development/throughput")
async def get_throughput(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get throughput metric.

    Measures count of PRs merged per period.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DevelopmentMetricsService(db)
    return await service.get_throughput(
        start_date, end_date, period, repo_id, author_login
    )
