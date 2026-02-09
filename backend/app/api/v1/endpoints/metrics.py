"""DORA and development metrics API endpoints."""

import statistics
from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.github import PullRequest, Workflow, WorkflowRun
from app.models.recommendation import RecommendationRun
from app.services.metrics.anomalies import AnomalyDetectionService
from app.services.metrics.benchmarks import BenchmarkService
from app.services.metrics.comparison import ComparisonService
from app.services.metrics.correlation import CorrelationService
from app.services.metrics.development import DevelopmentMetricsService
from app.services.metrics.dora import DORAMetricsService
from app.services.insights.recommendation_engine import RecommendationEngine
from app.services.metrics.pr_health import PRHealthService
from app.services.metrics.linear_metrics import LinearMetricsService
from app.services.metrics.reviewer_workload import ReviewerWorkloadService

router = APIRouter(prefix="/metrics", tags=["metrics"])


def get_default_date_range() -> tuple[datetime, datetime]:
    """Default to last 30 days."""
    end = datetime.utcnow()
    start = end - timedelta(days=30)
    return start, end


@router.get("/quick-overview")
async def get_quick_overview(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_ids: list[int] | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Quick overview stats for the dashboard sidebar.

    Returns:
    - prs_in_queue: count of currently open, non-draft PRs
    - median_ci_duration_seconds: median CI pipeline duration (completed runs in period)
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    # --- PRs in queue (open, non-draft) ---
    pr_query = select(func.count(PullRequest.id)).where(
        PullRequest.state == "open",
        PullRequest.draft == False,  # noqa: E712
    )
    if repo_ids:
        pr_query = pr_query.where(PullRequest.repo_id.in_(repo_ids))
    pr_result = await db.execute(pr_query)
    prs_in_queue = pr_result.scalar() or 0

    # --- Median CI pipeline duration (all completed workflow runs in period) ---
    run_query = select(WorkflowRun.started_at, WorkflowRun.completed_at).where(
        and_(
            WorkflowRun.status == "completed",
            WorkflowRun.started_at.isnot(None),
            WorkflowRun.completed_at.isnot(None),
            WorkflowRun.completed_at >= start_date,
            WorkflowRun.completed_at <= end_date,
        )
    )
    if repo_ids:
        run_query = run_query.join(Workflow).where(Workflow.repo_id.in_(repo_ids))
    run_result = await db.execute(run_query)
    rows = run_result.all()

    median_ci_duration_seconds: float | None = None
    if rows:
        durations = [
            (row.completed_at - row.started_at).total_seconds()
            for row in rows
            if row.started_at and row.completed_at
        ]
        if durations:
            median_ci_duration_seconds = round(statistics.median(durations), 1)

    return {
        "prs_in_queue": prs_in_queue,
        "median_ci_duration_seconds": median_ci_duration_seconds,
    }


@router.get("/dora")
async def get_dora_metrics(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all DORA metrics.

    Query params:
    - start_date: Start of period (default: 30 days ago)
    - end_date: End of period (default: now)
    - period: Grouping period - day, week, or month (default: week)
    - repo_id: Optional repository filter
    - author_login: Optional developer filter (by GitHub login)
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)

    deployment_freq = await service.get_deployment_frequency(
        start_date, end_date, period, repo_id, repo_ids, author_login
    )
    lead_time = await service.get_lead_time_for_changes(
        start_date, end_date, repo_id, repo_ids, author_login
    )

    return {
        "deployment_frequency": deployment_freq,
        "lead_time_for_changes": lead_time,
    }


@router.get("/dora/deployment-frequency")
async def get_deployment_frequency(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    author_login: str | None = None,
    include_trend: bool = False,
    include_benchmark: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Get deployment frequency metric.

    Measures how often successful deployments occur.

    Query params:
    - include_trend: If true, includes period-over-period trend comparison
    - include_benchmark: If true, includes industry benchmark comparison
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)
    result = await service.get_deployment_frequency(
        start_date, end_date, period, repo_id, repo_ids, author_login
    )

    # Add trend data if requested
    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Get previous period data
        prev_result = await service.get_deployment_frequency(
            prev_start, prev_end, period, repo_id, repo_ids, author_login
        )

        # Calculate trend
        trend = await comparison_service.calculate_trend(
            metric_name="deployment_frequency",
            current_period=(start_date, end_date),
            previous_period=(prev_start, prev_end),
            current_value=result["average"],
            previous_value=prev_result["average"],
        )

        result["trend"] = trend.to_dict()

    # Add benchmark data if requested
    if include_benchmark:
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(
            result["average"]
        )
        result["benchmark"] = benchmark.to_dict()

    return result


@router.get("/dora/deployment-reliability")
async def get_deployment_reliability(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    include_trend: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Get deployment reliability metrics.

    Returns failure rate (% of runs that failed), MTTR (mean time to recovery
    in hours), and stability score (0–100).

    Query params:
    - include_trend: If true, includes period-over-period trend for failure_rate
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)
    result = await service.get_deployment_reliability(
        start_date, end_date, repo_id, repo_ids
    )

    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )
        prev_result = await service.get_deployment_reliability(
            prev_start, prev_end, repo_id, repo_ids
        )
        trend = await comparison_service.calculate_trend(
            metric_name="failure_rate",
            current_period=(start_date, end_date),
            previous_period=(prev_start, prev_end),
            current_value=result["failure_rate"],
            previous_value=prev_result["failure_rate"],
        )
        result["trend"] = trend.to_dict()

    return result


@router.get("/dora/lead-time")
async def get_lead_time(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    author_login: str | None = None,
    include_trend: bool = False,
    include_benchmark: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Get lead time for changes metric.

    Measures time from first commit to deployment.

    Query params:
    - include_trend: If true, includes period-over-period trend comparison
    - include_benchmark: If true, includes industry benchmark comparison
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)
    result = await service.get_lead_time_for_changes(
        start_date, end_date, repo_id, repo_ids, author_login
    )

    # Add trend data if requested
    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Get previous period data
        prev_result = await service.get_lead_time_for_changes(
            prev_start, prev_end, repo_id, repo_ids, author_login
        )

        # Calculate trend
        trend = await comparison_service.calculate_trend(
            metric_name="lead_time",
            current_period=(start_date, end_date),
            previous_period=(prev_start, prev_end),
            current_value=result["average_hours"],
            previous_value=prev_result["average_hours"],
        )

        result["trend"] = trend.to_dict()

    # Add benchmark data if requested
    if include_benchmark:
        benchmark = BenchmarkService.get_lead_time_benchmark(result["average_hours"])
        result["benchmark"] = benchmark.to_dict()

    return result


@router.get("/dora/lead-time/by-period")
async def get_lead_time_by_period(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "day",
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get lead time median per period (for charts).

    Returns list of {"period": str, "median_hours": float} sorted by period.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DORAMetricsService(db)
    return await service.get_lead_time_by_period(
        start_date, end_date, period, repo_id, repo_ids, author_login
    )


# ============================================================================
# Development Metrics
# ============================================================================


@router.get("/development")
async def get_development_metrics(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all development metrics.

    Includes PR review time, merge time, cycle time, and throughput.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DevelopmentMetricsService(db)

    pr_review_time = await service.get_pr_review_time(
        start_date, end_date, repo_id, repo_ids, author_login
    )
    pr_merge_time = await service.get_pr_merge_time(
        start_date, end_date, repo_id, repo_ids, author_login
    )
    cycle_time = await service.get_cycle_time(start_date, end_date)
    throughput = await service.get_throughput(
        start_date, end_date, period, repo_id, repo_ids, author_login
    )

    return {
        "pr_review_time": pr_review_time,
        "pr_merge_time": pr_merge_time,
        "cycle_time": cycle_time,
        "throughput": throughput,
    }


@router.get("/development/pr-review-time")
async def get_pr_review_time(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    author_login: str | None = None,
    include_trend: bool = False,
    include_benchmark: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Get PR review time metric.

    Measures time from PR opened to first review.

    Query params:
    - include_trend: If true, includes period-over-period trend comparison
    - include_benchmark: If true, includes industry benchmark comparison
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DevelopmentMetricsService(db)
    result = await service.get_pr_review_time(
        start_date, end_date, repo_id, repo_ids, author_login
    )

    # Add trend data if requested
    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Get previous period data
        prev_result = await service.get_pr_review_time(
            prev_start, prev_end, repo_id, repo_ids, author_login
        )

        # Calculate trend
        trend = await comparison_service.calculate_trend(
            metric_name="pr_review_time",
            current_period=(start_date, end_date),
            previous_period=(prev_start, prev_end),
            current_value=result["average_hours"],
            previous_value=prev_result["average_hours"],
        )

        result["trend"] = trend.to_dict()

    # Add benchmark data if requested
    if include_benchmark:
        benchmark = BenchmarkService.get_pr_review_time_benchmark(
            result["average_hours"]
        )
        result["benchmark"] = benchmark.to_dict()

    return result


@router.get("/development/pr-merge-time")
async def get_pr_merge_time(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    author_login: str | None = None,
    include_trend: bool = False,
    include_benchmark: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Get PR merge time metric.

    Measures time from PR opened to merged.

    Query params:
    - include_trend: If true, includes period-over-period trend comparison
    - include_benchmark: If true, includes industry benchmark comparison
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DevelopmentMetricsService(db)
    result = await service.get_pr_merge_time(
        start_date, end_date, repo_id, repo_ids, author_login
    )

    # Add trend data if requested
    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Get previous period data
        prev_result = await service.get_pr_merge_time(
            prev_start, prev_end, repo_id, repo_ids, author_login
        )

        # Calculate trend
        trend = await comparison_service.calculate_trend(
            metric_name="pr_merge_time",
            current_period=(start_date, end_date),
            previous_period=(prev_start, prev_end),
            current_value=result["average_hours"],
            previous_value=prev_result["average_hours"],
        )

        result["trend"] = trend.to_dict()

    # Add benchmark data if requested
    if include_benchmark:
        benchmark = BenchmarkService.get_pr_merge_time_benchmark(
            result["average_hours"]
        )
        result["benchmark"] = benchmark.to_dict()

    return result


@router.get("/development/cycle-time")
async def get_cycle_time(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    team_id: int | None = None,
    include_trend: bool = False,
    include_benchmark: bool = False,
    include_breakdown: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Get cycle time metric.

    Measures time from issue started to linked PR merged.
    Requires Linear integration and PR-issue linking.

    Query params:
    - include_trend: If true, includes period-over-period trend comparison
    - include_benchmark: If true, includes industry benchmark comparison
    - include_breakdown: If true, includes list of issues (identifier, title, hours, started_at, merged_at)
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    # -1 is frontend sentinel for "all teams"; treat as no filter
    effective_team_id = None if team_id == -1 else team_id

    service = DevelopmentMetricsService(db)
    result = await service.get_cycle_time(
        start_date, end_date, effective_team_id, include_breakdown=include_breakdown
    )

    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )
        prev_result = await service.get_cycle_time(
            prev_start, prev_end, effective_team_id
        )
        trend = await comparison_service.calculate_trend(
            metric_name="cycle_time",
            current_period=(start_date, end_date),
            previous_period=(prev_start, prev_end),
            current_value=result["average_hours"],
            previous_value=prev_result["average_hours"],
        )
        result["trend"] = trend.to_dict()

    if include_benchmark:
        benchmark = BenchmarkService.get_cycle_time_benchmark(result["average_hours"])
        result["benchmark"] = benchmark.to_dict()

    return result


@router.get("/development/cycle-time/by-period")
async def get_cycle_time_by_period(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "day",
    team_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Get cycle time median per period (for charts).

    Returns list of {"period": str, "median_hours": float} sorted by period.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    # -1 is frontend sentinel for "all teams"; treat as no filter
    effective_team_id = None if team_id == -1 else team_id

    service = DevelopmentMetricsService(db)
    return await service.get_cycle_time_by_period(
        start_date, end_date, period, effective_team_id
    )


@router.get("/development/throughput")
async def get_throughput(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    author_login: str | None = None,
    include_trend: bool = False,
    include_benchmark: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Get throughput metric.

    Measures count of PRs merged per period.

    Query params:
    - include_trend: If true, includes period-over-period trend comparison
    - include_benchmark: If true, includes industry benchmark comparison
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DevelopmentMetricsService(db)
    result = await service.get_throughput(
        start_date, end_date, period, repo_id, repo_ids, author_login
    )

    # Add trend data if requested
    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Get previous period data
        prev_result = await service.get_throughput(
            prev_start, prev_end, period, repo_id, repo_ids, author_login
        )

        # Calculate trend
        trend = await comparison_service.calculate_trend(
            metric_name="throughput",
            current_period=(start_date, end_date),
            previous_period=(prev_start, prev_end),
            current_value=result["average"],
            previous_value=prev_result["average"],
        )

        result["trend"] = trend.to_dict()

    # Add benchmark data if requested
    if include_benchmark:
        benchmark = BenchmarkService.get_throughput_benchmark(result["average"])
        result["benchmark"] = benchmark.to_dict()

    return result


# ============================================================================
# Anomaly Detection
# ============================================================================


@router.get("/anomalies")
async def get_anomalies(
    metric: Literal[
        "deployment_frequency",
        "lead_time",
        "pr_review_time",
        "pr_merge_time",
        "throughput",
    ],
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    author_login: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Detect anomalies in a specific metric.

    Query params:
    - metric: Which metric to analyze for anomalies
    - start_date: Start of period (default: 30 days ago)
    - end_date: End of period (default: now)
    - period: Grouping period - day, week, or month (default: week)
    - repo_id: Optional repository filter
    - author_login: Optional developer filter

    Returns:
    - anomalies: List of detected anomalies
    - summary: Aggregated statistics (total count, severity breakdown)
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    # Fetch metric data based on metric type
    if metric == "deployment_frequency":
        service = DORAMetricsService(db)
        data = await service.get_deployment_frequency(
            start_date, end_date, period, repo_id, repo_ids, author_login
        )
        values = [p["count"] for p in data["data"]]
        dates = [p["period"] for p in data["data"]]
        metric_context = "Higher deployment frequency is generally better."

    elif metric == "lead_time":
        service = DORAMetricsService(db)
        data = await service.get_lead_time_for_changes(
            start_date, end_date, repo_id, repo_ids, author_login
        )
        values = [m["lead_time_hours"] for m in data["measurements"]]
        dates = [m["deployed_at"] for m in data["measurements"]]
        metric_context = "Lower lead time indicates faster delivery."

    elif metric == "pr_review_time":
        service = DevelopmentMetricsService(db)
        data = await service.get_pr_review_time(
            start_date, end_date, repo_id, repo_ids, author_login
        )
        # For aggregate metrics, we need to fetch individual data points
        # For now, return empty as this requires fetching PR-level data
        return {"anomalies": [], "summary": {"total_count": 0}}

    elif metric == "pr_merge_time":
        service = DevelopmentMetricsService(db)
        data = await service.get_pr_merge_time(
            start_date, end_date, repo_id, repo_ids, author_login
        )
        # Same as above - requires PR-level data
        return {"anomalies": [], "summary": {"total_count": 0}}

    elif metric == "throughput":
        service = DevelopmentMetricsService(db)
        data = await service.get_throughput(
            start_date, end_date, period, repo_id, repo_ids, author_login
        )
        values = [p["count"] for p in data["data"]]
        dates = [p["period"] for p in data["data"]]
        metric_context = "Higher throughput indicates more PRs merged."

    else:
        return {"anomalies": [], "summary": {"total_count": 0}}

    # Detect anomalies
    anomaly_service = AnomalyDetectionService()
    anomalies = anomaly_service.detect_outliers(
        metric_name=metric, values=values, dates=dates, metric_context=metric_context
    )

    # Calculate summary statistics
    summary = anomaly_service.calculate_anomaly_score(anomalies)

    return {
        "anomalies": [a.to_dict() for a in anomalies],
        "summary": summary,
    }


@router.get("/pr-health")
async def get_pr_health(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    author_login: str | None = None,
    min_score: int | None = None,
    max_score: int | None = None,
    include_summary: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """
    Get PR health scores for the time period.

    Calculates a health score (0-100) for each PR based on:
    - Review rounds (CHANGES_REQUESTED count)
    - Comment volume (excessive discussion)
    - PR size (lines changed)
    - Time to first review
    - Time to merge

    Query params:
    - start_date, end_date: Time period
    - repo_id: Filter by repository
    - author_login: Filter by author
    - min_score, max_score: Filter by score range
    - include_summary: If true, includes summary statistics

    Returns:
        List of PR health scores with optional summary
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = PRHealthService(db)

    # Calculate health scores
    health_scores = await service.calculate_pr_health(
        start_date=start_date,
        end_date=end_date,
        repo_id=repo_id,
        repo_ids=repo_ids,
        author_login=author_login,
        min_score=min_score,
        max_score=max_score,
    )

    response = {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "pr_health_scores": [score.to_dict() for score in health_scores],
        "count": len(health_scores),
    }

    # Add summary if requested
    if include_summary:
        summary = await service.get_health_summary(
            start_date=start_date,
            end_date=end_date,
            repo_id=repo_id,
            repo_ids=repo_ids,
        )
        response["summary"] = summary

    return response


@router.get("/reviewer-workload")
async def get_reviewer_workload(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get reviewer workload distribution for the time period.

    Analyzes how reviews are distributed across reviewers and identifies:
    - Bottlenecks (reviewers handling >40% of reviews)
    - Under-utilized reviewers (<10% when team has 3+ reviewers)
    - Gini coefficient (inequality measure)

    Query params:
    - start_date, end_date: Time period (default: last 30 days)
    - repo_id: Optional repository filter

    Returns:
        List of reviewer workloads with summary statistics
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = ReviewerWorkloadService(db)
    workloads, summary = await service.analyze_workload(
        start_date=start_date,
        end_date=end_date,
        repo_id=repo_id,
        repo_ids=repo_ids,
    )

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "workloads": [w.to_dict() for w in workloads],
        "summary": summary.to_dict(),
    }


@router.get("/recommendations/proposed")
async def get_proposed_recommendations(db: AsyncSession = Depends(get_db)):
    """
    Return the latest proposed recommendations from the scheduler (run every 10 min).
    Includes run_at, period, and full recommendation list with link and details.
    """
    result = await db.execute(
        select(RecommendationRun).order_by(RecommendationRun.run_at.desc()).limit(1)
    )
    run = result.scalar_one_or_none()
    if not run:
        return {
            "run_at": None,
            "period_start": None,
            "period_end": None,
            "recommendations": [],
        }
    return {
        "run_at": run.run_at.isoformat(),
        "period_start": run.period_start.isoformat(),
        "period_end": run.period_end.isoformat(),
        "recommendations": run.recommendations,
    }


@router.get("/recommendations")
async def get_recommendations(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get prioritized recommendations based on DORA and development metrics.

    Rules: deployment frequency <1/week, lead time >48h, review time >12h,
    large PRs detected, reviewer bottleneck.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    engine = RecommendationEngine(db)
    recommendations = await engine.get_recommendations(
        start_date=start_date,
        end_date=end_date,
        repo_id=repo_id,
        repo_ids=repo_ids,
    )

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "recommendations": [r.to_dict() for r in recommendations],
    }


@router.get("/correlations")
async def get_correlations(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
    repo_ids: list[int] | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get pairwise Pearson correlations between deployment frequency, throughput,
    and lead time (by period). Requires at least 3 aligned periods per pair.
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = CorrelationService(db)
    pairs = await service.get_correlations(
        start_date=start_date,
        end_date=end_date,
        period=period,
        repo_id=repo_id,
        repo_ids=repo_ids,
    )

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "period": period,
        "pairs": pairs,
    }


# ============================================================================
# Linear-native metrics
# ============================================================================


@router.get("/linear/overview")
async def get_linear_overview(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    team_id: int | None = None,
    team_ids: list[int] | None = Query(
        None, description="Filter by team IDs (e.g. ?team_ids=1&team_ids=2)"
    ),
    no_teams: bool = Query(
        False, description="If true, return empty results (no teams selected)"
    ),
    assignee_name: str | None = Query(
        None,
        description="Filter by Linear assignee name (e.g. for per-developer metrics)",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Get Linear overview for dashboard: issues completed, backlog, time-in-state.

    Query params: start_date, end_date (default last 30 days), team_id or team_ids, no_teams, assignee_name (optional).
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()
    if no_teams:
        team_ids = []

    service = LinearMetricsService(db)
    return await service.get_overview(
        start_date,
        end_date,
        team_id=team_id,
        team_ids=team_ids,
        assignee_name=assignee_name,
    )


@router.get("/linear/issues-completed")
async def get_linear_issues_completed(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    team_id: int | None = None,
    team_ids: list[int] | None = Query(None),
    no_teams: bool = Query(
        False, description="If true, return empty results (no teams selected)"
    ),
    assignee_name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get issues completed per period (time series).

    Query params: start_date, end_date, period, team_id or team_ids, no_teams, assignee_name (optional).
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()
    if no_teams:
        team_ids = []

    service = LinearMetricsService(db)
    return await service.get_issues_completed(
        start_date,
        end_date,
        period=period,
        team_id=team_id,
        team_ids=team_ids,
        assignee_name=assignee_name,
    )


@router.get("/linear/backlog")
async def get_linear_backlog(
    team_id: int | None = None,
    team_ids: list[int] | None = Query(None),
    no_teams: bool = Query(
        False, description="If true, return empty results (no teams selected)"
    ),
    assignee_name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current backlog count (open issues). Optional team_id, team_ids, no_teams, assignee_name filter.
    """
    if no_teams:
        team_ids = []
    service = LinearMetricsService(db)
    return await service.get_backlog(
        team_id=team_id,
        team_ids=team_ids,
        assignee_name=assignee_name,
    )


@router.get("/linear/time-in-state")
async def get_linear_time_in_state(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    team_id: int | None = None,
    team_ids: list[int] | None = Query(None),
    no_teams: bool = Query(
        False, description="If true, return empty results (no teams selected)"
    ),
    assignee_name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Get average/median time from issue started to completed.

    Query params: start_date, end_date (default last 30 days), team_id or team_ids, no_teams, assignee_name (optional).
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()
    if no_teams:
        team_ids = []

    service = LinearMetricsService(db)
    return await service.get_time_in_state(
        start_date,
        end_date,
        team_id=team_id,
        team_ids=team_ids,
        assignee_name=assignee_name,
    )
