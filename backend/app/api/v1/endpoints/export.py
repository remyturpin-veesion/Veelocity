"""Export report API endpoints."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.export_report import build_report, report_to_csv

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/report")
async def export_report(
    format: str = Query("json", pattern="^(json|csv)$"),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    repo_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Export a metrics report in JSON or CSV format."""
    if end_date is None:
        end_date = datetime.utcnow()
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    report = await build_report(db, start_date, end_date, repo_id=repo_id)

    if format == "csv":
        csv_content = report_to_csv(report)
        filename = f"veelocity_report_{start_date.date()}_{end_date.date()}.csv"
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    return JSONResponse(content=report)
