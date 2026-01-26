"""Sync status and data coverage endpoints."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
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
from app.models.sync import SyncState

router = APIRouter(prefix="/sync", tags=["sync"])


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
    last_sync_at: datetime | None
    last_full_sync_at: datetime | None


class SyncCoverageResponse(BaseModel):
    """Complete sync coverage response."""

    connectors: list[ConnectorSyncState]
    repositories: list[RepositoryCoverage]
    total_pull_requests: int
    total_commits: int
    total_workflow_runs: int


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


@router.post("/fill-details")
async def trigger_fill_details(
    batch_size: int = 50,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Trigger a batch of PR details sync (reviews, comments, commits).
    
    Args:
        batch_size: Number of PRs to process (default 50)
    
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
    Get sync status: how many PRs still need details.
    """
    from sqlalchemy import select, func
    from app.models.github import Commit, PullRequest, Repository

    # Count PRs with and without commits
    prs_with_commits = select(Commit.pr_id).where(Commit.pr_id.isnot(None)).distinct()
    
    total_prs_result = await db.execute(select(func.count(PullRequest.id)))
    total_prs = total_prs_result.scalar() or 0
    
    prs_without_details_result = await db.execute(
        select(func.count(PullRequest.id))
        .where(~PullRequest.id.in_(prs_with_commits))
    )
    prs_without_details = prs_without_details_result.scalar() or 0
    
    prs_with_details = total_prs - prs_without_details
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
            .where(PullRequest.id.in_(prs_with_commits))
        )
        repo_with_details = repo_with_details_result.scalar() or 0
        
        repos_status.append({
            "name": repo.full_name,
            "total_prs": repo_total,
            "with_details": repo_with_details,
            "without_details": repo_total - repo_with_details,
        })
    
    return {
        "total_prs": total_prs,
        "prs_with_details": prs_with_details,
        "prs_without_details": prs_without_details,
        "progress_percent": round(progress_pct, 1),
        "is_complete": prs_without_details == 0,
        "repositories": repos_status,
    }


@router.post("/fill-all")
async def fill_all_details(
    batch_size: int = 30,
    max_batches: int = 200,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Fill details for ALL PRs that need them, processing in batches.
    
    Args:
        batch_size: PRs to process per batch (default 30, = ~90 API calls)
        max_batches: Maximum batches to run (default 200 = 6000 PRs max)
    
    This runs until all PRs have details or max_batches is reached.
    Rate limiter is reset between batches to avoid hitting limits.
    """
    import logging
    from sqlalchemy import select, func
    from app.connectors.factory import create_github_connector
    from app.connectors.rate_limiter import get_rate_limiter
    from app.models.github import Commit, PullRequest, Repository
    from app.services.sync import SyncService
    
    logger = logging.getLogger(__name__)
    
    total_items_synced = 0
    total_prs_processed = 0
    batches_run = 0
    
    try:
        while batches_run < max_batches:
            # Create fresh connector for each batch (resets rate limiter)
            github = create_github_connector()
            if not github:
                return {"status": "error", "message": "GitHub connector not configured"}
            
            # Reset rate limiter for this batch
            rate_limiter = get_rate_limiter()
            rate_limiter.reset()
            
            # Find PRs without commits
            prs_with_commits = select(Commit.pr_id).where(Commit.pr_id.isnot(None)).distinct()
            
            prs_without_details = await db.execute(
                select(PullRequest, Repository)
                .join(Repository)
                .where(~PullRequest.id.in_(prs_with_commits))
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
                select(func.count(PullRequest.id))
                .where(~PullRequest.id.in_(prs_with_commits))
            )
            remaining = remaining_result.scalar() or 0
            
            logger.info(f"Batch {batches_run + 1}: processing {len(prs_to_process)} PRs ({remaining} remaining)")
            
            sync_service = SyncService(db, github)
            batch_prs = 0
            
            for pr, repo in prs_to_process:
                try:
                    reviews = await github.fetch_reviews(repo.full_name, pr.number)
                    total_items_synced += await sync_service._upsert_reviews(pr.id, reviews)
                    
                    comments = await github.fetch_comments(repo.full_name, pr.number)
                    total_items_synced += await sync_service._upsert_comments(pr.id, comments)
                    
                    commits = await github.fetch_pr_commits(repo.full_name, pr.number)
                    total_items_synced += await sync_service._upsert_commits(repo.id, pr.id, commits)
                    
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
        prs_with_commits = select(Commit.pr_id).where(Commit.pr_id.isnot(None)).distinct()
        remaining_result = await db.execute(
            select(func.count(PullRequest.id))
            .where(~PullRequest.id.in_(prs_with_commits))
        )
        still_remaining = remaining_result.scalar() or 0
        
        return {
            "status": "success",
            "message": "Fill complete" if still_remaining == 0 else f"Processed {max_batches} batches, {still_remaining} PRs remaining",
            "batches_run": batches_run,
            "prs_processed": total_prs_processed,
            "items_synced": total_items_synced,
            "prs_remaining": still_remaining,
            "is_complete": still_remaining == 0,
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "error_type": type(e).__name__}


async def _get_github_and_repo(repo_name: str):
    """Helper to get GitHub connector and validate repo."""
    from app.connectors.factory import create_github_connector

    github = create_github_connector()
    if not github:
        return None, None, {"status": "error", "message": "GitHub connector not configured"}

    if repo_name not in github._repos:
        await github.close()
        return None, None, {
            "status": "error",
            "message": f"Repo '{repo_name}' not in configured repos: {github._repos}",
        }

    repos = await github.fetch_repos()
    repo_data = next((r for r in repos if r["full_name"] == repo_name), None)
    
    if not repo_data:
        await github.close()
        return None, None, {"status": "error", "message": f"Could not fetch repo '{repo_name}' from GitHub"}

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

    github, repo_data, error = await _get_github_and_repo(repo_name)
    if error:
        return error

    try:
        sync_service = SyncService(db, github)
        await sync_service._upsert_repos([repo_data])
        count = await sync_service._sync_single_repo(repo_data, since=None, fetch_details=False)
        await db.commit()
        await github.close()
        return {"status": "success", "message": f"Synced PRs for {repo_name}", "items_synced": count}
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

    github, repo_data, error = await _get_github_and_repo(repo_name)
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

    github, repo_data, error = await _get_github_and_repo(repo_name)
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

    github, repo_data, error = await _get_github_and_repo(repo_name)
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

    github, repo_data, error = await _get_github_and_repo(repo_name)
    if error:
        return error

    try:
        sync_service = SyncService(db, github)
        await sync_service._upsert_repos([repo_data])
        count = await sync_service._sync_single_repo(repo_data, since=None, fetch_details=True)
        await db.commit()
        await github.close()
        return {"status": "success", "message": f"Full sync for {repo_name}", "items_synced": count}
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
async def get_sync_diagnostic() -> SyncDiagnosticResponse:
    """
    Test GitHub API connectivity for each configured repo.
    
    This helps diagnose why a repo might have no data.
    """
    from app.connectors.factory import create_github_connector

    github = create_github_connector()
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


@router.get("/coverage", response_model=SyncCoverageResponse)
async def get_sync_coverage(
    db: AsyncSession = Depends(get_db),
) -> SyncCoverageResponse:
    """Get data coverage statistics for all repositories."""
    # Get connector sync states
    sync_states_result = await db.execute(select(SyncState))
    sync_states = sync_states_result.scalars().all()
    connectors = [
        ConnectorSyncState(
            connector_name=s.connector_name,
            last_sync_at=s.last_sync_at,
            last_full_sync_at=s.last_full_sync_at,
        )
        for s in sync_states
    ]

    # Get all repositories
    repos_result = await db.execute(select(Repository).order_by(Repository.full_name))
    repos = repos_result.scalars().all()

    repository_coverages: list[RepositoryCoverage] = []
    total_prs = 0
    total_commits = 0
    total_runs = 0

    # Pre-compute PRs with commits (for is_complete check)
    prs_with_commits_subq = (
        select(Commit.pr_id)
        .where(Commit.pr_id.isnot(None))
        .distinct()
    )
    
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
        
        # Count PRs with details (have commits)
        prs_with_details_result = await db.execute(
            select(func.count(PullRequest.id))
            .where(PullRequest.repo_id == repo.id)
            .where(PullRequest.id.in_(prs_with_commits_subq))
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

    return SyncCoverageResponse(
        connectors=connectors,
        repositories=repository_coverages,
        total_pull_requests=total_prs,
        total_commits=total_commits,
        total_workflow_runs=total_runs,
    )
