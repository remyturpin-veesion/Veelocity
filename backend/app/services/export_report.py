"""Export report: aggregate metrics, alerts, and recommendations for a period."""

import csv
import io
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.insights.alerts import AlertsService
from app.services.insights.recommendation_engine import RecommendationEngine
from app.services.metrics.development import DevelopmentMetricsService
from app.services.metrics.dora import DORAMetricsService


async def build_report(
    db: AsyncSession,
    start_date: datetime,
    end_date: datetime,
    repo_id: int | None = None,
) -> dict:
    """
    Build a summary report for the given period.

    Aggregates DORA metrics, development metrics, deployment reliability,
    alerts, and recommendations. Returns a dict suitable for JSON export
    or CSV flattening.
    """
    dora = DORAMetricsService(db)
    dev = DevelopmentMetricsService(db)
    alerts_svc = AlertsService(db)
    rec_engine = RecommendationEngine(db)

    dep_freq = await dora.get_deployment_frequency(
        start_date, end_date, "week", repo_id, None
    )
    lead_time = await dora.get_lead_time_for_changes(
        start_date, end_date, repo_id, None
    )
    reliability = await dora.get_deployment_reliability(
        start_date, end_date, repo_id
    )
    review_time = await dev.get_pr_review_time(
        start_date, end_date, repo_id, None
    )
    merge_time = await dev.get_pr_merge_time(
        start_date, end_date, repo_id, None
    )
    throughput = await dev.get_throughput(
        start_date, end_date, "week", repo_id, None
    )
    alerts = await alerts_svc.get_alerts(
        start_date=start_date,
        end_date=end_date,
        repo_id=repo_id,
    )
    recommendations = await rec_engine.get_recommendations(
        start_date, end_date, repo_id
    )

    return {
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        "dora": {
            "deployment_frequency": {
                "average_per_week": dep_freq.get("average", 0),
                "total_deployments": dep_freq.get("total", 0),
            },
            "lead_time": {
                "average_hours": lead_time.get("average_hours", 0),
                "median_hours": lead_time.get("median_hours"),
                "count": lead_time.get("count", 0),
            },
            "deployment_reliability": {
                "stability_score": reliability.get("stability_score"),
                "failure_rate": reliability.get("failure_rate"),
                "mttr_hours": reliability.get("mttr_hours"),
                "total_runs": reliability.get("total_runs"),
            },
        },
        "development": {
            "pr_review_time": {
                "average_hours": review_time.get("average_hours", 0),
                "count": review_time.get("count", 0),
            },
            "pr_merge_time": {
                "average_hours": merge_time.get("average_hours", 0),
                "count": merge_time.get("count", 0),
            },
            "throughput": {
                "total": throughput.get("total", 0),
                "average_per_week": throughput.get("average", 0),
            },
        },
        "alerts": {
            "count": len(alerts),
            "items": [a.to_dict() for a in alerts],
        },
        "recommendations": {
            "count": len(recommendations),
            "items": [r.to_dict() for r in recommendations],
        },
    }


def report_to_csv(report: dict) -> str:
    """
    Flatten report to a single summary row in CSV format.

    Returns CSV string with header row and one data row.
    """
    p = report.get("period", {})
    dora = report.get("dora", {})
    df = dora.get("deployment_frequency", {})
    lt = dora.get("lead_time", {})
    rel = dora.get("deployment_reliability", {})
    dev = report.get("development", {})
    rt = dev.get("pr_review_time", {})
    mt = dev.get("pr_merge_time", {})
    tp = dev.get("throughput", {})
    alerts = report.get("alerts", {})
    recs = report.get("recommendations", {})

    headers = [
        "period_start",
        "period_end",
        "deployment_frequency_avg_per_week",
        "lead_time_avg_hours",
        "deployment_stability_score",
        "deployment_failure_rate_pct",
        "deployment_mttr_hours",
        "pr_review_time_avg_hours",
        "pr_merge_time_avg_hours",
        "throughput_total",
        "throughput_avg_per_week",
        "alert_count",
        "recommendation_count",
    ]
    row = [
        p.get("start_date", ""),
        p.get("end_date", ""),
        df.get("average_per_week", ""),
        lt.get("average_hours", ""),
        rel.get("stability_score", ""),
        rel.get("failure_rate", ""),
        rel.get("mttr_hours", ""),
        rt.get("average_hours", ""),
        mt.get("average_hours", ""),
        tp.get("total", ""),
        tp.get("average_per_week", ""),
        alerts.get("count", 0),
        recs.get("count", 0),
    ]
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(headers)
    writer.writerow(row)
    return out.getvalue()
