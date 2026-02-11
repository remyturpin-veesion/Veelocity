"""Sync Sentry API data into PostgreSQL (projects, event counts, unresolved issues).

All data is filtered to the Production environment only.
"""

import logging
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sentry import SentryIssue, SentryProject
from app.services.sync_state import SyncStateService

logger = logging.getLogger(__name__)

# Only sync data from the Production environment
_SENTRY_ENVIRONMENT = "production"
_MAX_PROJECTS = 50
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


async def sync_sentry(
    db: AsyncSession,
    *,
    api_token: str,
    base_url: str,
    org_slug: str,
) -> int:
    """
    Fetch Sentry projects, event stats, and unresolved issues; upsert into DB.
    Returns number of projects synced.
    """
    now = datetime.utcnow()
    if not api_token or not org_slug:
        return 0

    base = (base_url or "").strip() or "https://sentry.tooling.veesion.io"
    org = org_slug.strip()
    projects_synced = 0

    try:
        async with _sentry_client(base, api_token) as client:
            # List projects
            r_projects = await client.get(f"/api/0/organizations/{org}/projects/")
            if r_projects.status_code in (401, 404) or r_projects.status_code != 200:
                logger.warning(
                    "Sentry projects list failed: %s",
                    r_projects.status_code,
                )
                return 0
            projects_raw = r_projects.json()
            if not isinstance(projects_raw, list):
                projects_raw = []

            # Stats for 24h and 7d (optional; don't fail sync if API format differs)
            events_24h_by_project: dict[str, int] = {}
            events_7d_by_project: dict[str, int] = {}
            for period in ("24h", "7d"):
                try:
                    r_stats = await client.get(
                        "/api/0/organizations/{org}/stats-summary/".format(
                            org=org
                        ),
                        params={
                            "statsPeriod": period,
                            "field": "sum(quantity)",
                            "category": "error",
                            "environment": _SENTRY_ENVIRONMENT,
                        },
                    )
                    if r_stats.status_code == 200:
                        data = r_stats.json()
                        if isinstance(data, dict):
                            target = (
                                events_24h_by_project
                                if period == "24h"
                                else events_7d_by_project
                            )
                            for proj in data.get("projects") or []:
                                if not isinstance(proj, dict):
                                    continue
                                pid = str(proj.get("id", ""))
                                total = 0
                                for stat in proj.get("stats") or []:
                                    if isinstance(
                                        stat, dict
                                    ) and stat.get("category") == "error":
                                        total = (
                                            (stat.get("totals") or {}).get(
                                                "sum(quantity)", 0
                                            )
                                            or 0
                                        )
                                        break
                                target[pid] = total
                except Exception as e:
                    logger.debug(
                        "Sentry stats-summary (%s) skipped: %s", period, e
                    )

            for p in projects_raw[:_MAX_PROJECTS]:
                pid = str(p.get("id", ""))
                slug = (p.get("slug") or "").strip()
                name = (p.get("name") or slug or "").strip()
                if not pid or not slug:
                    continue

                events_24h = events_24h_by_project.get(pid, 0)
                events_7d = events_7d_by_project.get(pid, 0)

                # Upsert project
                stmt = pg_insert(SentryProject).values(
                    sentry_project_id=pid,
                    org_slug=org,
                    slug=slug,
                    name=name[:512],
                    events_24h=events_24h,
                    events_7d=events_7d,
                    open_issues_count=0,
                    synced_at=now,
                )
                stmt = stmt.on_conflict_do_update(
                    index_elements=["org_slug", "sentry_project_id"],
                    set_={
                        "slug": stmt.excluded.slug,
                        "name": stmt.excluded.name,
                        "events_24h": stmt.excluded.events_24h,
                        "events_7d": stmt.excluded.events_7d,
                        "open_issues_count": stmt.excluded.open_issues_count,
                        "synced_at": stmt.excluded.synced_at,
                    },
                )
                await db.execute(stmt)
                await db.flush()

                # Resolve project id (our PK)
                result = await db.execute(
                    select(SentryProject.id).where(
                        SentryProject.org_slug == org,
                        SentryProject.sentry_project_id == pid,
                    )
                )
                project_id = result.scalar_one_or_none()
                if project_id is None:
                    continue

                # Fetch unresolved issues for this project (Production only)
                r_issues = await client.get(
                    f"/api/0/projects/{org}/{slug}/issues/",
                    params={
                        "query": f"environment:{_SENTRY_ENVIRONMENT} is:unresolved",
                        "limit": _TOP_ISSUES_PER_PROJECT,
                    },
                )
                open_count = 0
                if r_issues.status_code == 200:
                    issues_raw = r_issues.json()
                    if isinstance(issues_raw, list):
                        open_count = len(issues_raw)
                        # Replace issues for this project
                        await db.execute(
                            delete(SentryIssue).where(
                                SentryIssue.project_id == project_id
                            )
                        )
                        for iss in issues_raw:
                            count_val = iss.get("count") or iss.get(
                                "numComments"
                            )
                            if isinstance(count_val, str):
                                try:
                                    count_val = int(count_val)
                                except ValueError:
                                    count_val = 0
                            count_val = count_val or 0
                            title = (
                                (iss.get("metadata") or {}).get("title")
                                or (iss.get("title") or "").strip()
                            )
                            db.add(
                                SentryIssue(
                                    project_id=project_id,
                                    sentry_issue_id=str(iss.get("id", "")),
                                    short_id=(
                                        (iss.get("shortId") or "").strip()[:32]
                                    ),
                                    title=title[:65535] if title else "",
                                    count=count_val,
                                    last_seen=(
                                        (iss.get("lastSeen") or "").strip()[:64]
                                    ),
                                    synced_at=now,
                                )
                            )
                await db.execute(
                    update(SentryProject)
                    .where(SentryProject.id == project_id)
                    .values(open_issues_count=open_count)
                )
                projects_synced += 1
            # End for each project

        sync_state = SyncStateService(db)
        await sync_state.update_last_sync("sentry", sync_at=now)
        await db.flush()
        logger.info("Sentry sync: %s projects", projects_synced)
    except Exception as e:
        logger.exception("Sentry sync failed: %s", e)
        raise

    return projects_synced
