"""Cursor connection status and overview (team, usage, spend). Data is synced to DB."""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.cursor import (
    CursorDau,
    CursorDailyUsage,
    CursorSpendSnapshot,
    CursorTeamMember,
)
from app.services.credentials import CredentialsService
from app.services.cursor_client import get_team_members

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cursor", tags=["cursor"])


@router.get("/status")
async def cursor_status(db: AsyncSession = Depends(get_db)):
    """Return whether Cursor is connected (API key set) and optionally validate it."""
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.cursor_api_key:
        return {"connected": False, "message": "No Cursor API key configured."}
    # Prefer count from DB (no API call)
    count_result = await db.execute(select(func.count(CursorTeamMember.id)))
    stored_count = (count_result.scalar() or 0) or 0
    if stored_count > 0:
        return {
            "connected": True,
            "valid": True,
            "team_members_count": stored_count,
        }
    # No data in DB yet: validate key with a quick API call
    members = await get_team_members(creds.cursor_api_key)
    if members is None:
        return {
            "connected": True,
            "valid": False,
            "message": "API key may be invalid or expired. Check Settings.",
        }
    return {
        "connected": True,
        "valid": True,
        "team_members_count": len(members.get("teamMembers") or []),
    }


@router.get("/overview")
async def cursor_overview(
    db: AsyncSession = Depends(get_db),
    start_date: str | None = None,
    end_date: str | None = None,
):
    """
    Return Cursor overview from DB: team size, DAU, spend, usage in the date range.
    Data is synced by the scheduler. Optional start_date/end_date (YYYY-MM-DD); default last 7 days.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.cursor_api_key:
        raise HTTPException(
            status_code=403,
            detail="Cursor not connected. Add your Cursor API key in Settings.",
        )

    overview: dict = {
        "team_members_count": 0,
        "dau": None,
        "dau_period": None,
        "spend_cents": None,
        "spend_members": None,
        "usage_summary": None,
        "usage_by_day": None,
        "usage_totals": None,
    }

    # Team members count from DB
    count_result = await db.execute(select(func.count(CursorTeamMember.id)))
    overview["team_members_count"] = count_result.scalar() or 0

    # Latest spend snapshot from DB
    spend_result = await db.execute(
        select(CursorSpendSnapshot)
        .order_by(CursorSpendSnapshot.synced_at.desc())
        .limit(1)
    )
    spend_row = spend_result.scalar_one_or_none()
    if spend_row:
        overview["spend_cents"] = spend_row.total_cents
        overview["spend_members"] = spend_row.total_members

    # Date range (default last 7 days)
    end_dt = datetime.now(timezone.utc).date()
    start_dt = end_dt - timedelta(days=6)
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00")).date()
        except (ValueError, TypeError):
            pass
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00")).date()
        except (ValueError, TypeError):
            pass
    if start_dt > end_dt:
        start_dt, end_dt = end_dt, start_dt
    today_utc = datetime.now(timezone.utc).date()
    if end_dt > today_utc:
        end_dt = today_utc
    if start_dt > today_utc:
        start_dt = today_utc
    if start_dt > end_dt:
        start_dt = end_dt
    start_str = start_dt.isoformat()
    end_str = end_dt.isoformat()
    overview["dau_period"] = {"start": start_str, "end": end_str}

    # DAU from DB (for API compatibility: list of { date, count } or raw)
    dau_result = await db.execute(
        select(CursorDau)
        .where(CursorDau.date >= start_dt, CursorDau.date <= end_dt)
        .order_by(CursorDau.date)
    )
    dau_rows = dau_result.scalars().all()
    if dau_rows:
        overview["dau"] = [
            {"date": r.date.isoformat(), "dau": r.dau_count, "count": r.dau_count}
            for r in dau_rows
        ]

    # Daily usage from DB
    usage_result = await db.execute(
        select(CursorDailyUsage)
        .where(
            CursorDailyUsage.date >= start_dt,
            CursorDailyUsage.date <= end_dt,
        )
        .order_by(CursorDailyUsage.date)
    )
    usage_rows = usage_result.scalars().all()
    if usage_rows:
        usage_by_day = [
            {
                "date": r.date.isoformat(),
                "lines_added": r.lines_added,
                "lines_deleted": r.lines_deleted,
                "accepted_lines_added": r.accepted_lines_added,
                "accepted_lines_deleted": r.accepted_lines_deleted,
                "composer_requests": r.composer_requests,
                "chat_requests": r.chat_requests,
                "agent_requests": r.agent_requests,
                "tabs_shown": r.tabs_shown,
                "tabs_accepted": r.tabs_accepted,
                "applies": r.applies,
                "accepts": r.accepts,
                "rejects": r.rejects,
                "cmdk_usages": r.cmdk_usages,
                "bugbot_usages": r.bugbot_usages,
            }
            for r in usage_rows
        ]
        overview["usage_summary"] = usage_by_day
        overview["usage_by_day"] = usage_by_day
        totals = {
            "lines_added": sum(r.lines_added for r in usage_rows),
            "lines_deleted": sum(r.lines_deleted for r in usage_rows),
            "accepted_lines_added": sum(r.accepted_lines_added for r in usage_rows),
            "accepted_lines_deleted": sum(r.accepted_lines_deleted for r in usage_rows),
            "composer_requests": sum(r.composer_requests for r in usage_rows),
            "chat_requests": sum(r.chat_requests for r in usage_rows),
            "agent_requests": sum(r.agent_requests for r in usage_rows),
            "tabs_shown": sum(r.tabs_shown for r in usage_rows),
            "tabs_accepted": sum(r.tabs_accepted for r in usage_rows),
            "applies": sum(r.applies for r in usage_rows),
            "accepts": sum(r.accepts for r in usage_rows),
            "rejects": sum(r.rejects for r in usage_rows),
            "cmdk_usages": sum(r.cmdk_usages for r in usage_rows),
            "bugbot_usages": sum(r.bugbot_usages for r in usage_rows),
        }
        overview["usage_totals"] = totals

    return overview
