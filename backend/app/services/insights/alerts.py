"""Alert Rules Engine.

Evaluates fixed rules against current metrics and returns active alerts.
Single-user; rules are defined in code (no CRUD). Alerts surface when
metrics cross configured thresholds.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.metrics.development import DevelopmentMetricsService
from app.services.metrics.dora import DORAMetricsService
from app.services.metrics.reviewer_workload import ReviewerWorkloadService


@dataclass
class Alert:
    """A single active alert from a rule evaluation."""

    rule_id: str
    title: str
    message: str
    severity: str  # "high" | "medium" | "low"
    metric: str
    current_value: str | float
    threshold: str

    def to_dict(self) -> dict:
        return {
            "rule_id": self.rule_id,
            "title": self.title,
            "message": self.message,
            "severity": self.severity,
            "metric": self.metric,
            "current_value": self.current_value,
            "threshold": self.threshold,
        }


class AlertsService:
    """Evaluates alert rules against current metrics."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_alerts(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_id: int | None = None,
    ) -> list[Alert]:
        """
        Evaluate rules and return active alerts for the given period.

        Rules:
        - Deployment frequency < 1/week → high
        - Lead time > 48h → high
        - PR review time > 24h → medium
        - Throughput 0 (no merged PRs) → medium
        - Reviewer bottleneck → medium
        """
        alerts: list[Alert] = []
        dora = DORAMetricsService(self._db)
        dev = DevelopmentMetricsService(self._db)

        # 1. Deployment frequency < 1/week
        dep_freq = await dora.get_deployment_frequency(
            start_date, end_date, "week", repo_id, None
        )
        avg_per_week = dep_freq.get("average") or 0
        if avg_per_week < 1:
            alerts.append(
                Alert(
                    rule_id="deployment_frequency_low",
                    title="Deployment frequency below 1/week",
                    message="Deployments are less than once per week. Consider automating releases.",
                    severity="high",
                    metric="deployment_frequency",
                    current_value=round(avg_per_week, 2),
                    threshold="≥1/week",
                )
            )

        # 2. Lead time > 48h
        lead_time = await dora.get_lead_time_for_changes(
            start_date, end_date, repo_id, None
        )
        avg_lead_hours = lead_time.get("average_hours") or 0
        count_lead = lead_time.get("count") or 0
        if count_lead > 0 and avg_lead_hours > 48:
            alerts.append(
                Alert(
                    rule_id="lead_time_high",
                    title="Lead time over 48 hours",
                    message="Time from first commit to deployment exceeds 48h. Smaller PRs can help.",
                    severity="high",
                    metric="lead_time",
                    current_value=round(avg_lead_hours, 1),
                    threshold="≤48h",
                )
            )

        # 3. PR review time > 24h
        review_time = await dev.get_pr_review_time(
            start_date, end_date, repo_id, None
        )
        avg_review_hours = review_time.get("average_hours") or 0
        count_review = review_time.get("count") or 0
        if count_review > 0 and avg_review_hours > 24:
            alerts.append(
                Alert(
                    rule_id="pr_review_time_high",
                    title="PR review time over 24 hours",
                    message="Time to first review exceeds 24h. Set a review SLA to unblock authors.",
                    severity="medium",
                    metric="pr_review_time",
                    current_value=round(avg_review_hours, 1),
                    threshold="≤24h",
                )
            )

        # 4. Throughput 0
        throughput = await dev.get_throughput(
            start_date, end_date, "week", repo_id, None
        )
        total_merged = throughput.get("total") or 0
        if total_merged == 0:
            alerts.append(
                Alert(
                    rule_id="throughput_zero",
                    title="No PRs merged in period",
                    message="No pull requests were merged. Check pipeline or filters.",
                    severity="medium",
                    metric="throughput",
                    current_value=0,
                    threshold=">0",
                )
            )

        # 5. Reviewer bottleneck
        workload_svc = ReviewerWorkloadService(self._db)
        workloads, summary = await workload_svc.analyze_workload(
            start_date, end_date, repo_id
        )
        if summary.has_bottleneck and summary.bottleneck_reviewers:
            names = ", ".join(summary.bottleneck_reviewers[:3])
            if len(summary.bottleneck_reviewers) > 3:
                names += f" (+{len(summary.bottleneck_reviewers) - 3})"
            alerts.append(
                Alert(
                    rule_id="reviewer_bottleneck",
                    title="Reviewer bottleneck detected",
                    message="Some reviewers handle a large share of reviews. Consider redistributing.",
                    severity="medium",
                    metric="reviewer_workload",
                    current_value=names,
                    threshold="—",
                )
            )

        # Sort: high first, then medium, then low; stable by rule_id
        order = {"high": 0, "medium": 1, "low": 2}
        alerts.sort(key=lambda a: (order.get(a.severity, 3), a.rule_id))
        return alerts
