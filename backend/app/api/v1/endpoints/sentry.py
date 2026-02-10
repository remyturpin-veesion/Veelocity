"""Sentry dashboard: proxy to Sentry API for overview and project list. No data stored in DB."""

import logging
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.credentials import CredentialsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sentry", tags=["sentry"])

# In-memory cache: key (org, period) -> (payload, expiry_ts). TTL 5 min.
_sentry_overview_cache: dict[tuple[str, str], tuple[dict[str, Any], float]] = {}
_SENTRY_CACHE_TTL_SEC = 300
_MAX_PROJECTS = 20
_TOP_ISSUES_PER_PROJECT = 10


def _sentry_client(base: str, token: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=base.rstrip("/"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )


@router.get("/overview")
async def sentry_overview(
    db: AsyncSession = Depends(get_db),
    stats_period: str = Query(default="24h", description="Stats period: 24h or 7d"),
):
    """
    Return Sentry org-level totals and per-project metrics (events, open issues, top issues).
    Data is fetched from Sentry API on demand; optional 5-min cache.
    """
    if stats_period not in ("24h", "7d"):
        stats_period = "24h"
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.sentry_api_token or not creds.sentry_org:
        raise HTTPException(
            status_code=400,
            detail="Sentry not configured. Add API token and org in Settings.",
        )
    base = (creds.sentry_base_url or "").strip() or "https://sentry.tooling.veesion.io"
    org = (creds.sentry_org or "").strip()
    cache_key = (org, stats_period)  # cache by org + period for consistency
    now = time.time()
    if cache_key in _sentry_overview_cache:
        payload, expiry = _sentry_overview_cache[cache_key]
        if now < expiry:
            return payload
        del _sentry_overview_cache[cache_key]

    try:
        async with _sentry_client(base, creds.sentry_api_token) as client:
            # List projects
            r_projects = await client.get(f"/api/0/organizations/{org}/projects/")
            if r_projects.status_code == 401:
                raise HTTPException(
                    status_code=502,
                    detail="Sentry API token is invalid or expired.",
                )
            if r_projects.status_code == 404:
                raise HTTPException(
                    status_code=502,
                    detail="Sentry organization not found.",
                )
            if r_projects.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail=f"Sentry API error: {r_projects.status_code}",
                )
            projects_raw = r_projects.json()
            if not isinstance(projects_raw, list):
                projects_raw = []

            # Stats summary for both 24h and 7d so one response has both
            events_24h_by_project: dict[str, int] = {}
            events_7d_by_project: dict[str, int] = {}
            for period in ("24h", "7d"):
                r_stats = await client.get(
                    f"/api/0/organizations/{org}/stats-summary/",
                    params={
                        "statsPeriod": period,
                        "field": "sum(quantity)",
                        "category": "error",
                    },
                )
                if r_stats.status_code == 200:
                    data = r_stats.json()
                    target = events_24h_by_project if period == "24h" else events_7d_by_project
                    for proj in data.get("projects") or []:
                        pid = str(proj.get("id", ""))
                        total = 0
                        for stat in proj.get("stats") or []:
                            if stat.get("category") == "error":
                                total = stat.get("totals", {}).get("sum(quantity)", 0) or 0
                                break
                        target[pid] = total

            # Build project list (id, slug, name); limit for issues calls
            projects_list: list[dict[str, Any]] = []
            for p in projects_raw[: _MAX_PROJECTS]:
                pid = str(p.get("id", ""))
                slug = (p.get("slug") or "").strip()
                name = (p.get("name") or slug or "").strip()
                projects_list.append(
                    {
                        "id": pid,
                        "slug": slug,
                        "name": name,
                        "events_24h": events_24h_by_project.get(pid, 0),
                        "events_7d": events_7d_by_project.get(pid, 0),
                        "open_issues_count": 0,
                        "top_issues": [],
                    }
                )

            # Fetch issues per project (unresolved, limit)
            org_open_total = 0
            for proj in projects_list:
                slug = proj["slug"]
                if not slug:
                    continue
                r_issues = await client.get(
                    f"/api/0/projects/{org}/{slug}/issues/",
                    params={"query": "is:unresolved", "limit": _TOP_ISSUES_PER_PROJECT},
                )
                if r_issues.status_code != 200:
                    continue
                issues_raw = r_issues.json()
                if not isinstance(issues_raw, list):
                    continue
                top: list[dict[str, Any]] = []
                for iss in issues_raw:
                    count_val = iss.get("count") or iss.get("numComments")
                    if isinstance(count_val, str):
                        try:
                            count_val = int(count_val)
                        except ValueError:
                            count_val = 0
                    top.append(
                        {
                            "id": str(iss.get("id", "")),
                            "short_id": (iss.get("shortId") or "").strip(),
                            "title": (iss.get("metadata", {}) or {}).get("title") or (iss.get("title") or "").strip(),
                            "count": count_val or 0,
                            "last_seen": (iss.get("lastSeen") or "").strip(),
                        }
                    )
                proj["top_issues"] = top
                proj["open_issues_count"] = len(issues_raw)
                org_open_total += len(issues_raw)

            # Org totals: sum events from stats-summary; open issues sum
            org_events_24h = sum(events_24h_by_project.values())
            org_events_7d = sum(events_7d_by_project.values())

            payload = {
                "sentry_base_url": base,
                "org": org,
                "org_totals": {
                    "events_24h": org_events_24h,
                    "events_7d": org_events_7d,
                    "open_issues_count": org_open_total,
                },
                "projects": projects_list,
            }
            _sentry_overview_cache[cache_key] = (payload, now + _SENTRY_CACHE_TTL_SEC)
            return payload
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Sentry overview failed: %s", e)
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/projects")
async def sentry_projects(db: AsyncSession = Depends(get_db)):
    """Proxy Sentry list projects. Returns list of { id, slug, name }."""
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.sentry_api_token or not creds.sentry_org:
        raise HTTPException(
            status_code=400,
            detail="Sentry not configured. Add API token and org in Settings.",
        )
    base = (creds.sentry_base_url or "").strip() or "https://sentry.tooling.veesion.io"
    org = (creds.sentry_org or "").strip()
    try:
        async with _sentry_client(base, creds.sentry_api_token) as client:
            r = await client.get(f"/api/0/organizations/{org}/projects/")
            if r.status_code == 401:
                raise HTTPException(
                    status_code=502,
                    detail="Sentry API token is invalid or expired.",
                )
            if r.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Sentry API error: {r.status_code}")
            raw = r.json()
            if not isinstance(raw, list):
                return {"items": []}
            return {
                "items": [
                    {"id": str(p.get("id", "")), "slug": (p.get("slug") or "").strip(), "name": (p.get("name") or "").strip()}
                    for p in raw
                ]
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Sentry projects failed: %s", e)
        raise HTTPException(status_code=502, detail=str(e)) from e
