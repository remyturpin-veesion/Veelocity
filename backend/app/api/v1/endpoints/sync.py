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
    
    Use this to re-sync all data from scratch.
    """
    from app.services.scheduler import run_full_sync

    try:
        await run_full_sync()
        return {"status": "success", "message": "Full sync completed"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


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
