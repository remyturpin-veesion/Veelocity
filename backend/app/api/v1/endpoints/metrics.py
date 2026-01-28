"""DORA and development metrics API endpoints."""

from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.metrics.anomalies import AnomalyDetectionService
from app.services.metrics.benchmarks import BenchmarkService
from app.services.metrics.comparison import ComparisonService
from app.services.metrics.development import DevelopmentMetricsService
from app.services.metrics.dora import DORAMetricsService
from app.services.metrics.pr_health import PRHealthService
from app.services.metrics.reviewer_workload import ReviewerWorkloadService

router = APIRouter(prefix="/metrics", tags=["metrics"])


def get_default_date_range() -> tuple[datetime, datetime]:
    """Default to last 30 days."""
    end = datetime.utcnow()
    start = end - timedelta(days=30)
    return start, end


@router.get("/dora")
async def get_dora_metrics(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
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
        start_date, end_date, period, repo_id, author_login
    )
    lead_time = await service.get_lead_time_for_changes(
        start_date, end_date, repo_id, author_login
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
        start_date, end_date, period, repo_id, author_login
    )

    # Add trend data if requested
    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Get previous period data
        prev_result = await service.get_deployment_frequency(
            prev_start, prev_end, period, repo_id, author_login
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


@router.get("/dora/lead-time")
async def get_lead_time(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
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
        start_date, end_date, repo_id, author_login
    )

    # Add trend data if requested
    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Get previous period data
        prev_result = await service.get_lead_time_for_changes(
            prev_start, prev_end, repo_id, author_login
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


# ============================================================================
# Development Metrics
# ============================================================================


@router.get("/development")
async def get_development_metrics(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
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
        start_date, end_date, repo_id, author_login
    )
    pr_merge_time = await service.get_pr_merge_time(
        start_date, end_date, repo_id, author_login
    )
    cycle_time = await service.get_cycle_time(start_date, end_date)
    throughput = await service.get_throughput(
        start_date, end_date, period, repo_id, author_login
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
        start_date, end_date, repo_id, author_login
    )

    # Add trend data if requested
    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Get previous period data
        prev_result = await service.get_pr_review_time(
            prev_start, prev_end, repo_id, author_login
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
        start_date, end_date, repo_id, author_login
    )

    # Add trend data if requested
    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Get previous period data
        prev_result = await service.get_pr_merge_time(
            prev_start, prev_end, repo_id, author_login
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
    include_benchmark: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """
    Get cycle time metric.

    Measures time from issue started to linked PR merged.
    Requires Linear integration and PR-issue linking.

    Query params:
    - include_benchmark: If true, includes industry benchmark comparison
    """
    if not start_date or not end_date:
        start_date, end_date = get_default_date_range()

    service = DevelopmentMetricsService(db)
    result = await service.get_cycle_time(start_date, end_date, team_id)

    # Add benchmark data if requested
    if include_benchmark:
        benchmark = BenchmarkService.get_cycle_time_benchmark(result["average_hours"])
        result["benchmark"] = benchmark.to_dict()

    return result


@router.get("/development/throughput")
async def get_throughput(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    period: Literal["day", "week", "month"] = "week",
    repo_id: int | None = None,
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
        start_date, end_date, period, repo_id, author_login
    )

    # Add trend data if requested
    if include_trend:
        comparison_service = ComparisonService(db)
        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Get previous period data
        prev_result = await service.get_throughput(
            prev_start, prev_end, period, repo_id, author_login
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
            start_date, end_date, period, repo_id, author_login
        )
        values = [p["count"] for p in data["data"]]
        dates = [p["period"] for p in data["data"]]
        metric_context = "Higher deployment frequency is generally better."

    elif metric == "lead_time":
        service = DORAMetricsService(db)
        data = await service.get_lead_time_for_changes(
            start_date, end_date, repo_id, author_login
        )
        values = [m["lead_time_hours"] for m in data["measurements"]]
        dates = [m["deployed_at"] for m in data["measurements"]]
        metric_context = "Lower lead time indicates faster delivery."

    elif metric == "pr_review_time":
        service = DevelopmentMetricsService(db)
        data = await service.get_pr_review_time(
            start_date, end_date, repo_id, author_login
        )
        # For aggregate metrics, we need to fetch individual data points
        # For now, return empty as this requires fetching PR-level data
        return {"anomalies": [], "summary": {"total_count": 0}}

    elif metric == "pr_merge_time":
        service = DevelopmentMetricsService(db)
        data = await service.get_pr_merge_time(
            start_date, end_date, repo_id, author_login
        )
        # Same as above - requires PR-level data
        return {"anomalies": [], "summary": {"total_count": 0}}

    elif metric == "throughput":
        service = DevelopmentMetricsService(db)
        data = await service.get_throughput(
            start_date, end_date, period, repo_id, author_login
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
        )
        response["summary"] = summary
    
    return response


@router.get("/reviewer-workload")
async def get_reviewer_workload(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    repo_id: int | None = None,
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
    )

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "workloads": [w.to_dict() for w in workloads],
        "summary": summary.to_dict(),
    }
