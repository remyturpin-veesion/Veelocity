"""Sentry dashboard: overview and project list from synced database."""

import logging
from datetime import date, datetime, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.github import Repository
from app.models.sentry import SentryProject, SentryProjectSnapshot
from app.services.credentials import CredentialsService

_SENTRY_ENVIRONMENT = "production"

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sentry", tags=["sentry"])


def _slug_matches_repo(slug: str, full_name: str) -> bool:
    """True if Sentry project slug matches repo full_name (same logic as frontend)."""
    slug_l = (slug or "").lower()
    fn_l = (full_name or "").lower()
    repo_part = fn_l.split("/")[-1] if fn_l else ""
    return slug_l == repo_part or fn_l.endswith("/" + slug_l)


@router.get("/overview")
async def sentry_overview(
    db: AsyncSession = Depends(get_db),
    stats_period: str = Query(
        default="24h",
        description="Stats period: 24h or 7d (both are stored; ignored when reading from DB)",
    ),
    repo_ids: list[int] | None = Query(
        None, description="Filter to Sentry projects matching these repository IDs"
    ),
):
    """
    Return Sentry org-level totals and per-project metrics (events, open issues, top issues).
    Data is read from the database (synced periodically by the Sentry sync job).
    When repo_ids is provided, only projects whose slug matches a selected repo's full_name are included.
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

    result = await db.execute(
        select(SentryProject)
        .where(SentryProject.org_slug == org)
        .options(selectinload(SentryProject.issues))
        .order_by(SentryProject.slug)
    )
    all_projects = result.scalars().all()

    if repo_ids is not None:
        if len(repo_ids) == 0:
            projects = []
        else:
            repo_result = await db.execute(
                select(Repository.full_name).where(Repository.id.in_(repo_ids))
            )
            selected_full_names = {row[0] for row in repo_result.all() if row[0]}
            if selected_full_names:
                projects = [
                    p
                    for p in all_projects
                    if any(
                        _slug_matches_repo(p.slug or "", fn)
                        for fn in selected_full_names
                    )
                ]
            else:
                projects = []
    else:
        projects = all_projects

    org_events_24h = sum(p.events_24h for p in projects)
    org_events_7d = sum(p.events_7d for p in projects)
    org_open_total = sum(p.open_issues_count for p in projects)

    projects_list: list[dict[str, Any]] = []
    for p in projects:
        top_issues = [
            {
                "id": i.sentry_issue_id,
                "short_id": i.short_id or "",
                "title": i.title or "",
                "count": i.count,
                "last_seen": i.last_seen or "",
            }
            for i in sorted(p.issues or [], key=lambda x: x.count, reverse=True)
        ]
        projects_list.append(
            {
                "id": p.sentry_project_id,
                "slug": p.slug,
                "name": p.name or p.slug,
                "events_24h": p.events_24h,
                "events_7d": p.events_7d,
                "open_issues_count": p.open_issues_count,
                "top_issues": top_issues,
            }
        )

    return {
        "sentry_base_url": base,
        "org": org,
        "org_totals": {
            "events_24h": org_events_24h,
            "events_7d": org_events_7d,
            "open_issues_count": org_open_total,
        },
        "projects": projects_list,
    }


@router.get("/trends")
async def sentry_trends(db: AsyncSession = Depends(get_db)):
    """
    Return per-project Sentry metrics for the current period and past 3 weeks.
    Uses stored daily snapshots when available, and backfills missing windows
    by querying the Sentry API with date-range parameters.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.sentry_api_token or not creds.sentry_org:
        raise HTTPException(
            status_code=400,
            detail="Sentry not configured. Add API token and org in Settings.",
        )
    base = (creds.sentry_base_url or "").strip() or "https://sentry.tooling.veesion.io"
    org = (creds.sentry_org or "").strip()
    token = creds.sentry_api_token

    # Load all projects
    result = await db.execute(
        select(SentryProject)
        .where(SentryProject.org_slug == org)
        .order_by(SentryProject.slug)
    )
    all_projects = list(result.scalars().all())
    if not all_projects:
        return {"sentry_base_url": base, "org": org, "projects": []}

    today = date.today()
    # Each target is the "end date" of its weekly window (7, 14, 21 days ago).
    # The window covers target-7d → target.
    week_targets = [today - timedelta(days=7 * i) for i in range(1, 4)]

    # Load all existing snapshots for all projects in one query
    project_ids = [p.id for p in all_projects]
    snap_result = await db.execute(
        select(SentryProjectSnapshot).where(
            SentryProjectSnapshot.project_id.in_(project_ids),
            SentryProjectSnapshot.snapshot_date >= today - timedelta(days=35),
        )
    )
    all_snaps = snap_result.scalars().all()

    # Index: project_id → {snapshot_date → snapshot}
    snaps_index: dict[int, dict[date, SentryProjectSnapshot]] = {}
    for s in all_snaps:
        snaps_index.setdefault(s.project_id, {})[s.snapshot_date] = s

    project_by_sentry_id = {p.sentry_project_id: p for p in all_projects}

    # --- Backfill missing weekly windows from Sentry API ---
    # Fetch one org-level call per window (returns all projects at once).
    now_dt = datetime.utcnow()
    for target in week_targets:
        # Check if any project is missing a snapshot for this window
        needs_backfill = any(
            not any(abs((d - target).days) <= 3 for d in snaps_index.get(p.id, {}))
            for p in all_projects
        )
        if not needs_backfill:
            continue

        window_end = target
        window_start = target - timedelta(days=7)
        try:
            async with httpx.AsyncClient(
                base_url=base.rstrip("/"),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                timeout=20.0,
            ) as client:
                r = await client.get(
                    f"/api/0/organizations/{org}/stats-summary/",
                    params={
                        "start": window_start.isoformat() + "T00:00:00Z",
                        "end": window_end.isoformat() + "T23:59:59Z",
                        "field": "sum(quantity)",
                        "category": "error",
                        "environment": _SENTRY_ENVIRONMENT,
                    },
                )
            if r.status_code != 200:
                logger.debug(
                    "Sentry trends backfill %s→%s: HTTP %s",
                    window_start,
                    window_end,
                    r.status_code,
                )
                continue

            data = r.json()
            if not isinstance(data, dict):
                continue

            for proj in data.get("projects") or []:
                pid = str(proj.get("id", ""))
                project = project_by_sentry_id.get(pid)
                if not project:
                    continue
                total = 0
                for stat in proj.get("stats") or []:
                    if isinstance(stat, dict) and stat.get("category") == "error":
                        total = (stat.get("totals") or {}).get("sum(quantity)", 0) or 0
                        break

                # Upsert snapshot (don't overwrite open_issues_count if already set)
                snap_stmt = pg_insert(SentryProjectSnapshot).values(
                    project_id=project.id,
                    snapshot_date=target,
                    events_24h=0,
                    events_7d=total,
                    open_issues_count=0,
                    created_at=now_dt,
                )
                snap_stmt = snap_stmt.on_conflict_do_update(
                    constraint="uq_sentry_snapshot_project_date",
                    set_={"events_7d": snap_stmt.excluded.events_7d},
                )
                await db.execute(snap_stmt)

                # Update in-memory index
                snaps_index.setdefault(project.id, {})[target] = SentryProjectSnapshot(
                    project_id=project.id,
                    snapshot_date=target,
                    events_24h=0,
                    events_7d=total,
                    open_issues_count=0,
                    created_at=now_dt,
                )

            await db.flush()
            logger.info(
                "Sentry trends: backfilled window %s→%s", window_start, window_end
            )
        except Exception as e:
            logger.debug("Sentry trends backfill error for %s: %s", target, e)

    # --- Build response ---
    def _closest_snap(
        proj_snaps: dict[date, SentryProjectSnapshot], target: date
    ) -> dict[str, Any] | None:
        for delta in range(0, 4):
            for candidate in (
                target - timedelta(days=delta),
                target + timedelta(days=delta),
            ):
                if candidate in proj_snaps:
                    s = proj_snaps[candidate]
                    snap_date = s.snapshot_date
                    return {
                        "events_24h": s.events_24h,
                        "events_7d": s.events_7d,
                        "open_issues_count": s.open_issues_count,
                        "snapshot_date": (
                            snap_date.isoformat()
                            if hasattr(snap_date, "isoformat")
                            else str(snap_date)
                        ),
                    }
        return None

    projects_out: list[dict[str, Any]] = []
    for p in all_projects:
        proj_snaps = snaps_index.get(p.id, {})
        weeks = [_closest_snap(proj_snaps, t) for t in week_targets]

        current = {
            "events_24h": p.events_24h,
            "events_7d": p.events_7d,
            "open_issues_count": p.open_issues_count,
            "synced_at": p.synced_at.isoformat() if p.synced_at else None,
        }

        # Trend: compare current events_7d vs 1-week-ago events_7d
        trend_direction = "insufficient_data"
        trend_pct: float | None = None
        prev = weeks[0]
        if prev is not None:
            prev_val = prev["events_7d"]
            curr_val = p.events_7d
            if prev_val > 0:
                pct = (curr_val - prev_val) / prev_val * 100
                trend_pct = round(pct, 1)
                trend_direction = (
                    "improving" if pct < -5 else ("degrading" if pct > 5 else "stable")
                )
            elif curr_val == 0:
                trend_direction = "stable"
                trend_pct = 0.0

        projects_out.append(
            {
                "id": p.sentry_project_id,
                "slug": p.slug,
                "name": p.name or p.slug,
                "current": current,
                "weeks": weeks,
                "trend_direction": trend_direction,
                "trend_pct": trend_pct,
            }
        )

    return {"sentry_base_url": base, "org": org, "projects": projects_out}


@router.get("/projects")
async def sentry_projects(db: AsyncSession = Depends(get_db)):
    """Return list of Sentry projects from the database (synced periodically)."""
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.sentry_api_token or not creds.sentry_org:
        raise HTTPException(
            status_code=400,
            detail="Sentry not configured. Add API token and org in Settings.",
        )
    org = (creds.sentry_org or "").strip()
    result = await db.execute(
        select(SentryProject)
        .where(SentryProject.org_slug == org)
        .order_by(SentryProject.slug)
    )
    projects = result.scalars().all()
    return {
        "items": [
            {
                "id": p.sentry_project_id,
                "slug": p.slug,
                "name": p.name or p.slug,
            }
            for p in projects
        ]
    }
