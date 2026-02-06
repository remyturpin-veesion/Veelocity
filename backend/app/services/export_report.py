"""Build and export a summary report of DORA and development metrics."""

import csv
import io
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.metrics.development import DevelopmentMetricsService
from app.services.metrics.dora import DORAMetricsService
from app.services.insights.recommendation_engine import RecommendationEngine


class AlertsService:
    """Simple alerts based on metric thresholds."""

    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_alerts(
        self,
        start_date: datetime,
        end_date: datetime,
        repo_id: int | None = None,
        repo_ids: list[int] | None = None,
    ) -> list[dict]:
        """Return a list of alert dicts for the given period.

        Currently returns an empty list; threshold-based alerting
        can be added later.
        """
        return []


async def build_report(
    db: AsyncSession,
    start_date: datetime,
    end_date: datetime,
    repo_id: int | None = None,
) -> dict:
    """Assemble a full metrics report for the given period.

    Returns a dict with keys: period, dora, development, alerts, recommendations.
    """
    dora_svc = DORAMetricsService(db)
    dev_svc = DevelopmentMetricsService(db)
    alerts_svc = AlertsService(db)
    rec_engine = RecommendationEngine(db)

    deployment_freq = await dora_svc.get_deployment_frequency(
        start_date, end_date, repo_id=repo_id
    )
    lead_time = await dora_svc.get_lead_time_for_changes(
        start_date, end_date, repo_id=repo_id
    )
    reliability = await dora_svc.get_deployment_reliability(
        start_date, end_date, repo_id=repo_id
    )

    pr_review = await dev_svc.get_pr_review_time(
        start_date, end_date, repo_id=repo_id
    )
    pr_merge = await dev_svc.get_pr_merge_time(
        start_date, end_date, repo_id=repo_id
    )
    throughput = await dev_svc.get_throughput(
        start_date, end_date, repo_id=repo_id
    )

    alerts = await alerts_svc.get_alerts(start_date, end_date, repo_id=repo_id)
    recommendations = await rec_engine.get_recommendations(
        start_date, end_date, repo_id=repo_id
    )

    return {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "dora": {
            "deployment_frequency": {
                "average_per_week": deployment_freq.get("average"),
                "total": deployment_freq.get("total"),
            },
            "lead_time": {
                "average_hours": lead_time.get("average_hours"),
            },
            "deployment_reliability": reliability,
        },
        "development": {
            "pr_review_time": pr_review,
            "pr_merge_time": pr_merge,
            "throughput": {
                "total": throughput.get("total"),
                "average_per_week": throughput.get("average"),
            },
        },
        "alerts": {
            "count": len(alerts),
            "items": alerts,
        },
        "recommendations": {
            "count": len(recommendations),
            "items": [r if isinstance(r, dict) else r.__dict__ for r in recommendations]
            if recommendations
            else [],
        },
    }


def report_to_csv(report: dict) -> str:
    """Convert a report dict to a CSV string with a header row and one data row."""
    row = {
        "period_start": report.get("period", {}).get("start_date", ""),
        "period_end": report.get("period", {}).get("end_date", ""),
        "deploy_freq_avg_per_week": report.get("dora", {})
        .get("deployment_frequency", {})
        .get("average_per_week", ""),
        "deploy_freq_total": report.get("dora", {})
        .get("deployment_frequency", {})
        .get("total", ""),
        "lead_time_avg_hours": report.get("dora", {})
        .get("lead_time", {})
        .get("average_hours", ""),
        "reliability_stability": report.get("dora", {})
        .get("deployment_reliability", {})
        .get("stability_score", ""),
        "reliability_failure_rate": report.get("dora", {})
        .get("deployment_reliability", {})
        .get("failure_rate", ""),
        "reliability_mttr_hours": report.get("dora", {})
        .get("deployment_reliability", {})
        .get("mttr_hours", ""),
        "pr_review_avg_hours": report.get("development", {})
        .get("pr_review_time", {})
        .get("average_hours", ""),
        "pr_review_count": report.get("development", {})
        .get("pr_review_time", {})
        .get("count", ""),
        "pr_merge_avg_hours": report.get("development", {})
        .get("pr_merge_time", {})
        .get("average_hours", ""),
        "pr_merge_count": report.get("development", {})
        .get("pr_merge_time", {})
        .get("count", ""),
        "throughput_total": report.get("development", {})
        .get("throughput", {})
        .get("total", ""),
        "throughput_avg_per_week": report.get("development", {})
        .get("throughput", {})
        .get("average_per_week", ""),
        "alert_count": report.get("alerts", {}).get("count", ""),
        "recommendation_count": report.get("recommendations", {}).get("count", ""),
    }

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=row.keys())
    writer.writeheader()
    writer.writerow(row)
    return output.getvalue()
