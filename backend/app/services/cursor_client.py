"""Cursor API client using stored API key (Basic Auth)."""

import base64
import logging
from typing import Any

import httpx

CURSOR_API_BASE = "https://api.cursor.com"

logger = logging.getLogger(__name__)


def _basic_auth_header(api_key: str) -> dict[str, str]:
    """Cursor uses Basic auth with API key as username, empty password."""
    raw = f"{api_key.strip()}:"
    encoded = base64.b64encode(raw.encode()).decode()
    return {"Authorization": f"Basic {encoded}"}


async def get_team_members(api_key: str) -> dict[str, Any] | None:
    """GET /teams/members - list team members. Returns None on auth/rate/error."""
    try:
        async with httpx.AsyncClient(
            base_url=CURSOR_API_BASE,
            headers={**_basic_auth_header(api_key), "Accept": "application/json"},
            timeout=15.0,
        ) as client:
            resp = await client.get("/teams/members")
            if resp.status_code == 401:
                logger.warning("Cursor API: invalid API key")
                return None
            if resp.status_code == 403:
                logger.warning("Cursor API: forbidden (e.g. not Enterprise)")
                return None
            if resp.status_code == 429:
                logger.warning("Cursor API: rate limited")
                return None
            if resp.status_code != 200:
                logger.warning("Cursor API members: %s %s", resp.status_code, resp.text[:200])
                return None
            return resp.json()
    except Exception as e:
        logger.exception("Cursor API request failed: %s", e)
        return None


async def get_daily_usage(
    api_key: str,
    start_date_ms: int,
    end_date_ms: int,
    *,
    use_seconds: bool = False,
) -> dict[str, Any] | None:
    """POST /teams/daily-usage-data - daily usage. Returns None on error.
    By default sends timestamps in milliseconds; set use_seconds=True to send seconds.
    """
    try:
        if use_seconds:
            start_val = start_date_ms // 1000
            end_val = end_date_ms // 1000
        else:
            start_val = start_date_ms
            end_val = end_date_ms
        async with httpx.AsyncClient(
            base_url=CURSOR_API_BASE,
            headers={
                **_basic_auth_header(api_key),
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=15.0,
        ) as client:
            resp = await client.post(
                "/teams/daily-usage-data",
                json={"startDate": start_val, "endDate": end_val},
            )
            if resp.status_code in (401, 403, 429):
                return None
            if resp.status_code != 200:
                logger.warning(
                    "Cursor API daily-usage: %s %s", resp.status_code, resp.text[:200]
                )
                return None
            return resp.json()
    except Exception as e:
        logger.exception("Cursor API daily-usage failed: %s", e)
        return None


async def get_spend(api_key: str) -> dict[str, Any] | None:
    """POST /teams/spend - current billing cycle spend. Returns None on error."""
    try:
        async with httpx.AsyncClient(
            base_url=CURSOR_API_BASE,
            headers={
                **_basic_auth_header(api_key),
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            timeout=15.0,
        ) as client:
            resp = await client.post(
                "/teams/spend",
                json={"page": 1, "pageSize": 5},
            )
            if resp.status_code in (401, 403, 429):
                return None
            if resp.status_code != 200:
                logger.warning("Cursor API spend: %s %s", resp.status_code, resp.text[:200])
                return None
            return resp.json()
    except Exception as e:
        logger.exception("Cursor API spend failed: %s", e)
        return None


async def get_analytics_dau(
    api_key: str, start_date: str, end_date: str
) -> dict[str, Any] | None:
    """GET /analytics/team/dau - daily active users (Enterprise). Returns None if not available."""
    try:
        async with httpx.AsyncClient(
            base_url=CURSOR_API_BASE,
            headers={**_basic_auth_header(api_key), "Accept": "application/json"},
            timeout=15.0,
        ) as client:
            resp = await client.get(
                "/analytics/team/dau",
                params={"startDate": start_date, "endDate": end_date},
            )
            if resp.status_code == 403:
                return None  # Analytics is Enterprise only
            if resp.status_code in (401, 429) or resp.status_code != 200:
                return None
            return resp.json()
    except Exception as e:
        logger.exception("Cursor Analytics DAU failed: %s", e)
        return None
