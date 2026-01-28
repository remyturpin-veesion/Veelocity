"""
Reviewer Workload Analysis Service.

Analyzes review distribution to identify bottlenecks and uneven workload.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.github import PRReview


@dataclass
class ReviewerWorkload:
    """Workload data for a single reviewer."""

    reviewer_login: str
    review_count: int
    avg_reviews_per_week: float
    percentage_of_total: float
    is_bottleneck: bool  # True if handling >40% of reviews
    is_under_utilized: bool  # True if handling <10% when team has 3+ reviewers

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "reviewer_login": self.reviewer_login,
            "review_count": self.review_count,
            "avg_reviews_per_week": round(self.avg_reviews_per_week, 2),
            "percentage_of_total": round(self.percentage_of_total, 2),
            "is_bottleneck": self.is_bottleneck,
            "is_under_utilized": self.is_under_utilized,
        }


@dataclass
class WorkloadSummary:
    """Summary statistics for review workload."""

    total_reviews: int
    unique_reviewers: int
    avg_reviews_per_reviewer: float
    max_reviews: int
    min_reviews: int
    gini_coefficient: float  # Measure of inequality (0 = perfect equality, 1 = total inequality)
    has_bottleneck: bool
    bottleneck_reviewers: list[str]

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "total_reviews": self.total_reviews,
            "unique_reviewers": self.unique_reviewers,
            "avg_reviews_per_reviewer": round(self.avg_reviews_per_reviewer, 2),
            "max_reviews": self.max_reviews,
            "min_reviews": self.min_reviews,
            "gini_coefficient": round(self.gini_coefficient, 3),
            "has_bottleneck": self.has_bottleneck,
            "bottleneck_reviewers": self.bottleneck_reviewers,
        }


class ReviewerWorkloadService:
    """Service for analyzing reviewer workload distribution."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def analyze_workload(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_id: int | None = None,
    ) -> tuple[list[ReviewerWorkload], WorkloadSummary]:
        """
        Analyze reviewer workload distribution.

        Returns:
            Tuple of (workload_list, summary)
        """
        # Query review counts per reviewer
        query = (
            select(
                PRReview.reviewer_login,
                func.count(PRReview.id).label("review_count"),
            )
            .where(PRReview.submitted_at >= start_date)
            .where(PRReview.submitted_at <= end_date)
            .group_by(PRReview.reviewer_login)
        )

        if repo_id:
            # Join with pull_requests to filter by repo
            from app.models.github import PullRequest

            query = query.join(
                PullRequest, PRReview.pr_id == PullRequest.id
            ).where(PullRequest.repo_id == repo_id)

        result = await self.db.execute(query)
        rows = result.all()

        if not rows:
            # No reviews in period
            return [], WorkloadSummary(
                total_reviews=0,
                unique_reviewers=0,
                avg_reviews_per_reviewer=0,
                max_reviews=0,
                min_reviews=0,
                gini_coefficient=0,
                has_bottleneck=False,
                bottleneck_reviewers=[],
            )

        # Calculate totals
        total_reviews = sum(row.review_count for row in rows)
        unique_reviewers = len(rows)

        # Calculate workload per reviewer
        days_in_period = (end_date - start_date).days or 1
        weeks_in_period = days_in_period / 7

        workloads = []
        for row in rows:
            count = row.review_count
            percentage = (count / total_reviews) * 100
            avg_per_week = count / weeks_in_period

            # Identify bottlenecks (>40% of reviews)
            is_bottleneck = percentage > 40

            # Identify under-utilized (< 10% when team has 3+ reviewers)
            is_under_utilized = unique_reviewers >= 3 and percentage < 10

            workloads.append(
                ReviewerWorkload(
                    reviewer_login=row.reviewer_login,
                    review_count=count,
                    avg_reviews_per_week=avg_per_week,
                    percentage_of_total=percentage,
                    is_bottleneck=is_bottleneck,
                    is_under_utilized=is_under_utilized,
                )
            )

        # Sort by review count (most reviews first)
        workloads.sort(key=lambda w: w.review_count, reverse=True)

        # Calculate summary
        review_counts = [w.review_count for w in workloads]
        summary = WorkloadSummary(
            total_reviews=total_reviews,
            unique_reviewers=unique_reviewers,
            avg_reviews_per_reviewer=total_reviews / unique_reviewers,
            max_reviews=max(review_counts),
            min_reviews=min(review_counts),
            gini_coefficient=self._calculate_gini_coefficient(review_counts),
            has_bottleneck=any(w.is_bottleneck for w in workloads),
            bottleneck_reviewers=[
                w.reviewer_login for w in workloads if w.is_bottleneck
            ],
        )

        return workloads, summary

    def _calculate_gini_coefficient(self, values: list[int]) -> float:
        """
        Calculate Gini coefficient to measure inequality.

        0 = perfect equality (everyone does same amount)
        1 = total inequality (one person does everything)

        Values around 0.3-0.4 are typical for healthy teams.
        Values above 0.5 indicate significant imbalance.
        """
        if not values or len(values) == 1:
            return 0.0

        sorted_values = sorted(values)
        n = len(sorted_values)
        cumsum = 0

        for i, value in enumerate(sorted_values):
            cumsum += (2 * (i + 1) - n - 1) * value

        return cumsum / (n * sum(sorted_values))
