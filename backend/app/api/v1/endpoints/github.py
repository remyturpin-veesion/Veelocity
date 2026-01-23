from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.github import PullRequest, Repository

router = APIRouter(prefix="/github", tags=["github"])


@router.get("/repos")
async def get_repos(db: AsyncSession = Depends(get_db)):
    """List synced repositories."""
    result = await db.execute(select(Repository).order_by(Repository.full_name))
    repos = result.scalars().all()
    return [
        {
            "id": r.id,
            "github_id": r.github_id,
            "name": r.name,
            "full_name": r.full_name,
            "default_branch": r.default_branch,
        }
        for r in repos
    ]


@router.get("/repos/{repo_id}/prs")
async def get_repo_prs(repo_id: int, db: AsyncSession = Depends(get_db)):
    """List pull requests for a repository."""
    result = await db.execute(
        select(PullRequest)
        .where(PullRequest.repo_id == repo_id)
        .order_by(PullRequest.created_at.desc())
    )
    prs = result.scalars().all()
    return [
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


@router.get("/prs/{pr_id}")
async def get_pr_detail(pr_id: int, db: AsyncSession = Depends(get_db)):
    """Get PR with reviews, comments, and commits."""
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
            for r in pr.reviews
        ],
        "comments": [
            {"author_login": c.author_login, "body": c.body, "created_at": c.created_at}
            for c in pr.comments
        ],
        "commits": [
            {"sha": c.sha, "author_login": c.author_login, "message": c.message, "committed_at": c.committed_at}
            for c in pr.commits_rel
        ],
    }
