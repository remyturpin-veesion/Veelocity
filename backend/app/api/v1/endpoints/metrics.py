"""DORA and development metrics API endpoints."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
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
    db: AsyncSession = Depends(get_db),
):
    """
    Get all DORA metrics.

    Query params:
    - start_date: Start of period (default: 30 days ago)
    - end_date: End of period (default: now)
    - period: Grouping period - day, week, or month (default: week)
    - repo_id: Optional repository filter
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)

    deployment_freq = await service.get_deployment_frequency(
        start_date, end_date, period, repo_id
    )
    lead_time = await service.get_lead_time_for_changes(start_date, end_date, repo_id)

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
    db: AsyncSession = Depends(get_db),
):
    """
    Get deployment frequency metric.

    Measures how often successful deployments occur.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)
    return await service.get_deployment_frequency(start_date, end_date, period, repo_id)


@router.get("/dora/lead-time")
async def get_lead_time(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get lead time for changes metric.

    Measures time from first commit to deployment.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)
    return await service.get_lead_time_for_changes(start_date, end_date, repo_id)
