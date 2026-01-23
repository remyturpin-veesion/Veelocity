from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.github import PullRequest, Repository
from app.schemas.pagination import (
    PaginatedResponse,
    PaginationParams,
    get_pagination_params,
)

router = APIRouter(prefix="/github", tags=["github"])


@router.get("/repos", response_model=PaginatedResponse[dict[str, Any]])
async def get_repos(
    pagination: PaginationParams = Depends(get_pagination_params),
    db: AsyncSession = Depends(get_db),
):
    """List synced repositories with pagination."""
    # Count total
    count_result = await db.execute(select(func.count(Repository.id)))
    total = count_result.scalar() or 0

    # Fetch page
    result = await db.execute(
        select(Repository)
        .order_by(Repository.full_name)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    repos = result.scalars().all()

    items = [
        {
            "id": r.id,
            "github_id": r.github_id,
            "name": r.name,
            "full_name": r.full_name,
            "default_branch": r.default_branch,
        }
        for r in repos
    ]
    return PaginatedResponse.create(items, total, pagination)


@router.get("/repos/{repo_id}/prs", response_model=PaginatedResponse[dict[str, Any]])
async def get_repo_prs(
    repo_id: int,
    pagination: PaginationParams = Depends(get_pagination_params),
    db: AsyncSession = Depends(get_db),
):
    """List pull requests for a repository with pagination."""
    # Count total for this repo
    count_result = await db.execute(
        select(func.count(PullRequest.id)).where(PullRequest.repo_id == repo_id)
    )
    total = count_result.scalar() or 0

    # Fetch page
    result = await db.execute(
        select(PullRequest)
        .where(PullRequest.repo_id == repo_id)
        .order_by(PullRequest.created_at.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    prs = result.scalars().all()

    items = [
        {
            "id": pr.id,
            "number": pr.number,
            "title": pr.title,
            "state": pr.state,
            "author_login": pr.author_login,
            "created_at": pr.created_at,
            "merged_at": pr.merged_at,
        }
        for pr in prs
    ]
    return PaginatedResponse.create(items, total, pagination)


@router.get("/prs/{pr_id}")
async def get_pr_detail(
    pr_id: int,
    max_reviews: int = 50,
    max_comments: int = 50,
    max_commits: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """
    Get PR with reviews, comments, and commits.
    
    Related items are limited by default to prevent excessive data loading.
    Use max_reviews, max_comments, max_commits to adjust (capped at 100 each).
    """
    # Enforce hard caps
    max_reviews = min(max_reviews, 100)
    max_comments = min(max_comments, 100)
    max_commits = min(max_commits, 100)

    result = await db.execute(
        select(PullRequest)
        .where(PullRequest.id == pr_id)
        .options(
            selectinload(PullRequest.reviews),
            selectinload(PullRequest.comments),
            selectinload(PullRequest.commits_rel),
        )
    )
    pr = result.scalar_one_or_none()
    if not pr:
        return {"error": "PR not found"}

    # Apply limits to related items
    reviews = sorted(pr.reviews, key=lambda r: r.submitted_at or "", reverse=True)[:max_reviews]
    comments = sorted(pr.comments, key=lambda c: c.created_at or "", reverse=True)[:max_comments]
    commits = sorted(pr.commits_rel, key=lambda c: c.committed_at or "", reverse=True)[:max_commits]

    return {
        "id": pr.id,
        "number": pr.number,
        "title": pr.title,
        "body": pr.body,
        "state": pr.state,
        "draft": pr.draft,
        "author_login": pr.author_login,
        "created_at": pr.created_at,
        "merged_at": pr.merged_at,
        "additions": pr.additions,
        "deletions": pr.deletions,
        "reviews": [
            {"reviewer_login": r.reviewer_login, "state": r.state, "submitted_at": r.submitted_at}
            for r in reviews
        ],
        "comments": [
            {"author_login": c.author_login, "body": c.body, "created_at": c.created_at}
            for c in comments
        ],
        "commits": [
            {"sha": c.sha, "author_login": c.author_login, "message": c.message, "committed_at": c.committed_at}
            for c in commits
        ],
        "_limits": {
            "reviews": {"shown": len(reviews), "total": len(pr.reviews)},
            "comments": {"shown": len(comments), "total": len(pr.comments)},
            "commits": {"shown": len(commits), "total": len(pr.commits_rel)},
        },
    }
