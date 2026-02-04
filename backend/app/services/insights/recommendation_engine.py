"""
Smart Recommendations Engine.

Rule-based engine that analyzes DORA and development metrics to produce
prioritized, actionable recommendations.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.metrics.development import DevelopmentMetricsService
from app.services.metrics.dora import DORAMetricsService
from app.services.metrics.pr_health import PRHealthService
from app.services.metrics.reviewer_workload import ReviewerWorkloadService


Priority = str  # "high" | "medium" | "low"


@dataclass
class Recommendation:
    """A single recommendation with priority and context."""

    id: str
    title: str
    description: str
    priority: Priority
    metric_context: str | None = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "priority": self.priority,
            "metric_context": self.metric_context,
        }


class RecommendationEngine:
    """Generates recommendations from current metrics."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_recommendations(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_id: int | None = None,
        repo_ids: list[int] | None = None,
    ) -> list[Recommendation]:
        """
        Compute prioritized recommendations for the given period.

        Rules:
        - Deployment frequency < 1/week → "Deploy more frequently"
        - Lead time > 48h → "Break down PRs"
        - PR review time > 12h → "Set team review SLA"
        - Large PRs detected (size score low) → "Split large PRs"
        - Reviewer bottleneck → "Redistribute reviews"
        """
        recommendations: list[Recommendation] = []

        # 1. Deployment frequency
        dora = DORAMetricsService(self._db)
        dep_freq = await dora.get_deployment_frequency(
            start_date, end_date, "week", repo_id, repo_ids, None
        )
        avg_per_week = dep_freq.get("average") or 0
        if avg_per_week < 1 and dep_freq.get("total", 0) >= 0:
            recommendations.append(
                Recommendation(
                    id="deploy_more_frequently",
                    title="Deploy more frequently",
                    description="Deployment frequency is below 1 per week. Consider automating releases and reducing batch sizes.",
                    priority="high",
                    metric_context=f"Current: {avg_per_week} deployments/week",
                )
            )

        # 2. Lead time
        lead_time = await dora.get_lead_time_for_changes(
            start_date, end_date, repo_id, repo_ids, None
        )
        avg_lead_hours = lead_time.get("average_hours") or 0
        if avg_lead_hours > 48 and lead_time.get("count", 0) > 0:
            recommendations.append(
                Recommendation(
                    id="break_down_prs",
                    title="Break down PRs",
                    description="Lead time for changes exceeds 48 hours. Smaller, more frequent PRs can reduce time to production.",
                    priority="high",
                    metric_context=f"Current average: {avg_lead_hours:.1f}h",
                )
            )

        # 3. PR review time
        dev = DevelopmentMetricsService(self._db)
        review_time = await dev.get_pr_review_time(
            start_date, end_date, repo_id, repo_ids, None
        )
        avg_review_hours = review_time.get("average_hours") or 0
        if avg_review_hours > 12 and review_time.get("count", 0) > 0:
            recommendations.append(
                Recommendation(
                    id="review_sla",
                    title="Set team review SLA",
                    description="Time to first review is over 12 hours. Define a review SLA (e.g. first review within 4h) to unblock authors.",
                    priority="medium",
                    metric_context=f"Current average: {avg_review_hours:.1f}h",
                )
            )

        # 4. Large PRs (from PR health: size score ≤ 12 or lines > 500)
        pr_health = PRHealthService(self._db)
        health_scores = await pr_health.calculate_pr_health(
            start_date, end_date, repo_id=repo_id, repo_ids=repo_ids
        )
        large_pr_count = sum(
            1 for s in health_scores if (s.lines_changed > 500 or s.size_score <= 12)
        )
        if large_pr_count > 0:
            recommendations.append(
                Recommendation(
                    id="split_large_prs",
                    title="Split large PRs",
                    description=f"{large_pr_count} PR(s) are large (>500 lines or low size score). Smaller PRs are reviewed faster and reduce risk.",
                    priority="medium",
                    metric_context=f"{large_pr_count} large PR(s) in period",
                )
            )

        # 5. Reviewer bottleneck
        workload_svc = ReviewerWorkloadService(self._db)
        workloads, summary = await workload_svc.analyze_workload(
            start_date, end_date, repo_id, repo_ids
        )
        if summary.has_bottleneck and summary.bottleneck_reviewers:
            names = ", ".join(summary.bottleneck_reviewers[:3])
            if len(summary.bottleneck_reviewers) > 3:
                names += f" (+{len(summary.bottleneck_reviewers) - 3})"
            recommendations.append(
                Recommendation(
                    id="redistribute_reviews",
                    title="Redistribute reviews",
                    description="Some reviewers handle a large share of reviews. Spread ownership (e.g. CODEOWNERS) to avoid bottlenecks and burnout.",
                    priority="medium",
                    metric_context=f"Bottleneck(s): {names}",
                )
            )

        # Sort: high first, then medium, then low; stable by id
        order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda r: (order.get(r.priority, 3), r.id))
        return recommendations
