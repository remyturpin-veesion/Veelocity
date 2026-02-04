"""Alerts API endpoints."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.services.insights.alerts import AlertsService
from app.services.insights.notifications import send_alert_notifications

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
    repo_ids: list[int] | None = Query(None),
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
        repo_ids=repo_ids,
    )

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "alerts": [a.to_dict() for a in alerts],
    }


@router.post("/notify")
async def notify_alerts(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Evaluate alerts for the period and send to configured webhooks/email.

    Uses same rules as GET /alerts. Only sends when there are active alerts.
    Webhook URLs (ALERT_WEBHOOK_URLS) and email (ALERT_EMAIL_TO + SMTP_*) are optional.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = AlertsService(db)
    alerts = await service.get_alerts(
        start_date=start_date,
        end_date=end_date,
        repo_id=repo_id,
        repo_ids=repo_ids,
    )

    webhook_urls = [
        u.strip()
        for u in (settings.alert_webhook_urls or "").split(",")
        if u.strip()
    ]
    email_configured = bool(
        (settings.alert_email_to or "").strip()
        and (settings.smtp_host or "").strip()
    )

    if not alerts:
        return {
            "notified": False,
            "alert_count": 0,
            "message": "No active alerts; nothing sent.",
            "webhook_count": len(webhook_urls),
            "email_configured": email_configured,
        }

    await send_alert_notifications(
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
        alerts=[a.to_dict() for a in alerts],
    )

    return {
        "notified": True,
        "alert_count": len(alerts),
        "webhook_count": len(webhook_urls),
        "email_configured": email_configured,
    }
