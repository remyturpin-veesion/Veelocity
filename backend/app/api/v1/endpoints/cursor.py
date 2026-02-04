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
async def cursor_overview(
    db: AsyncSession = Depends(get_db),
    start_date: str | None = None,
    end_date: str | None = None,
):
    """
    Return homepage-relevant Cursor data: team size, DAU (if Enterprise),
    current cycle spend summary, usage in the given date range.
    Optional start_date/end_date (YYYY-MM-DD); default last 7 days.
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

    # Date range for DAU and usage (default last 7 days)
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
    # Cap to today so we never ask the API for future dates
    today_utc = datetime.now(timezone.utc).date()
    if end_dt > today_utc:
        end_dt = today_utc
    if start_dt > today_utc:
        start_dt = today_utc
    if start_dt > end_dt:
        start_dt = end_dt
    start_str = start_dt.isoformat()
    end_str = end_dt.isoformat()

    # DAU (Analytics API - Enterprise only)
    dau_data = await get_analytics_dau(key, start_str, end_str)
    if dau_data and dau_data.get("data"):
        data = dau_data["data"]
        overview["dau"] = data
        overview["dau_period"] = {"start": start_str, "end": end_str}

    # Daily usage (Admin API) for the selected date range.
    # Cursor API appears to return data only for a limited window (~7 days); chunk into
    # 7-day requests and merge results to support longer ranges.
    def _extract_usage_list(payload: dict | list | None) -> list[dict]:
        """Extract list of daily usage records from API response (handles multiple shapes)."""
        if payload is None:
            return []
        if isinstance(payload, list):
            return [r for r in payload if isinstance(r, dict)]
        if not isinstance(payload, dict):
            return []
        # Try common response shapes
        for key in ("data", "dailyUsage", "usage", "dailyUsageData", "records", "items"):
            val = payload.get(key)
            if isinstance(val, list):
                return [r for r in val if isinstance(r, dict)]
        # If "data" is an object, it might wrap the list
        data = payload.get("data")
        if isinstance(data, dict):
            for key in ("dailyUsage", "usage", "records", "items", "data"):
                val = data.get(key) if isinstance(data, dict) else None
                if isinstance(val, list):
                    return [r for r in val if isinstance(r, dict)]
        return []

    CHUNK_DAYS = 7
    raw_usage: list[dict] = []
    use_seconds = False  # Try seconds if first chunk returns empty (API format fallback)
    chunk_start = start_dt
    while chunk_start <= end_dt:
        chunk_end = min(
            chunk_start + timedelta(days=CHUNK_DAYS - 1),
            end_dt,
        )
        start_ts = int(
            datetime(
                chunk_start.year, chunk_start.month, chunk_start.day,
                0, 0, 0, tzinfo=timezone.utc,
            ).timestamp() * 1000
        )
        end_ts = int(
            datetime(
                chunk_end.year, chunk_end.month, chunk_end.day,
                23, 59, 59, tzinfo=timezone.utc,
            ).timestamp() * 1000
        )
        usage_data = await get_daily_usage(key, start_ts, end_ts, use_seconds=use_seconds)
        chunk_list = _extract_usage_list(usage_data)
        # If we got nothing and haven't tried seconds yet, retry this chunk with seconds
        if not chunk_list and not use_seconds and usage_data is not None:
            usage_data = await get_daily_usage(key, start_ts, end_ts, use_seconds=True)
            chunk_list = _extract_usage_list(usage_data)
            if chunk_list:
                use_seconds = True
        if usage_data and not chunk_list:
            # Log response shape to debug "no usage data" (API may use different structure)
            data_val = usage_data.get("data") if isinstance(usage_data, dict) else None
            logger.info(
                "Cursor daily-usage: keys=%s, data type=%s, len(data)=%s",
                list(usage_data.keys()) if isinstance(usage_data, dict) else "n/a",
                type(data_val).__name__ if data_val is not None else "missing",
                len(data_val) if isinstance(data_val, (list, dict)) else "n/a",
            )
        raw_usage.extend(chunk_list)
        chunk_start = chunk_end + timedelta(days=1)

    if raw_usage:
        overview["usage_summary"] = raw_usage
        usage_by_day, usage_totals = _aggregate_usage_data(raw_usage)
        overview["usage_by_day"] = usage_by_day
        overview["usage_totals"] = usage_totals

    # Record last "sync" (fetch) for data coverage page
    sync_state = SyncStateService(db)
    await sync_state.update_last_sync("cursor")
    await db.commit()

    return overview
