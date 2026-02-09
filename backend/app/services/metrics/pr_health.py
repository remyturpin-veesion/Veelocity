"""
PR Health Scoring Service.

Calculates a health score (0-100) for each pull request based on multiple factors:
- Review rounds (CHANGES_REQUESTED count)
- Comment volume (excessive discussion)
- PR size (lines changed)
- Time to first review
- Time to merge
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.github import PullRequest, PRReview, PRComment


def _repo_filter(repo_id: int | None, repo_ids: list[int] | None) -> list[int] | None:
    """Resolve repo filter: repo_ids if provided, else [repo_id] if repo_id, else None."""
    if repo_ids is not None:
        return repo_ids
    if repo_id is not None:
        return [repo_id]
    return None


HealthCategory = Literal["excellent", "good", "fair", "poor"]


@dataclass
class PRHealthScore:
    """Health score for a pull request."""

    pr_id: int  # Internal DB id for linking to PR detail
    pr_number: int
    pr_title: str
    repository: str
    author: str
    created_at: datetime
    merged_at: datetime | None

    # Overall score
    health_score: int  # 0-100
    health_category: HealthCategory

    # Component scores
    review_score: int  # 0-25
    comment_score: int  # 0-25
    size_score: int  # 0-25
    time_score: int  # 0-25

    # Metrics
    review_rounds: int
    comment_count: int
    lines_changed: int
    hours_to_first_review: float | None
    hours_to_merge: float | None

    # Issues identified
    issues: list[str]

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "pr_id": self.pr_id,
            "pr_number": self.pr_number,
            "pr_title": self.pr_title,
            "repository": self.repository,
            "author": self.author,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "merged_at": self.merged_at.isoformat() if self.merged_at else None,
            "health_score": self.health_score,
            "health_category": self.health_category,
            "component_scores": {
                "review": self.review_score,
                "comment": self.comment_score,
                "size": self.size_score,
                "time": self.time_score,
            },
            "metrics": {
                "review_rounds": self.review_rounds,
                "comment_count": self.comment_count,
                "lines_changed": self.lines_changed,
                "hours_to_first_review": self.hours_to_first_review,
                "hours_to_merge": self.hours_to_merge,
            },
            "issues": self.issues,
        }


class PRHealthService:
    """Service for calculating PR health scores."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate_pr_health(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_id: int | None = None,
        repo_ids: list[int] | None = None,
        author_login: str | None = None,
        min_score: int | None = None,
        max_score: int | None = None,
    ) -> list[PRHealthScore]:
        """
        Calculate health scores for all PRs in the time period.

        Args:
            start_date: Start of period
            end_date: End of period
            repo_id: Optional repository filter
            author_login: Optional author filter
            min_score: Optional minimum score filter
            max_score: Optional maximum score filter

        Returns:
            List of PR health scores, sorted by score (worst first)
        """
        # Build query (eager load repository to avoid lazy load in async context)
        query = (
            select(PullRequest)
            .options(selectinload(PullRequest.repository))
            .where(PullRequest.created_at >= start_date)
            .where(PullRequest.created_at <= end_date)
            .where(PullRequest.state == "closed")
        )

        repo_filter = _repo_filter(repo_id, repo_ids)
        if repo_filter is not None:
            query = query.where(PullRequest.repo_id.in_(repo_filter))

        if author_login:
            query = query.where(PullRequest.author_login == author_login)

        result = await self.db.execute(query)
        prs = result.scalars().all()

        # Calculate scores for each PR
        health_scores = []
        for pr in prs:
            score = await self._calculate_single_pr_health(pr)

            # Apply score filters if provided
            if min_score is not None and score.health_score < min_score:
                continue
            if max_score is not None and score.health_score > max_score:
                continue

            health_scores.append(score)

        # Sort by health score (worst first)
        health_scores.sort(key=lambda x: x.health_score)

        return health_scores

    async def get_health_for_pr(self, pr_id: int) -> PRHealthScore | None:
        """
        Calculate health score for a single PR by id.

        Returns None if PR not found or not closed.
        """
        query = (
            select(PullRequest)
            .options(selectinload(PullRequest.repository))
            .where(PullRequest.id == pr_id)
            .where(PullRequest.state == "closed")
        )
        result = await self.db.execute(query)
        pr = result.scalar_one_or_none()
        if not pr:
            return None
        return await self._calculate_single_pr_health(pr)

    async def _calculate_single_pr_health(self, pr: PullRequest) -> PRHealthScore:
        """Calculate health score for a single PR."""
        # Get reviews and comments
        reviews_query = select(PRReview).where(PRReview.pr_id == pr.id)
        reviews_result = await self.db.execute(reviews_query)
        reviews = reviews_result.scalars().all()

        comments_query = select(PRComment).where(PRComment.pr_id == pr.id)
        comments_result = await self.db.execute(comments_query)
        comments = comments_result.scalars().all()

        # Calculate component scores
        review_score, review_rounds = self._calculate_review_score(reviews)
        comment_score, comment_count = self._calculate_comment_score(comments)
        size_score, lines_changed = self._calculate_size_score(pr)
        time_score, hours_to_first_review, hours_to_merge = self._calculate_time_score(
            pr, reviews
        )

        # Total score (0-100)
        health_score = review_score + comment_score + size_score + time_score

        # Determine category
        health_category = self._get_health_category(health_score)

        # Identify issues
        issues = self._identify_issues(
            review_rounds,
            comment_count,
            lines_changed,
            hours_to_first_review,
            hours_to_merge,
        )

        return PRHealthScore(
            pr_id=pr.id,
            pr_number=pr.number,
            pr_title=pr.title,
            repository=pr.repository.full_name if pr.repository else "unknown",
            author=pr.author_login,
            created_at=pr.created_at,
            merged_at=pr.merged_at,
            health_score=health_score,
            health_category=health_category,
            review_score=review_score,
            comment_score=comment_score,
            size_score=size_score,
            time_score=time_score,
            review_rounds=review_rounds,
            comment_count=comment_count,
            lines_changed=lines_changed,
            hours_to_first_review=hours_to_first_review,
            hours_to_merge=hours_to_merge,
            issues=issues,
        )

    def _calculate_review_score(self, reviews: list[PRReview]) -> tuple[int, int]:
        """
        Calculate review score (0-25).

        Penalizes multiple CHANGES_REQUESTED rounds.

        Returns:
            (score, review_rounds_count)
        """
        changes_requested = sum(1 for r in reviews if r.state == "CHANGES_REQUESTED")

        # Scoring:
        # 0 changes_requested = 25 points (excellent)
        # 1 changes_requested = 20 points (good)
        # 2 changes_requested = 12 points (fair)
        # 3+ changes_requested = 5 points (poor)
        if changes_requested == 0:
            score = 25
        elif changes_requested == 1:
            score = 20
        elif changes_requested == 2:
            score = 12
        else:
            score = 5

        return score, changes_requested

    def _calculate_comment_score(self, comments: list[PRComment]) -> tuple[int, int]:
        """
        Calculate comment score (0-25).

        Penalizes excessive discussion.

        Returns:
            (score, comment_count)
        """
        comment_count = len(comments)

        # Scoring:
        # 0-5 comments = 25 points (excellent)
        # 6-15 comments = 20 points (good)
        # 16-30 comments = 12 points (fair)
        # 31+ comments = 5 points (poor - too much discussion)
        if comment_count <= 5:
            score = 25
        elif comment_count <= 15:
            score = 20
        elif comment_count <= 30:
            score = 12
        else:
            score = 5

        return score, comment_count

    def _calculate_size_score(self, pr: PullRequest) -> tuple[int, int]:
        """
        Calculate size score (0-25).

        Penalizes large PRs (harder to review).

        Returns:
            (score, lines_changed)
        """
        lines_changed = (pr.additions or 0) + (pr.deletions or 0)

        # Scoring:
        # 0-200 lines = 25 points (excellent - easy to review)
        # 201-500 lines = 20 points (good)
        # 501-1000 lines = 12 points (fair - getting large)
        # 1001+ lines = 5 points (poor - too large)
        if lines_changed <= 200:
            score = 25
        elif lines_changed <= 500:
            score = 20
        elif lines_changed <= 1000:
            score = 12
        else:
            score = 5

        return score, lines_changed

    def _calculate_time_score(
        self, pr: PullRequest, reviews: list[PRReview]
    ) -> tuple[int, float | None, float | None]:
        """
        Calculate time score (0-25).

        Rewards quick review and merge times.

        Returns:
            (score, hours_to_first_review, hours_to_merge)
        """
        score = 0
        hours_to_first_review = None
        hours_to_merge = None

        # Time to first review (0-12 points)
        if reviews:
            first_review = min(reviews, key=lambda r: r.submitted_at)
            delta = first_review.submitted_at - pr.created_at
            hours_to_first_review = delta.total_seconds() / 3600

            # 0-3 hours = 12 points (excellent)
            # 4-12 hours = 9 points (good - same day)
            # 13-24 hours = 6 points (fair)
            # 25+ hours = 3 points (poor)
            if hours_to_first_review <= 3:
                score += 12
            elif hours_to_first_review <= 12:
                score += 9
            elif hours_to_first_review <= 24:
                score += 6
            else:
                score += 3

        # Time to merge (0-13 points)
        if pr.merged_at:
            delta = pr.merged_at - pr.created_at
            hours_to_merge = delta.total_seconds() / 3600

            # 0-24 hours = 13 points (excellent)
            # 25-72 hours = 10 points (good - 1-3 days)
            # 73-168 hours = 6 points (fair - up to 1 week)
            # 169+ hours = 3 points (poor - over 1 week)
            if hours_to_merge <= 24:
                score += 13
            elif hours_to_merge <= 72:
                score += 10
            elif hours_to_merge <= 168:
                score += 6
            else:
                score += 3

        return score, hours_to_first_review, hours_to_merge

    def _get_health_category(self, score: int) -> HealthCategory:
        """Determine health category from score."""
        if score >= 85:
            return "excellent"
        elif score >= 70:
            return "good"
        elif score >= 50:
            return "fair"
        else:
            return "poor"

    def _identify_issues(
        self,
        review_rounds: int,
        comment_count: int,
        lines_changed: int,
        hours_to_first_review: float | None,
        hours_to_merge: float | None,
    ) -> list[str]:
        """Identify specific issues with the PR."""
        issues = []

        if review_rounds >= 3:
            issues.append(f"Multiple review rounds ({review_rounds})")

        if comment_count > 30:
            issues.append(f"Excessive discussion ({comment_count} comments)")

        if lines_changed > 1000:
            issues.append(f"Very large PR ({lines_changed} lines)")

        if hours_to_first_review and hours_to_first_review > 24:
            issues.append(f"Slow first review ({hours_to_first_review:.1f}h)")

        if hours_to_merge and hours_to_merge > 168:
            issues.append(f"Slow to merge ({hours_to_merge / 24:.1f} days)")

        return issues

    async def get_health_summary(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_id: int | None = None,
        repo_ids: list[int] | None = None,
    ) -> dict:
        """
        Get summary statistics for PR health in the period.

        Returns:
            Dictionary with counts by category and average score
        """
        health_scores = await self.calculate_pr_health(
            start_date, end_date, repo_id=repo_id, repo_ids=repo_ids
        )

        if not health_scores:
            return {
                "total_prs": 0,
                "average_score": 0,
                "by_category": {
                    "excellent": 0,
                    "good": 0,
                    "fair": 0,
                    "poor": 0,
                },
            }

        # Count by category
        category_counts = {
            "excellent": 0,
            "good": 0,
            "fair": 0,
            "poor": 0,
        }

        total_score = 0
        for score in health_scores:
            category_counts[score.health_category] += 1
            total_score += score.health_score

        return {
            "total_prs": len(health_scores),
            "average_score": total_score / len(health_scores),
            "by_category": category_counts,
        }
