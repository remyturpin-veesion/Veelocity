"""Tests for recommendation engine."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.insights.recommendation_engine import (
    RecommendationEngine,
)


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def engine(mock_db):
    return RecommendationEngine(mock_db)


@pytest.mark.asyncio
async def test_recommendation_deploy_more_frequently(engine):
    """When deployment frequency < 1/week, recommend deploying more often."""
    with (
        patch(
            "app.services.insights.recommendation_engine.DORAMetricsService"
        ) as Dora,
        patch(
            "app.services.insights.recommendation_engine.DevelopmentMetricsService"
        ) as Dev,
        patch(
            "app.services.insights.recommendation_engine.PRHealthService"
        ) as PRHealth,
        patch(
            "app.services.insights.recommendation_engine.ReviewerWorkloadService"
        ) as Workload,
    ):
        dora_instance = MagicMock()
        dora_instance.get_deployment_frequency = AsyncMock(
            return_value={"average": 0.5, "total": 2}
        )
        dora_instance.get_lead_time_for_changes = AsyncMock(
            return_value={"average_hours": 24, "count": 5}
        )
        Dora.return_value = dora_instance

        dev_instance = MagicMock()
        dev_instance.get_pr_review_time = AsyncMock(
            return_value={"average_hours": 6, "count": 10}
        )
        Dev.return_value = dev_instance

        pr_instance = MagicMock()
        pr_instance.calculate_pr_health = AsyncMock(return_value=[])
        PRHealth.return_value = pr_instance

        workload_instance = MagicMock()
        workload_instance.analyze_workload = AsyncMock(
            return_value=([], MagicMock(has_bottleneck=False))
        )
        Workload.return_value = workload_instance

        start = datetime(2025, 1, 1)
        end = datetime(2025, 1, 31)
        result = await engine.get_recommendations(start, end, None)

    ids = [r.id for r in result]
    assert "deploy_more_frequently" in ids


@pytest.mark.asyncio
async def test_recommendation_break_down_prs(engine):
    """When lead time > 48h, recommend breaking down PRs."""
    with (
        patch(
            "app.services.insights.recommendation_engine.DORAMetricsService"
        ) as Dora,
        patch(
            "app.services.insights.recommendation_engine.DevelopmentMetricsService"
        ) as Dev,
        patch(
            "app.services.insights.recommendation_engine.PRHealthService"
        ) as PRHealth,
        patch(
            "app.services.insights.recommendation_engine.ReviewerWorkloadService"
        ) as Workload,
    ):
        dora_instance = MagicMock()
        dora_instance.get_deployment_frequency = AsyncMock(
            return_value={"average": 2, "total": 8}
        )
        dora_instance.get_lead_time_for_changes = AsyncMock(
            return_value={"average_hours": 72, "count": 3}
        )
        Dora.return_value = dora_instance

        dev_instance = MagicMock()
        dev_instance.get_pr_review_time = AsyncMock(
            return_value={"average_hours": 6, "count": 10}
        )
        Dev.return_value = dev_instance

        pr_instance = MagicMock()
        pr_instance.calculate_pr_health = AsyncMock(return_value=[])
        PRHealth.return_value = pr_instance

        workload_instance = MagicMock()
        workload_instance.analyze_workload = AsyncMock(
            return_value=([], MagicMock(has_bottleneck=False))
        )
        Workload.return_value = workload_instance

        start = datetime(2025, 1, 1)
        end = datetime(2025, 1, 31)
        result = await engine.get_recommendations(start, end, None)

    ids = [r.id for r in result]
    assert "break_down_prs" in ids


@pytest.mark.asyncio
async def test_recommendation_review_sla(engine):
    """When PR review time > 12h, recommend review SLA."""
    with (
        patch(
            "app.services.insights.recommendation_engine.DORAMetricsService"
        ) as Dora,
        patch(
            "app.services.insights.recommendation_engine.DevelopmentMetricsService"
        ) as Dev,
        patch(
            "app.services.insights.recommendation_engine.PRHealthService"
        ) as PRHealth,
        patch(
            "app.services.insights.recommendation_engine.ReviewerWorkloadService"
        ) as Workload,
    ):
        dora_instance = MagicMock()
        dora_instance.get_deployment_frequency = AsyncMock(
            return_value={"average": 2, "total": 8}
        )
        dora_instance.get_lead_time_for_changes = AsyncMock(
            return_value={"average_hours": 24, "count": 5}
        )
        Dora.return_value = dora_instance

        dev_instance = MagicMock()
        dev_instance.get_pr_review_time = AsyncMock(
            return_value={"average_hours": 18, "count": 7}
        )
        Dev.return_value = dev_instance

        pr_instance = MagicMock()
        pr_instance.calculate_pr_health = AsyncMock(return_value=[])
        PRHealth.return_value = pr_instance

        workload_instance = MagicMock()
        workload_instance.analyze_workload = AsyncMock(
            return_value=([], MagicMock(has_bottleneck=False))
        )
        Workload.return_value = workload_instance

        start = datetime(2025, 1, 1)
        end = datetime(2025, 1, 31)
        result = await engine.get_recommendations(start, end, None)

    ids = [r.id for r in result]
    assert "review_sla" in ids


@pytest.mark.asyncio
async def test_recommendation_redistribute_reviews(engine):
    """When reviewer bottleneck, recommend redistributing reviews."""
    with (
        patch(
            "app.services.insights.recommendation_engine.DORAMetricsService"
        ) as Dora,
        patch(
            "app.services.insights.recommendation_engine.DevelopmentMetricsService"
        ) as Dev,
        patch(
            "app.services.insights.recommendation_engine.PRHealthService"
        ) as PRHealth,
        patch(
            "app.services.insights.recommendation_engine.ReviewerWorkloadService"
        ) as Workload,
    ):
        dora_instance = MagicMock()
        dora_instance.get_deployment_frequency = AsyncMock(
            return_value={"average": 2, "total": 8}
        )
        dora_instance.get_lead_time_for_changes = AsyncMock(
            return_value={"average_hours": 24, "count": 5}
        )
        Dora.return_value = dora_instance

        dev_instance = MagicMock()
        dev_instance.get_pr_review_time = AsyncMock(
            return_value={"average_hours": 6, "count": 10}
        )
        Dev.return_value = dev_instance

        pr_instance = MagicMock()
        pr_instance.calculate_pr_health = AsyncMock(return_value=[])
        PRHealth.return_value = pr_instance

        summary = MagicMock()
        summary.has_bottleneck = True
        summary.bottleneck_reviewers = ["alice"]
        workload_instance = MagicMock()
        workload_instance.analyze_workload = AsyncMock(
            return_value=([], summary)
        )
        Workload.return_value = workload_instance

        start = datetime(2025, 1, 1)
        end = datetime(2025, 1, 31)
        result = await engine.get_recommendations(start, end, None)

    ids = [r.id for r in result]
    assert "redistribute_reviews" in ids


@pytest.mark.asyncio
async def test_recommendation_priority_order(engine):
    """Recommendations are sorted high then medium then low."""
    with (
        patch(
            "app.services.insights.recommendation_engine.DORAMetricsService"
        ) as Dora,
        patch(
            "app.services.insights.recommendation_engine.DevelopmentMetricsService"
        ) as Dev,
        patch(
            "app.services.insights.recommendation_engine.PRHealthService"
        ) as PRHealth,
        patch(
            "app.services.insights.recommendation_engine.ReviewerWorkloadService"
        ) as Workload,
    ):
        dora_instance = MagicMock()
        dora_instance.get_deployment_frequency = AsyncMock(
            return_value={"average": 0.5, "total": 1}
        )
        dora_instance.get_lead_time_for_changes = AsyncMock(
            return_value={"average_hours": 72, "count": 2}
        )
        Dora.return_value = dora_instance

        dev_instance = MagicMock()
        dev_instance.get_pr_review_time = AsyncMock(
            return_value={"average_hours": 6, "count": 5}
        )
        Dev.return_value = dev_instance

        pr_instance = MagicMock()
        pr_instance.calculate_pr_health = AsyncMock(return_value=[])
        PRHealth.return_value = pr_instance

        workload_instance = MagicMock()
        workload_instance.analyze_workload = AsyncMock(
            return_value=([], MagicMock(has_bottleneck=False))
        )
        Workload.return_value = workload_instance

        start = datetime(2025, 1, 1)
        end = datetime(2025, 1, 31)
        result = await engine.get_recommendations(start, end, None)

    priorities = [r.priority for r in result]
    high_count = priorities.count("high")
    medium_count = priorities.count("medium")
    assert high_count >= 1
    # All high should come before medium
    if medium_count > 0:
        first_medium = next(i for i, p in enumerate(priorities) if p == "medium")
        assert all(p == "high" for p in priorities[:first_medium])
