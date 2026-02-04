"""Cursor connection status and overview (team, usage, spend)."""

import logging
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

logger = logging.getLogger(__name__)

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
        overview["usage_summary"] = usage_data.get("data")

    return overview
