"""Sync status and data coverage endpoints."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import Date, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.github import (
    Commit,
    PRComment,
    PRReview,
    PullRequest,
    Repository,
    Workflow,
    WorkflowRun,
)
from app.models.cursor import CursorDailyUsage
from app.models.greptile import GreptileRepository
from app.models.linear import LinearIssue, LinearTeam
from app.models.sync import SyncState

router = APIRouter(prefix="/sync", tags=["sync"])


async def _resolve_repos_for_sync(creds) -> list[str]:
    """Resolve org:* patterns in github_repos to a flat repo list."""
    from app.services.github_repo_resolver import (
        parse_repo_entries,
        resolve_github_repos,
    )

    if not creds.github_token or not (creds.github_repos or "").strip():
        return []
    orgs, _ = parse_repo_entries(creds.github_repos)
    if orgs:
        return await resolve_github_repos(creds.github_token, creds.github_repos)
    return [x.strip() for x in creds.github_repos.split(",") if x.strip()]


class RepositoryCoverage(BaseModel):
    """Data coverage stats for a single repository."""

    id: int
    name: str
    full_name: str
    pull_requests: int
    prs_with_details: int  # PRs that have commits fetched
    prs_without_details: int  # PRs still missing details
    reviews: int
    comments: int
    commits: int
    workflows: int
    workflow_runs: int
    oldest_pr_date: datetime | None
    newest_pr_date: datetime | None
    oldest_commit_date: datetime | None
    newest_commit_date: datetime | None
    oldest_workflow_run_date: datetime | None
    newest_workflow_run_date: datetime | None

    @property
    def is_complete(self) -> bool:
        """True if all PRs have their details fetched."""
        return self.prs_without_details == 0


class ConnectorSyncState(BaseModel):
    """Sync state for a connector."""

    connector_name: str
    display_name: str | None = None  # Optional label e.g. "Veesion Linear"
    last_sync_at: datetime | None
    last_full_sync_at: datetime | None


class SyncCoverageResponse(BaseModel):
    """Complete sync coverage response."""

    connectors: list[ConnectorSyncState]
    repositories: list[RepositoryCoverage]
    total_pull_requests: int
    total_commits: int
    total_workflow_runs: int
    total_developers: int


class ImportRangeRequest(BaseModel):
    """Request body for force-importing data for a date or date range."""

    start_date: str  # YYYY-MM-DD
    end_date: str | None = (
        None  # YYYY-MM-DD; if omitted, same as start_date (single day)
    )
    connector: str = "all"  # "github" | "linear" | "all"


@router.post("/import-range")
async def import_date_range(
    body: ImportRangeRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Force import data for a single day or date range.

    Fetches GitHub PRs (and details) and/or Linear issues created/updated
    within the given range. Use this to backfill or refresh specific dates.
    """
    from datetime import datetime as dt

    try:
        start = dt.strptime(body.start_date, "%Y-%m-%d")
        end_str = body.end_date or body.start_date
        end = dt.strptime(end_str, "%Y-%m-%d")
        if end < start:
            return {"status": "error", "message": "end_date must be >= start_date"}
    except ValueError as e:
        return {
            "status": "error",
            "message": f"Invalid date format (use YYYY-MM-DD): {e}",
        }

    # Use start-of-day and end-of-day (naive UTC) for the range
    since = start.replace(hour=0, minute=0, second=0, microsecond=0)
    until = end.replace(hour=23, minute=59, second=59, microsecond=999999)

    connector = (body.connector or "all").lower()
    github_items = 0
    linear_items = 0
    errors = []

    if connector in ("github", "all"):
        from app.connectors.factory import create_github_connector
        from app.services.credentials import CredentialsService
        from app.services.sync import SyncService

        creds = await CredentialsService(db).get_credentials()
        resolved_repos = await _resolve_repos_for_sync(creds)
        github = create_github_connector(token=creds.github_token, repos=resolved_repos)
        if github:
            try:
                sync_service = SyncService(db, github)
                github_items = await sync_service.sync_date_range(
                    since=since, until=until, fetch_details=True
                )
                await db.commit()
            except Exception as e:
                errors.append(f"GitHub: {e}")
                await db.rollback()
            await github.close()
        else:
            errors.append("GitHub connector not configured")

    if connector in ("linear", "all"):
        from app.connectors.factory import create_linear_connector
        from app.services.credentials import CredentialsService
        from app.services.sync_linear import SyncLinearService

        creds = await CredentialsService(db).get_credentials()
        linear_conn = create_linear_connector(api_key=creds.linear_api_key)
        if linear_conn:
            try:
                sync_linear = SyncLinearService(db, linear_conn)
                linear_items = await sync_linear.sync_date_range(
                    since=since, until=until
                )
            except Exception as e:
                errors.append(f"Linear: {e}")
                await db.rollback()
            await linear_conn.close()
        else:
            errors.append("Linear connector not configured")

    if connector == "all" and (github_items or linear_items):
        from app.services.linking import LinkingService

        try:
            linking_service = LinkingService(db)
            await linking_service.link_all_prs()
            await db.commit()
        except Exception as e:
            errors.append(f"Linking: {e}")

    total = github_items + linear_items
    if errors:
        return {
            "status": "partial" if total else "error",
            "message": f"Imported {total} items; {len(errors)} error(s)",
            "github_items": github_items,
            "linear_items": linear_items,
            "errors": errors,
        }
    return {
        "status": "success",
        "message": f"Imported {total} items",
        "github_items": github_items,
        "linear_items": linear_items,
    }


@router.post("/trigger-full")
async def trigger_full_sync(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Trigger a full sync for all connectors.

    This syncs all PRs quickly, then details are filled gradually by the background job.
    """
    from app.services.scheduler import run_full_sync

    try:
        await run_full_sync()
        return {
            "status": "success",
            "message": "Full sync completed (PRs synced, details will be filled gradually)",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/linear-full")
async def trigger_linear_full_sync(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Trigger a full sync of all Linear teams and issues only.

    Use this to refresh the Linear teams progression (issues synced per team)
    when the scheduled incremental sync has not caught up.
    """
    from app.connectors.factory import create_linear_connector
    from app.services.credentials import CredentialsService
    from app.services.linking import LinkingService
    from app.services.scheduler import set_sync_job_state
    from app.services.sync_linear import SyncLinearService

    creds = await CredentialsService(db).get_credentials()
    linear_conn = create_linear_connector(api_key=creds.linear_api_key)
    if not linear_conn:
        return {"status": "error", "message": "Linear connector not configured"}

    set_sync_job_state(True, "linear_sync")
    try:
        try:
            sync_linear = SyncLinearService(db, linear_conn)
            items = await sync_linear.sync_all()
            try:
                linking_service = LinkingService(db)
                await linking_service.link_all_prs()
                await db.commit()
            except Exception as e:
                await db.rollback()
                return {
                    "status": "partial",
                    "message": f"Synced {items} issues but linking failed: {e}",
                    "items_synced": items,
                }
            return {
                "status": "success",
                "message": f"Linear full sync completed ({items} issues)",
                "items_synced": items,
            }
        except Exception as e:
            await db.rollback()
            return {"status": "error", "message": str(e)}
        finally:
            await linear_conn.close()
    finally:
        set_sync_job_state(False)


@router.post("/fill-details")
async def trigger_fill_details(
    batch_size: int = 50,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Trigger a batch of PR details sync (reviews, comments, commits).

    Args:
        batch_size: Number of PRs to process (default 100)

    Call this repeatedly to gradually fill all PR details.
    """
    from app.services.scheduler import run_fill_details

    try:
        await run_fill_details(batch_size=batch_size)
        return {
            "status": "success",
            "message": f"Processed up to {batch_size} PRs",
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/status")
async def get_sync_status(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Get sync status: how many PRs still need details, and Linear teams progression.
    """
    from sqlalchemy import select, func
    from app.models.github import PullRequest, Repository

    # Count PRs with and without details_synced_at
    total_prs_result = await db.execute(select(func.count(PullRequest.id)))
    total_prs = total_prs_result.scalar() or 0

    prs_with_details_result = await db.execute(
        select(func.count(PullRequest.id)).where(
            PullRequest.details_synced_at.isnot(None)
        )
    )
    prs_with_details = prs_with_details_result.scalar() or 0

    prs_without_details = total_prs - prs_with_details
    progress_pct = (prs_with_details / total_prs * 100) if total_prs > 0 else 100

    # Get per-repo breakdown
    repos_result = await db.execute(select(Repository))
    repos = repos_result.scalars().all()

    repos_status = []
    for repo in repos:
        repo_prs_result = await db.execute(
            select(func.count(PullRequest.id)).where(PullRequest.repo_id == repo.id)
        )
        repo_total = repo_prs_result.scalar() or 0

        repo_with_details_result = await db.execute(
            select(func.count(PullRequest.id))
            .where(PullRequest.repo_id == repo.id)
            .where(PullRequest.details_synced_at.isnot(None))
        )
        repo_with_details = repo_with_details_result.scalar() or 0

        repos_status.append(
            {
                "name": repo.full_name,
                "total_prs": repo_total,
                "with_details": repo_with_details,
                "without_details": repo_total - repo_with_details,
            }
        )

    # Linear teams progression: per-team counts from DB only (not from Linear API).
    # total_issues = issues synced in app for this team; linked_issues = those with a linked PR (for cycle time).
    # After a full re-sync, same workspace yields the same counts.
    teams_result = await db.execute(select(LinearTeam).order_by(LinearTeam.name))
    teams = teams_result.scalars().all()
    linear_teams_status = []
    for team in teams:
        total_issues_result = await db.execute(
            select(func.count(LinearIssue.id)).where(LinearIssue.team_id == team.id)
        )
        total_issues = total_issues_result.scalar() or 0
        linked_result = await db.execute(
            select(func.count(LinearIssue.id))
            .where(LinearIssue.team_id == team.id)
            .where(LinearIssue.linked_pr_id.isnot(None))
        )
        linked_issues = linked_result.scalar() or 0
        linear_teams_status.append(
            {
                "name": team.name,
                "key": team.key,
                "total_issues": total_issues,
                "linked_issues": linked_issues,
            }
        )

    from app.services.scheduler import get_sync_job_state
    from app.services.credentials import CredentialsService

    sync_in_progress, current_job = get_sync_job_state()

    # Cursor: connected and team members count (for data coverage progression)
    cursor_connected = False
    cursor_team_members_count: int | None = None
    # Greptile: connected and indexed repos count
    greptile_connected = False
    greptile_repos_count: int | None = None
    creds = await CredentialsService(db).get_credentials()
    if creds.cursor_api_key:
        cursor_connected = True
        try:
            from app.services.cursor_client import get_team_members

            members = await get_team_members(creds.cursor_api_key)
            if members and members.get("teamMembers"):
                cursor_team_members_count = len(members["teamMembers"])
        except Exception:
            pass
    if creds.greptile_api_key:
        greptile_connected = True
        try:
            from app.services.greptile_client import list_repositories

            repos = await list_repositories(
                creds.greptile_api_key, github_token=creds.github_token
            )
            if repos is not None:
                greptile_repos_count = len(repos)
        except Exception:
            pass

    return {
        "total_prs": total_prs,
        "prs_with_details": prs_with_details,
        "prs_without_details": prs_without_details,
        "progress_percent": round(progress_pct, 1),
        "is_complete": prs_without_details == 0,
        "repositories": repos_status,
        "linear_teams": linear_teams_status,
        "sync_in_progress": sync_in_progress,
        "current_job": current_job,
        "cursor_connected": cursor_connected,
        "cursor_team_members_count": cursor_team_members_count,
        "greptile_connected": greptile_connected,
        "greptile_repos_count": greptile_repos_count,
    }


@router.post("/fill-all")
async def fill_all_details(
    batch_size: int = 100,
    max_batches: int = 200,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Fill details for ALL PRs that need them, processing in batches.

    Args:
        batch_size: PRs to process per batch (default 100, = ~300 API calls)
        max_batches: Maximum batches to run (default 200 = 6000 PRs max)

    This runs until all PRs have details or max_batches is reached.
    Rate limiter is reset between batches to avoid hitting limits.
    """
    import logging
    from sqlalchemy import select, func
    from app.connectors.factory import create_github_connector
    from app.connectors.rate_limiter import get_rate_limiter
    from app.models.github import PullRequest, Repository
    from app.services.credentials import CredentialsService
    from app.services.sync import SyncService

    logger = logging.getLogger(__name__)

    creds = await CredentialsService(db).get_credentials()
    resolved_repos = await _resolve_repos_for_sync(creds)
    total_items_synced = 0
    total_prs_processed = 0
    batches_run = 0

    try:
        while batches_run < max_batches:
            # Create fresh connector for each batch (resets rate limiter)
            github = create_github_connector(
                token=creds.github_token, repos=resolved_repos
            )
            if not github:
                return {"status": "error", "message": "GitHub connector not configured"}

            # Reset rate limiter for this batch
            rate_limiter = get_rate_limiter()
            rate_limiter.reset()

            # Find PRs without details_synced_at (not yet processed)
            prs_without_details = await db.execute(
                select(PullRequest, Repository)
                .join(Repository)
                .where(PullRequest.details_synced_at.is_(None))
                .order_by(PullRequest.updated_at.desc())
                .limit(batch_size)
            )
            prs_to_process = prs_without_details.all()

            if not prs_to_process:
                await github.close()
                logger.info("All PRs have details - sync complete!")
                break

            # Count remaining
            remaining_result = await db.execute(
                select(func.count(PullRequest.id)).where(
                    PullRequest.details_synced_at.is_(None)
                )
            )
            remaining = remaining_result.scalar() or 0

            logger.info(
                f"Batch {batches_run + 1}: processing {len(prs_to_process)} PRs ({remaining} remaining)"
            )

            sync_service = SyncService(db, github)
            batch_prs = 0

            for pr, repo in prs_to_process:
                try:
                    reviews = await github.fetch_reviews(repo.full_name, pr.number)
                    total_items_synced += await sync_service._upsert_reviews(
                        pr.id, reviews
                    )

                    comments = await github.fetch_comments(repo.full_name, pr.number)
                    total_items_synced += await sync_service._upsert_comments(
                        pr.id, comments
                    )

                    commits = await github.fetch_pr_commits(repo.full_name, pr.number)
                    total_items_synced += await sync_service._upsert_commits(
                        repo.id, pr.id, commits
                    )

                    # Mark PR as processed
                    pr.details_synced_at = datetime.utcnow()

                    total_prs_processed += 1
                    batch_prs += 1
                except Exception as e:
                    logger.warning(f"Failed PR #{pr.number}: {e}")
                    continue

            await db.commit()
            await github.close()
            batches_run += 1

            stats = rate_limiter.get_stats()
            logger.info(
                f"Batch {batches_run} complete: {batch_prs} PRs, "
                f"{stats['calls_made']} API calls"
            )

        # Get final status
        remaining_result = await db.execute(
            select(func.count(PullRequest.id)).where(
                PullRequest.details_synced_at.is_(None)
            )
        )
        still_remaining = remaining_result.scalar() or 0

        return {
            "status": "success",
            "message": (
                "Fill complete"
                if still_remaining == 0
                else f"Processed {max_batches} batches, {still_remaining} PRs remaining"
            ),
            "batches_run": batches_run,
            "prs_processed": total_prs_processed,
            "items_synced": total_items_synced,
            "prs_remaining": still_remaining,
            "is_complete": still_remaining == 0,
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "error_type": type(e).__name__}


async def _get_github_and_repo(repo_name: str, db: AsyncSession):
    """Helper to get GitHub connector and validate repo."""
    from app.connectors.factory import create_github_connector
    from app.services.credentials import CredentialsService

    creds = await CredentialsService(db).get_credentials()
    resolved_repos = await _resolve_repos_for_sync(creds)
    github = create_github_connector(token=creds.github_token, repos=resolved_repos)
    if not github:
        return (
            None,
            None,
            {"status": "error", "message": "GitHub connector not configured"},
        )

    if repo_name not in github._repos:
        await github.close()
        return (
            None,
            None,
            {
                "status": "error",
                "message": f"Repo '{repo_name}' not in configured repos: {github._repos}",
            },
        )

    repos = await github.fetch_repos()
    repo_data = next((r for r in repos if r["full_name"] == repo_name), None)

    if not repo_data:
        await github.close()
        return (
            None,
            None,
            {
                "status": "error",
                "message": f"Could not fetch repo '{repo_name}' from GitHub",
            },
        )

    return github, repo_data, None


@router.post("/repos/{repo_name:path}/pull-requests")
async def sync_repo_pull_requests(
    repo_name: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Sync pull requests only for a repository (fast).

    Example: POST /api/v1/sync/repos/veesion-io/Furious/pull-requests
    """
    from app.services.sync import SyncService

    github, repo_data, error = await _get_github_and_repo(repo_name, db)
    if error:
        return error

    try:
        sync_service = SyncService(db, github)
        await sync_service._upsert_repos([repo_data])
        count = await sync_service._sync_single_repo(
            repo_data, since=None, fetch_details=False
        )
        await db.commit()
        await github.close()
        return {
            "status": "success",
            "message": f"Synced PRs for {repo_name}",
            "items_synced": count,
        }
    except Exception as e:
        try:
            await github.close()
        except Exception:
            pass
        return {"status": "error", "message": str(e), "error_type": type(e).__name__}


@router.post("/repos/{repo_name:path}/commits")
async def sync_repo_commits(
    repo_name: str,
    offset: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Sync commits for a batch of PRs in a repository.

    Args:
        offset: Start from this PR index (for pagination)
        limit: Number of PRs to process (default 50)

    Example: POST /api/v1/sync/repos/veesion-io/Furious/commits?offset=0&limit=50
    """
    from sqlalchemy import select, func
    from app.models.github import PullRequest, Repository
    from app.services.sync import SyncService

    github, repo_data, error = await _get_github_and_repo(repo_name, db)
    if error:
        return error

    try:
        repo_result = await db.execute(
            select(Repository).where(Repository.full_name == repo_name)
        )
        repo = repo_result.scalar_one_or_none()
        if not repo:
            await github.close()
            return {"status": "error", "message": f"Repo '{repo_name}' not in database"}

        # Count total PRs
        total_result = await db.execute(
            select(func.count(PullRequest.id)).where(PullRequest.repo_id == repo.id)
        )
        total_prs = total_result.scalar() or 0

        # Get batch of PRs
        prs_result = await db.execute(
            select(PullRequest)
            .where(PullRequest.repo_id == repo.id)
            .order_by(PullRequest.id)
            .offset(offset)
            .limit(limit)
        )
        prs = prs_result.scalars().all()

        sync_service = SyncService(db, github)
        count = 0
        for pr in prs:
            commits = await github.fetch_pr_commits(repo_name, pr.number)
            count += await sync_service._upsert_commits(repo.id, pr.id, commits)

        await db.commit()
        await github.close()

        next_offset = offset + len(prs)
        has_more = next_offset < total_prs

        return {
            "status": "success",
            "message": f"Synced commits for {repo_name}",
            "items_synced": count,
            "prs_processed": len(prs),
            "total_prs": total_prs,
            "offset": offset,
            "next_offset": next_offset if has_more else None,
            "has_more": has_more,
        }
    except Exception as e:
        try:
            await github.close()
        except Exception:
            pass
        return {"status": "error", "message": str(e), "error_type": type(e).__name__}


@router.post("/repos/{repo_name:path}/reviews")
async def sync_repo_reviews(
    repo_name: str,
    offset: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Sync reviews for a batch of PRs in a repository.

    Args:
        offset: Start from this PR index (for pagination)
        limit: Number of PRs to process (default 50)

    Example: POST /api/v1/sync/repos/veesion-io/Furious/reviews?offset=0&limit=50
    """
    from sqlalchemy import select, func
    from app.models.github import PullRequest, Repository
    from app.services.sync import SyncService

    github, repo_data, error = await _get_github_and_repo(repo_name, db)
    if error:
        return error

    try:
        repo_result = await db.execute(
            select(Repository).where(Repository.full_name == repo_name)
        )
        repo = repo_result.scalar_one_or_none()
        if not repo:
            await github.close()
            return {"status": "error", "message": f"Repo '{repo_name}' not in database"}

        total_result = await db.execute(
            select(func.count(PullRequest.id)).where(PullRequest.repo_id == repo.id)
        )
        total_prs = total_result.scalar() or 0

        prs_result = await db.execute(
            select(PullRequest)
            .where(PullRequest.repo_id == repo.id)
            .order_by(PullRequest.id)
            .offset(offset)
            .limit(limit)
        )
        prs = prs_result.scalars().all()

        sync_service = SyncService(db, github)
        count = 0
        for pr in prs:
            reviews = await github.fetch_reviews(repo_name, pr.number)
            count += await sync_service._upsert_reviews(pr.id, reviews)

        await db.commit()
        await github.close()

        next_offset = offset + len(prs)
        has_more = next_offset < total_prs

        return {
            "status": "success",
            "message": f"Synced reviews for {repo_name}",
            "items_synced": count,
            "prs_processed": len(prs),
            "total_prs": total_prs,
            "offset": offset,
            "next_offset": next_offset if has_more else None,
            "has_more": has_more,
        }
    except Exception as e:
        try:
            await github.close()
        except Exception:
            pass
        return {"status": "error", "message": str(e), "error_type": type(e).__name__}


@router.post("/repos/{repo_name:path}/comments")
async def sync_repo_comments(
    repo_name: str,
    offset: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Sync comments for a batch of PRs in a repository.

    Args:
        offset: Start from this PR index (for pagination)
        limit: Number of PRs to process (default 50)

    Example: POST /api/v1/sync/repos/veesion-io/Furious/comments?offset=0&limit=50
    """
    from sqlalchemy import select, func
    from app.models.github import PullRequest, Repository
    from app.services.sync import SyncService

    github, repo_data, error = await _get_github_and_repo(repo_name, db)
    if error:
        return error

    try:
        repo_result = await db.execute(
            select(Repository).where(Repository.full_name == repo_name)
        )
        repo = repo_result.scalar_one_or_none()
        if not repo:
            await github.close()
            return {"status": "error", "message": f"Repo '{repo_name}' not in database"}

        total_result = await db.execute(
            select(func.count(PullRequest.id)).where(PullRequest.repo_id == repo.id)
        )
        total_prs = total_result.scalar() or 0

        prs_result = await db.execute(
            select(PullRequest)
            .where(PullRequest.repo_id == repo.id)
            .order_by(PullRequest.id)
            .offset(offset)
            .limit(limit)
        )
        prs = prs_result.scalars().all()

        sync_service = SyncService(db, github)
        count = 0
        for pr in prs:
            comments = await github.fetch_comments(repo_name, pr.number)
            count += await sync_service._upsert_comments(pr.id, comments)

        await db.commit()
        await github.close()

        next_offset = offset + len(prs)
        has_more = next_offset < total_prs

        return {
            "status": "success",
            "message": f"Synced comments for {repo_name}",
            "items_synced": count,
            "prs_processed": len(prs),
            "total_prs": total_prs,
            "offset": offset,
            "next_offset": next_offset if has_more else None,
            "has_more": has_more,
        }
    except Exception as e:
        try:
            await github.close()
        except Exception:
            pass
        return {"status": "error", "message": str(e), "error_type": type(e).__name__}


@router.post("/repos/{repo_name:path}/all")
async def sync_repo_all(
    repo_name: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Full sync for a repository (PRs + details).

    Example: POST /api/v1/sync/repos/veesion-io/Furious/all
    """
    from app.services.sync import SyncService

    github, repo_data, error = await _get_github_and_repo(repo_name, db)
    if error:
        return error

    try:
        sync_service = SyncService(db, github)
        await sync_service._upsert_repos([repo_data])
        count = await sync_service._sync_single_repo(
            repo_data, since=None, fetch_details=True
        )
        await db.commit()
        await github.close()
        return {
            "status": "success",
            "message": f"Full sync for {repo_name}",
            "items_synced": count,
        }
    except Exception as e:
        try:
            await github.close()
        except Exception:
            pass
        return {"status": "error", "message": str(e), "error_type": type(e).__name__}


class RepoSyncDiagnostic(BaseModel):
    """Diagnostic info for a repository sync attempt."""

    repo_name: str
    pr_fetch_status: str
    pr_count: int
    error: str | None


class SyncDiagnosticResponse(BaseModel):
    """Sync diagnostic response."""

    repos: list[RepoSyncDiagnostic]


@router.get("/diagnostic")
async def get_sync_diagnostic(
    db: AsyncSession = Depends(get_db),
) -> SyncDiagnosticResponse:
    """
    Test GitHub API connectivity for each configured repo.

    This helps diagnose why a repo might have no data.
    """
    from app.connectors.factory import create_github_connector
    from app.services.credentials import CredentialsService

    creds = await CredentialsService(db).get_credentials()
    resolved_repos = await _resolve_repos_for_sync(creds)
    github = create_github_connector(token=creds.github_token, repos=resolved_repos)
    if not github:
        return SyncDiagnosticResponse(repos=[])

    results: list[RepoSyncDiagnostic] = []

    for repo_full_name in github._repos:
        try:
            # Try to fetch just 1 PR to test
            prs = await github.fetch_pull_requests(repo_full_name, per_page=5)
            results.append(
                RepoSyncDiagnostic(
                    repo_name=repo_full_name,
                    pr_fetch_status="success",
                    pr_count=len(prs),
                    error=None,
                )
            )
        except Exception as e:
            results.append(
                RepoSyncDiagnostic(
                    repo_name=repo_full_name,
                    pr_fetch_status="error",
                    pr_count=0,
                    error=str(e),
                )
            )

    await github.close()
    return SyncDiagnosticResponse(repos=results)


class DailyCountItem(BaseModel):
    """Count for a single day."""

    date: str  # YYYY-MM-DD
    count: int


class DailyCoverageResponse(BaseModel):
    """Daily counts per category for data coverage charts."""

    github: list[DailyCountItem]  # PRs created per day
    github_actions: list[DailyCountItem]  # Workflow runs per day
    linear: list[DailyCountItem]  # Issues created per day
    cursor: list[DailyCountItem]  # AI requests per day
    greptile: list[DailyCountItem]  # Indexed repos per day


@router.get("/coverage/daily", response_model=DailyCoverageResponse)
async def get_daily_coverage(
    db: AsyncSession = Depends(get_db),
    days: int = Query(90, ge=7, le=365),
) -> DailyCoverageResponse:
    """Get count of imported data per day per category (GitHub PRs, workflow runs, Linear issues)."""
    end = datetime.utcnow().date()
    start = end - timedelta(days=days)

    # GitHub: PRs created per day (cast to date for PostgreSQL)
    pr_date = cast(PullRequest.created_at, Date)
    pr_by_day = await db.execute(
        select(pr_date.label("day"), func.count(PullRequest.id).label("count"))
        .where(pr_date >= start)
        .where(pr_date <= end)
        .group_by(pr_date)
        .order_by(pr_date)
    )
    pr_rows = pr_by_day.all()
    # Build full date range so frontend has a point for every day
    github_map = {row.day: row.count for row in pr_rows}
    github_list = [
        DailyCountItem(
            date=(start + timedelta(days=i)).isoformat(),
            count=github_map.get(start + timedelta(days=i), 0),
        )
        for i in range((end - start).days + 1)
    ]

    # GitHub Actions: workflow runs (created_at) per day
    run_date = cast(WorkflowRun.created_at, Date)
    runs_by_day = await db.execute(
        select(run_date.label("day"), func.count(WorkflowRun.id).label("count"))
        .where(run_date >= start)
        .where(run_date <= end)
        .group_by(run_date)
        .order_by(run_date)
    )
    runs_rows = runs_by_day.all()
    runs_map = {row.day: row.count for row in runs_rows}
    github_actions_list = [
        DailyCountItem(
            date=(start + timedelta(days=i)).isoformat(),
            count=runs_map.get(start + timedelta(days=i), 0),
        )
        for i in range((end - start).days + 1)
    ]

    # Linear: issues created per day
    issue_date = cast(LinearIssue.created_at, Date)
    issues_by_day = await db.execute(
        select(issue_date.label("day"), func.count(LinearIssue.id).label("count"))
        .where(issue_date >= start)
        .where(issue_date <= end)
        .group_by(issue_date)
        .order_by(issue_date)
    )
    issues_rows = issues_by_day.all()
    issues_map = {row.day: row.count for row in issues_rows}
    linear_list = [
        DailyCountItem(
            date=(start + timedelta(days=i)).isoformat(),
            count=issues_map.get(start + timedelta(days=i), 0),
        )
        for i in range((end - start).days + 1)
    ]

    # Cursor: 1 if usage data exists for that day, 0 otherwise
    cursor_by_day = await db.execute(
        select(CursorDailyUsage.date.label("day"))
        .where(CursorDailyUsage.date >= start)
        .where(CursorDailyUsage.date <= end)
        .order_by(CursorDailyUsage.date)
    )
    cursor_dates = {row.day for row in cursor_by_day.all()}
    cursor_map = {d: 1 for d in cursor_dates}
    cursor_list = [
        DailyCountItem(
            date=(start + timedelta(days=i)).isoformat(),
            count=cursor_map.get(start + timedelta(days=i), 0),
        )
        for i in range((end - start).days + 1)
    ]

    # Greptile: indexed repos per day (by synced_at date)
    greptile_date = cast(GreptileRepository.synced_at, Date)
    greptile_by_day = await db.execute(
        select(
            greptile_date.label("day"), func.count(GreptileRepository.id).label("count")
        )
        .where(greptile_date >= start)
        .where(greptile_date <= end)
        .group_by(greptile_date)
        .order_by(greptile_date)
    )
    greptile_rows = greptile_by_day.all()
    greptile_map = {row.day: row.count for row in greptile_rows}
    greptile_list = [
        DailyCountItem(
            date=(start + timedelta(days=i)).isoformat(),
            count=greptile_map.get(start + timedelta(days=i), 0),
        )
        for i in range((end - start).days + 1)
    ]

    return DailyCoverageResponse(
        github=github_list,
        github_actions=github_actions_list,
        linear=linear_list,
        cursor=cursor_list,
        greptile=greptile_list,
    )


@router.get("/coverage", response_model=SyncCoverageResponse)
async def get_sync_coverage(
    db: AsyncSession = Depends(get_db),
) -> SyncCoverageResponse:
    """Get data coverage statistics for all repositories."""
    from app.services.credentials import CredentialsService

    creds = await CredentialsService(db).get_credentials()
    # Get connector sync states
    sync_states_result = await db.execute(select(SyncState))
    sync_states = sync_states_result.scalars().all()
    linear_display_name = creds.linear_workspace_name.strip() or None
    connector_names_seen = {s.connector_name for s in sync_states}
    connectors = [
        ConnectorSyncState(
            connector_name=s.connector_name,
            display_name=(
                linear_display_name if s.connector_name == "linear" else None
            ),
            last_sync_at=s.last_sync_at,
            last_full_sync_at=s.last_full_sync_at,
        )
        for s in sync_states
    ]
    # Add Cursor when configured (may not have a SyncState row yet)
    if creds.cursor_api_key and "cursor" not in connector_names_seen:
        cursor_state = next(
            (s for s in sync_states if s.connector_name == "cursor"), None
        )
        connectors.append(
            ConnectorSyncState(
                connector_name="cursor",
                display_name="Cursor",
                last_sync_at=cursor_state.last_sync_at if cursor_state else None,
                last_full_sync_at=(
                    cursor_state.last_full_sync_at if cursor_state else None
                ),
            )
        )
    # Add Greptile when configured (may not have a SyncState row yet)
    if creds.greptile_api_key and "greptile" not in connector_names_seen:
        greptile_state = next(
            (s for s in sync_states if s.connector_name == "greptile"), None
        )
        connectors.append(
            ConnectorSyncState(
                connector_name="greptile",
                display_name="Greptile",
                last_sync_at=greptile_state.last_sync_at if greptile_state else None,
                last_full_sync_at=(
                    greptile_state.last_full_sync_at if greptile_state else None
                ),
            )
        )
    # Add Sentry when configured (may not have a SyncState row yet)
    sentry_configured = bool(
        creds.sentry_api_token and (creds.sentry_org or "").strip()
    )
    if sentry_configured and not any(
        c.connector_name == "sentry" for c in connectors
    ):
        sentry_state = next(
            (s for s in sync_states if s.connector_name == "sentry"), None
        )
        connectors.append(
            ConnectorSyncState(
                connector_name="sentry",
                display_name="Sentry",
                last_sync_at=sentry_state.last_sync_at if sentry_state else None,
                last_full_sync_at=(
                    sentry_state.last_full_sync_at if sentry_state else None
                ),
            )
        )

    # Get all repositories
    repos_result = await db.execute(select(Repository).order_by(Repository.full_name))
    repos = repos_result.scalars().all()

    repository_coverages: list[RepositoryCoverage] = []
    total_prs = 0
    total_commits = 0
    total_runs = 0

    for repo in repos:
        # Count PRs and get date range
        pr_stats = await db.execute(
            select(
                func.count(PullRequest.id),
                func.min(PullRequest.created_at),
                func.max(PullRequest.created_at),
            ).where(PullRequest.repo_id == repo.id)
        )
        pr_count, oldest_pr, newest_pr = pr_stats.one()

        # Count PRs with details (have details_synced_at)
        prs_with_details_result = await db.execute(
            select(func.count(PullRequest.id))
            .where(PullRequest.repo_id == repo.id)
            .where(PullRequest.details_synced_at.isnot(None))
        )
        prs_with_details = prs_with_details_result.scalar() or 0
        prs_without_details = (pr_count or 0) - prs_with_details

        # Count reviews
        review_count_result = await db.execute(
            select(func.count(PRReview.id))
            .select_from(PRReview)
            .join(PullRequest)
            .where(PullRequest.repo_id == repo.id)
        )
        review_count = review_count_result.scalar() or 0

        # Count comments
        comment_count_result = await db.execute(
            select(func.count(PRComment.id))
            .select_from(PRComment)
            .join(PullRequest)
            .where(PullRequest.repo_id == repo.id)
        )
        comment_count = comment_count_result.scalar() or 0

        # Count commits and get date range
        commit_stats = await db.execute(
            select(
                func.count(Commit.id),
                func.min(Commit.committed_at),
                func.max(Commit.committed_at),
            ).where(Commit.repo_id == repo.id)
        )
        commit_count, oldest_commit, newest_commit = commit_stats.one()

        # Count workflows
        workflow_count_result = await db.execute(
            select(func.count(Workflow.id)).where(Workflow.repo_id == repo.id)
        )
        workflow_count = workflow_count_result.scalar() or 0

        # Count workflow runs and get date range
        run_stats = await db.execute(
            select(
                func.count(WorkflowRun.id),
                func.min(WorkflowRun.created_at),
                func.max(WorkflowRun.created_at),
            )
            .select_from(WorkflowRun)
            .join(Workflow)
            .where(Workflow.repo_id == repo.id)
        )
        run_count, oldest_run, newest_run = run_stats.one()

        repository_coverages.append(
            RepositoryCoverage(
                id=repo.id,
                name=repo.name,
                full_name=repo.full_name,
                pull_requests=pr_count or 0,
                prs_with_details=prs_with_details,
                prs_without_details=prs_without_details,
                reviews=review_count,
                comments=comment_count,
                commits=commit_count or 0,
                workflows=workflow_count,
                workflow_runs=run_count or 0,
                oldest_pr_date=oldest_pr,
                newest_pr_date=newest_pr,
                oldest_commit_date=oldest_commit,
                newest_commit_date=newest_commit,
                oldest_workflow_run_date=oldest_run,
                newest_workflow_run_date=newest_run,
            )
        )

        total_prs += pr_count or 0
        total_commits += commit_count or 0
        total_runs += run_count or 0

    # Count unique developers (based on PR authors and commit authors)
    unique_developers = set()

    # Get unique PR authors
    pr_authors_result = await db.execute(
        select(PullRequest.author_login)
        .distinct()
        .where(PullRequest.author_login.isnot(None))
    )
    pr_authors = pr_authors_result.scalars().all()
    unique_developers.update(pr_authors)

    # Get unique commit authors
    commit_authors_result = await db.execute(
        select(Commit.author_login).distinct().where(Commit.author_login.isnot(None))
    )
    commit_authors = commit_authors_result.scalars().all()
    unique_developers.update(commit_authors)

    return SyncCoverageResponse(
        connectors=connectors,
        repositories=repository_coverages,
        total_pull_requests=total_prs,
        total_commits=total_commits,
        total_workflow_runs=total_runs,
        total_developers=len(unique_developers),
    )
