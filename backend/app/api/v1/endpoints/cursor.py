"""Cursor connection status and overview (team, usage, spend)."""

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.credentials import CredentialsService
from app.services.cursor_client import (
    get_analytics_dau,
    get_daily_usage,
    get_spend,
    get_team_members,
)
from app.services.sync_state import SyncStateService

logger = logging.getLogger(__name__)

def _get_num(record: dict, *keys: str) -> int:
    """Get first present numeric value from record (supports camelCase/snake_case)."""
    for k in keys:
        v = record.get(k)
        if v is not None and isinstance(v, (int, float)):
            return int(v)
    return 0


def _get_date(record: dict) -> str | None:
    """Extract date string from record (date, day, or timestamp)."""
    date_val = record.get("date") or record.get("day")
    if isinstance(date_val, str) and len(date_val) >= 10:
        return date_val[:10]
    if isinstance(date_val, (int, float)):
        try:
            dt = datetime.fromtimestamp(date_val / 1000 if date_val > 1e12 else date_val, tz=timezone.utc)
            return dt.date().isoformat()
        except (OSError, ValueError):
            pass
    return None


def _aggregate_usage_data(raw_data: list) -> tuple[list[dict], dict]:
    """
    Aggregate raw daily-usage records by date. Returns (usage_by_day, usage_totals).
    Handles per-user-per-day or per-day records; normalizes common field names.
    """
    by_date: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for record in raw_data:
        if not isinstance(record, dict):
            continue
        date_str = _get_date(record)
        if not date_str:
            continue
        row = by_date[date_str]
        row["lines_added"] += _get_num(record, "totalLinesAdded", "total_lines_added")
        row["lines_deleted"] += _get_num(
            record, "totalLinesDeleted", "totalLinesRemoved", "total_lines_deleted"
        )
        row["accepted_lines_added"] += _get_num(
            record, "acceptedLinesAdded", "accepted_lines_added"
        )
        row["accepted_lines_deleted"] += _get_num(
            record, "acceptedLinesDeleted", "accepted_lines_deleted"
        )
        row["composer_requests"] += _get_num(record, "composerRequests", "composer_requests")
        row["chat_requests"] += _get_num(record, "chatRequests", "chat_requests")
        row["agent_requests"] += _get_num(record, "agentRequests", "agent_requests")
        row["tabs_shown"] += _get_num(record, "totalTabsShown", "total_tabs_shown")
        row["tabs_accepted"] += _get_num(record, "totalTabsAccepted", "total_tabs_accepted")
        row["applies"] += _get_num(record, "totalApplies", "total_applies")
        row["accepts"] += _get_num(record, "totalAccepts", "total_accepts")
        row["rejects"] += _get_num(record, "totalRejects", "total_rejects")
        row["cmdk_usages"] += _get_num(record, "cmdkUsages", "cmdk_usages")
        row["bugbot_usages"] += _get_num(record, "bugbotUsages", "bugbot_usages")

    usage_by_day = [
        {"date": d, **dict(row)}
        for d, row in sorted(by_date.items())
    ]
    totals: dict[str, int] = defaultdict(int)
    for row in by_date.values():
        for k, v in row.items():
            totals[k] += v
    usage_totals = dict(totals)
    return usage_by_day, usage_totals

router = APIRouter(prefix="/cursor", tags=["cursor"])


@router.get("/status")
async def cursor_status(db: AsyncSession = Depends(get_db)):
    """Return whether Cursor is connected (API key set) and optionally validate it."""
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.cursor_api_key:
        return {"connected": False, "message": "No Cursor API key configured."}
    # Optional: quick validation by calling team members
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
async def cursor_overview(db: AsyncSession = Depends(get_db)):
    """
    Return homepage-relevant Cursor data: team size, DAU (if Enterprise),
    current cycle spend summary, recent usage.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.cursor_api_key:
        raise HTTPException(
            status_code=403,
            detail="Cursor not connected. Add your Cursor API key in Settings.",
        )

    key = creds.cursor_api_key
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

    # Team members (Admin API - all plans)
    members_data = await get_team_members(key)
    if members_data:
        team = members_data.get("teamMembers") or []
        overview["team_members_count"] = len(team)

    # Spend (Admin API)
    spend_data = await get_spend(key)
    if spend_data:
        total_cents = sum(
            m.get("spendCents") or 0
            for m in (spend_data.get("teamMemberSpend") or [])
        )
        overview["spend_cents"] = total_cents
        overview["spend_members"] = spend_data.get("totalMembers")

    # DAU (Analytics API - Enterprise only)
    end = datetime.now(timezone.utc).date()
    start = end - timedelta(days=6)
    start_str = start.isoformat()
    end_str = end.isoformat()
    dau_data = await get_analytics_dau(key, start_str, end_str)
    if dau_data and dau_data.get("data"):
        data = dau_data["data"]
        overview["dau"] = data
        overview["dau_period"] = {"start": start_str, "end": end_str}

    # Recent daily usage (Admin API) - last 7 days
    end_ts = int(datetime.now(timezone.utc).timestamp() * 1000)
    start_ts = int((datetime.now(timezone.utc) - timedelta(days=7)).timestamp() * 1000)
    usage_data = await get_daily_usage(key, start_ts, end_ts)
    if usage_data and usage_data.get("data"):
        raw = usage_data["data"]
        overview["usage_summary"] = raw
        if isinstance(raw, list):
            usage_by_day, usage_totals = _aggregate_usage_data(raw)
            overview["usage_by_day"] = usage_by_day
            overview["usage_totals"] = usage_totals

    # Record last "sync" (fetch) for data coverage page
    sync_state = SyncStateService(db)
    await sync_state.update_last_sync("cursor")
    await db.commit()

    return overview
