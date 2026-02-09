"""Greptile connection status, overview (indexed repos), and usage metrics."""

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.github import PRComment, PRReview, Repository
from app.models.greptile import GreptileRepository
from app.services.credentials import CredentialsService
from app.services.greptile_client import (
    get_repository,
    index_repository,
    list_repositories,
    validate_api_key,
)
from app.services.metrics.greptile import GreptileMetricsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/greptile", tags=["greptile"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class IndexRepoRequest(BaseModel):
    """Trigger indexing of a single repository."""

    repository: str  # owner/repo
    branch: str = "main"
    remote: str = "github"
    reload: bool = False


class IndexAllRequest(BaseModel):
    """Trigger indexing for all configured GitHub repos (or a subset)."""

    reload: bool = False  # re-index already indexed repos
    repos: list[str] | None = None  # optional subset (owner/repo); None = all configured


class RefreshRequest(BaseModel):
    """Refresh Greptile status for specific repos (or all)."""

    repos: list[str] | None = None  # optional subset; None = all known repos


def _repo_to_info(r: GreptileRepository) -> dict:
    """Build overview repo info from stored row."""
    return {
        "repository": r.repository or "",
        "remote": r.remote or "",
        "branch": r.branch or "",
        "private": r.private,
        "status": r.status or "",
        "files_processed": r.files_processed,
        "num_files": r.num_files,
        "sha": r.sha,
    }


@router.get("/status")
async def greptile_status(db: AsyncSession = Depends(get_db)):
    """Return whether Greptile is connected (API key set) and optionally validate it."""
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.greptile_api_key:
        return {"connected": False, "message": "No Greptile API key configured."}
    # Prefer count from DB (no API call)
    count_result = await db.execute(select(func.count(GreptileRepository.id)))
    stored_count = count_result.scalar() or 0
    if stored_count > 0:
        return {
            "connected": True,
            "valid": True,
            "repos_count": stored_count,
        }
    # No data in DB yet: validate with API
    valid = await validate_api_key(creds.greptile_api_key)
    if not valid:
        return {
            "connected": True,
            "valid": False,
            "message": "API key may be invalid or expired. Check Settings.",
        }
    repos = await list_repositories(
        creds.greptile_api_key, github_token=creds.github_token
    )
    count = len(repos) if repos is not None else 0
    return {
        "connected": True,
        "valid": True,
        "repos_count": count,
    }


@router.get("/overview")
async def greptile_overview(
    db: AsyncSession = Depends(get_db),
    repo_ids: list[int] | None = Query(
        None, description="Filter to these repository IDs (our DB ids)."
    ),
):
    """
    Return Greptile overview from DB: indexed repos count and list with status.
    Data is synced by the scheduler. Optional repo_ids filters to our repositories.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.greptile_api_key:
        raise HTTPException(
            status_code=403,
            detail="Greptile not connected. Add your Greptile API key in Settings.",
        )

    overview: dict = {
        "repos_count": 0,
        "repositories": [],
        "repos_by_status": {},
        "repos_by_remote": {},
        "total_files_processed": 0,
        "total_num_files": 0,
        "indexing_complete_pct": None,
    }

    result = await db.execute(
        select(GreptileRepository).order_by(GreptileRepository.repository)
    )
    rows = result.scalars().all()

    allowed_full_names: set[str] | None = None
    if repo_ids:
        names_result = await db.execute(
            select(Repository.full_name).where(Repository.id.in_(repo_ids))
        )
        allowed_full_names = {row[0] for row in names_result.scalars().all()}

    for r in rows:
        info = _repo_to_info(r)
        if (
            allowed_full_names is not None
            and (info.get("repository") or "").strip() not in allowed_full_names
        ):
            continue
        overview["repositories"].append(info)
        status = (info.get("status") or "unknown") or "unknown"
        overview["repos_by_status"][status] = (
            overview["repos_by_status"].get(status, 0) + 1
        )
        remote = (info.get("remote") or "unknown") or "unknown"
        overview["repos_by_remote"][remote] = (
            overview["repos_by_remote"].get(remote, 0) + 1
        )
        fp = info.get("files_processed")
        nf = info.get("num_files")
        if fp is not None:
            overview["total_files_processed"] += fp
        if nf is not None:
            overview["total_num_files"] += nf

    overview["repos_count"] = len(overview["repositories"])
    total_fp = overview["total_files_processed"]
    total_nf = overview["total_num_files"]
    if total_nf and total_nf > 0:
        overview["indexing_complete_pct"] = round(100.0 * total_fp / total_nf, 1)

    return overview


@router.get("/metrics")
async def greptile_metrics(
    db: AsyncSession = Depends(get_db),
    start_date: str | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="End date (YYYY-MM-DD)"),
    repo_ids: list[int] | None = Query(
        None, description="Filter to these repository IDs"
    ),
    granularity: str = Query("week", description="Trend granularity: 'day' or 'week'"),
):
    """
    Return Greptile usage metrics: review coverage, response time, comments per PR,
    index health, per-repo breakdown, trend (daily or weekly), and recommendations.

    Cross-references GitHub PR review/comment data with Greptile index status.
    """
    now = datetime.utcnow()
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
    else:
        start_dt = now - timedelta(days=30)
    if end_date:
        end_dt = datetime.fromisoformat(end_date).replace(hour=23, minute=59, second=59)
    else:
        end_dt = now

    if granularity not in ("day", "week"):
        granularity = "week"

    service = GreptileMetricsService(db)
    return await service.get_metrics(start_dt, end_dt, repo_ids, granularity)



# ---------------------------------------------------------------------------
# Repository management endpoints (semi-manual)
# ---------------------------------------------------------------------------


@router.get("/repos")
async def greptile_repos(db: AsyncSession = Depends(get_db)):
    """
    Combined view: all configured GitHub repos with their Greptile indexing status.
    Merges data from the Repository table (GitHub sync) and GreptileRepository table.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()

    # Fetch all GitHub repos from DB
    gh_result = await db.execute(
        select(Repository).order_by(Repository.full_name)
    )
    gh_repos = gh_result.scalars().all()

    # Fetch all Greptile repos from DB
    gr_result = await db.execute(
        select(GreptileRepository).order_by(GreptileRepository.repository)
    )
    gr_repos = gr_result.scalars().all()

    # Build lookup: lowercase repo name -> Greptile data
    gr_by_name: dict[str, GreptileRepository] = {}
    for gr in gr_repos:
        key = (gr.repository or "").lower().strip()
        if key:
            gr_by_name[key] = gr

    combined: list[dict] = []
    seen_names: set[str] = set()
    for repo in gh_repos:
        name = (repo.full_name or "").strip()
        key = name.lower()
        seen_names.add(key)
        gr = gr_by_name.get(key)
        combined.append({
            "repository": name,
            "github_repo_id": repo.id,
            "default_branch": repo.default_branch or "main",
            "greptile_status": gr.status if gr else None,
            "greptile_branch": gr.branch if gr else None,
            "files_processed": gr.files_processed if gr else None,
            "num_files": gr.num_files if gr else None,
            "sha": gr.sha if gr else None,
            "synced_at": gr.synced_at.isoformat() if gr and gr.synced_at else None,
            "is_indexed": gr is not None and gr.status in ("completed", "submitted"),
        })

    # Add Greptile repos not found in GitHub (extra indexed repos)
    for gr in gr_repos:
        key = (gr.repository or "").lower().strip()
        if key and key not in seen_names:
            combined.append({
                "repository": gr.repository or "",
                "github_repo_id": None,
                "default_branch": gr.branch or "main",
                "greptile_status": gr.status,
                "greptile_branch": gr.branch,
                "files_processed": gr.files_processed,
                "num_files": gr.num_files,
                "sha": gr.sha,
                "synced_at": gr.synced_at.isoformat() if gr.synced_at else None,
                "is_indexed": gr.status in ("completed", "submitted"),
            })

    return {
        "repos": combined,
        "total_github_repos": len(gh_repos),
        "total_greptile_repos": len(gr_repos),
        "greptile_configured": bool(creds.greptile_api_key),
    }


@router.post("/repos/index")
async def greptile_index_repo(
    body: IndexRepoRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger indexing of a single repository in Greptile.
    Set reload=true to force re-indexing even if already indexed.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.greptile_api_key:
        raise HTTPException(status_code=403, detail="No Greptile API key configured.")

    result = await index_repository(
        api_key=creds.greptile_api_key,
        remote=body.remote,
        repository=body.repository,
        branch=body.branch,
        github_token=creds.github_token,
        reload=body.reload,
    )

    if result is None:
        raise HTTPException(status_code=502, detail="Greptile API returned no response.")

    is_error = isinstance(result, dict) and "_error" in result
    if is_error:
        return {
            "status": "error",
            "repository": body.repository,
            "branch": body.branch,
            "error_code": result.get("_error"),
            "error_detail": result.get("_body", ""),
        }

    return {
        "status": "submitted",
        "repository": body.repository,
        "branch": body.branch,
        "reload": body.reload,
        "message": result.get("message", "Indexing started"),
        "status_endpoint": result.get("statusEndpoint"),
    }


@router.post("/repos/index-all")
async def greptile_index_all(
    body: IndexAllRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger indexing for all configured GitHub repos (or a subset).
    Returns per-repo results.
    """
    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.greptile_api_key:
        raise HTTPException(status_code=403, detail="No Greptile API key configured.")

    # Determine target repos
    if body.repos:
        target_repos = body.repos
    else:
        # All GitHub repos from DB
        gh_result = await db.execute(
            select(Repository.full_name, Repository.default_branch)
        )
        target_repos_raw = gh_result.all()
        target_repos = [r[0] for r in target_repos_raw if r[0]]

    # Determine default branches from DB
    branch_map: dict[str, str] = {}
    if target_repos:
        for name in target_repos:
            branch_result = await db.execute(
                select(Repository.default_branch).where(
                    func.lower(Repository.full_name) == name.lower()
                )
            )
            row = branch_result.scalar()
            branch_map[name.lower()] = row or "main"

    results: list[dict] = []
    for repo_name in target_repos:
        branch = branch_map.get(repo_name.lower(), "main")
        result = await index_repository(
            api_key=creds.greptile_api_key,
            remote="github",
            repository=repo_name,
            branch=branch,
            github_token=creds.github_token,
            reload=body.reload,
        )
        is_error = isinstance(result, dict) and "_error" in result
        results.append({
            "repository": repo_name,
            "branch": branch,
            "status": "error" if is_error or result is None else "submitted",
            "message": (
                result.get("_body", "") if is_error else result.get("message", "ok")
            )
            if result
            else "no response",
        })

    submitted = sum(1 for r in results if r["status"] == "submitted")
    return {
        "total": len(results),
        "submitted": submitted,
        "errors": len(results) - submitted,
        "results": results,
    }


@router.post("/repos/refresh")
async def greptile_refresh_status(
    body: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Refresh Greptile status for specific repos (or all) by fetching from the API.
    This is a targeted refresh, not a full sync.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.greptile_api_key:
        raise HTTPException(status_code=403, detail="No Greptile API key configured.")

    now = datetime.utcnow()

    repos = body.repos if body else None

    # Determine which repos to check
    if repos:
        target_repos = repos
    else:
        # All Greptile repos in DB
        gr_result = await db.execute(select(GreptileRepository))
        all_gr = gr_result.scalars().all()
        target_repos = [gr.repository for gr in all_gr if gr.repository]
        # Also add GitHub repos not in Greptile
        gh_result = await db.execute(select(Repository.full_name))
        gh_names = {r[0].lower() for r in gh_result.all() if r[0]}
        gr_names = {r.lower() for r in target_repos}
        for gh_name in gh_names - gr_names:
            # find the original-cased name
            name_result = await db.execute(
                select(Repository.full_name).where(
                    func.lower(Repository.full_name) == gh_name
                )
            )
            row = name_result.scalar()
            if row:
                target_repos.append(row)

    updated = 0
    results: list[dict] = []
    for repo_name in target_repos:
        # Determine branch from DB (GitHub or Greptile)
        branch_q = await db.execute(
            select(Repository.default_branch).where(
                func.lower(Repository.full_name) == repo_name.lower()
            )
        )
        branch = branch_q.scalar() or "main"

        # Also try current Greptile branch
        gr_branch_q = await db.execute(
            select(GreptileRepository.branch).where(
                func.lower(GreptileRepository.repository) == repo_name.lower()
            )
        )
        gr_branch = gr_branch_q.scalar()

        branches_to_try = [branch]
        if gr_branch and gr_branch != branch:
            branches_to_try.insert(0, gr_branch)
        if "master" not in branches_to_try and "main" not in branches_to_try:
            branches_to_try.append("master")
        elif "master" not in branches_to_try:
            branches_to_try.append("master")

        info_raw = None
        used_branch = branch
        for b in branches_to_try:
            repo_id = f"github:{b}:{repo_name}"
            info_raw = await get_repository(
                creds.greptile_api_key, repo_id, github_token=creds.github_token
            )
            if info_raw:
                used_branch = b
                break

        if info_raw:
            from app.services.sync_greptile import _normalize_repo

            info = _normalize_repo(info_raw)
            greptile_repo_id = info.get("greptile_repo_id") or f"github:{used_branch}:{repo_name}"

            stmt = pg_insert(GreptileRepository).values(
                greptile_repo_id=greptile_repo_id,
                repository=(info.get("repository", "") or repo_name)[:512],
                remote=info.get("remote", "github")[:255],
                branch=info.get("branch", used_branch)[:255],
                private=info.get("private"),
                status=info.get("status", "")[:100],
                files_processed=info.get("files_processed"),
                num_files=info.get("num_files"),
                sha=info.get("sha"),
                synced_at=now,
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["greptile_repo_id"],
                set_={
                    GreptileRepository.repository: stmt.excluded.repository,
                    GreptileRepository.remote: stmt.excluded.remote,
                    GreptileRepository.branch: stmt.excluded.branch,
                    GreptileRepository.private: stmt.excluded.private,
                    GreptileRepository.status: stmt.excluded.status,
                    GreptileRepository.files_processed: stmt.excluded.files_processed,
                    GreptileRepository.num_files: stmt.excluded.num_files,
                    GreptileRepository.sha: stmt.excluded.sha,
                    GreptileRepository.synced_at: stmt.excluded.synced_at,
                },
            )
            await db.execute(stmt)
            updated += 1
            results.append({
                "repository": repo_name,
                "status": info.get("status", ""),
                "files_processed": info.get("files_processed"),
                "num_files": info.get("num_files"),
                "refreshed": True,
            })
        else:
            results.append({
                "repository": repo_name,
                "status": None,
                "files_processed": None,
                "num_files": None,
                "refreshed": False,
            })

    await db.commit()
    return {
        "total": len(results),
        "updated": updated,
        "results": results,
    }


@router.get("/debug/bot-reviewers")
async def greptile_debug_bot_reviewers(db: AsyncSession = Depends(get_db)):
    """
    Diagnostic: list all distinct reviewer logins that look like bots,
    so the user can identify the correct Greptile bot username.
    Also shows the currently configured bot login.
    """
    from app.core.config import settings

    # All distinct reviewer logins containing 'bot' or 'greptile' (case-insensitive)
    reviewer_q = (
        select(
            PRReview.reviewer_login,
            func.count(PRReview.id).label("review_count"),
        )
        .where(
            PRReview.reviewer_login.ilike("%bot%")
            | PRReview.reviewer_login.ilike("%greptile%")
        )
        .group_by(PRReview.reviewer_login)
        .order_by(func.count(PRReview.id).desc())
    )
    reviewer_result = await db.execute(reviewer_q)
    reviewers = [
        {"login": row.reviewer_login, "reviews": row.review_count}
        for row in reviewer_result.all()
    ]

    # Same for comment authors
    commenter_q = (
        select(
            PRComment.author_login,
            func.count(PRComment.id).label("comment_count"),
        )
        .where(
            PRComment.author_login.ilike("%bot%")
            | PRComment.author_login.ilike("%greptile%")
        )
        .group_by(PRComment.author_login)
        .order_by(func.count(PRComment.id).desc())
    )
    commenter_result = await db.execute(commenter_q)
    commenters = [
        {"login": row.author_login, "comments": row.comment_count}
        for row in commenter_result.all()
    ]

    return {
        "configured_bot_login": settings.greptile_bot_login,
        "bot_reviewers_found": reviewers,
        "bot_commenters_found": commenters,
        "hint": (
            "If Greptile appears under a different login than the configured one, "
            "set GREPTILE_BOT_LOGIN in your .env to match."
        ),
    }


@router.get("/debug/fetch-repo")
async def greptile_debug_fetch_repo(
    repo: str = Query(..., description="Repo name, e.g. veesion-io/furious"),
    db: AsyncSession = Depends(get_db),
):
    """
    Diagnostic: try to fetch a specific repo from the Greptile API
    using different name casings and branches.
    """
    from app.services.greptile_client import get_repository as greptile_get

    service = CredentialsService(db)
    creds = await service.get_credentials()
    if not creds.greptile_api_key:
        return {"error": "No Greptile API key configured"}

    github_token = creds.github_token
    results: list[dict] = []
    name_variants = [repo]
    if repo != repo.lower():
        name_variants.append(repo.lower())

    for name in name_variants:
        for branch in ("main", "master"):
            repo_id = f"github:{branch}:{name}"
            data = await greptile_get(
                creds.greptile_api_key,
                repo_id,
                github_token=github_token,
                return_error=True,
            )
            is_error = isinstance(data, dict) and "_error" in data
            results.append(
                {
                    "repo_id": repo_id,
                    "found": not is_error and data is not None,
                    "status": data.get("_error") if is_error else 200,
                    "data": data,
                }
            )

    return {
        "repo": repo,
        "github_token_present": bool(github_token),
        "attempts": results,
    }
