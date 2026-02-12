"""Sentry dashboard: overview and project list from synced database."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.github import Repository
from app.models.sentry import SentryProject
from app.services.credentials import CredentialsService

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
