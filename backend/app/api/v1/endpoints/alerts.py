"""Alerts API endpoints."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.insights.alerts import AlertsService

router = APIRouter(prefix="/alerts", tags=["alerts"])


def get_default_date_range() -> tuple[datetime, datetime]:
    """Default to last 30 days."""
    end = datetime.utcnow()
    start = end - timedelta(days=30)
    return start, end


@router.get("")
async def get_alerts(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get active alerts for the given period.

    Evaluates fixed rules (deployment frequency, lead time, review time,
    throughput, reviewer bottleneck) and returns alerts when thresholds are crossed.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = AlertsService(db)
    alerts = await service.get_alerts(
        start_date=start_date,
        end_date=end_date,
        repo_id=repo_id,
    )

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "alerts": [a.to_dict() for a in alerts],
    }
