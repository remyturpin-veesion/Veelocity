"""Export API endpoints."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.export_report import build_report, report_to_csv

router = APIRouter(prefix="/export", tags=["export"])


def get_default_date_range() -> tuple[datetime, datetime]:
    """Default to last 30 days."""
    end = datetime.utcnow()
    start = end - timedelta(days=30)
    return start, end


@router.get("/report")
async def export_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    format: Literal["json", "csv"] = "json",
    db: AsyncSession = Depends(get_db),
):
    """
    Export a metrics report for the given period.

    Aggregates DORA metrics, development metrics, deployment reliability,
    alerts, and recommendations. Use format=json for full structure or
    format=csv for a single summary row.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    report = await build_report(
        db,
        start_date=start_date,
        end_date=end_date,
        repo_id=repo_id,
    )

    if format == "csv":
        csv_content = report_to_csv(report)
        filename = f"veelocity-report-{start_date.date()}-to-{end_date.date()}.csv"
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            },
        )

    return report
