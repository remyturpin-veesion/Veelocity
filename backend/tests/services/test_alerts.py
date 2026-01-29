"""Tests for alerts service."""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch

from app.services.insights.alerts import Alert, AlertsService


class TestAlert:
    """Test Alert dataclass."""

    def test_to_dict(self):
        """Alert serializes to dict with expected keys."""
        a = Alert(
            rule_id="test_rule",
            title="Test",
            message="Message",
            severity="high",
            metric="deployment_frequency",
            current_value=0.5,
            threshold="≥1/week",
        )
        d = a.to_dict()
        assert d["rule_id"] == "test_rule"
        assert d["title"] == "Test"
        assert d["severity"] == "high"
        assert d["current_value"] == 0.5
        assert d["threshold"] == "≥1/week"


class TestAlertsService:
    """Test AlertsService.get_alerts."""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db):
        return AlertsService(mock_db)

    @pytest.mark.asyncio
    async def test_get_alerts_empty_when_all_healthy(self, service):
        """No alerts when metrics are within thresholds."""
        dep_freq = {"average": 5.0, "total": 20}
        lead_time = {"average_hours": 24.0, "count": 10}
        review_time = {"average_hours": 6.0, "count": 15}
        throughput = {"total": 12}
        workload_summary = AsyncMock()
        workload_summary.has_bottleneck = False
        workload_summary.bottleneck_reviewers = []

        with (
            patch(
                "app.services.insights.alerts.DORAMetricsService",
                spec=True,
            ) as mock_dora_cls,
            patch(
                "app.services.insights.alerts.DevelopmentMetricsService",
                spec=True,
            ) as mock_dev_cls,
            patch(
                "app.services.insights.alerts.ReviewerWorkloadService",
                spec=True,
            ) as mock_workload_cls,
        ):
            mock_dora = AsyncMock()
            mock_dora.get_deployment_frequency.return_value = dep_freq
            mock_dora.get_lead_time_for_changes.return_value = lead_time
            mock_dora_cls.return_value = mock_dora

            mock_dev = AsyncMock()
            mock_dev.get_pr_review_time.return_value = review_time
            mock_dev.get_throughput.return_value = throughput
            mock_dev_cls.return_value = mock_dev

            mock_workload = AsyncMock()
            mock_workload.analyze_workload.return_value = ([], workload_summary)
            mock_workload_cls.return_value = mock_workload

            start = datetime(2026, 1, 1)
            end = datetime(2026, 1, 31)
            alerts = await service.get_alerts(start, end, repo_id=None)

        assert len(alerts) == 0

    @pytest.mark.asyncio
    async def test_get_alerts_deployment_frequency_low(self, service):
        """Alert when deployment frequency < 1/week."""
        dep_freq = {"average": 0.5, "total": 2}
        lead_time = {"average_hours": 12.0, "count": 5}
        review_time = {"average_hours": 2.0, "count": 5}
        throughput = {"total": 5}
        workload_summary = AsyncMock()
        workload_summary.has_bottleneck = False
        workload_summary.bottleneck_reviewers = []

        with (
            patch(
                "app.services.insights.alerts.DORAMetricsService",
                spec=True,
            ) as mock_dora_cls,
            patch(
                "app.services.insights.alerts.DevelopmentMetricsService",
                spec=True,
            ) as mock_dev_cls,
            patch(
                "app.services.insights.alerts.ReviewerWorkloadService",
                spec=True,
            ) as mock_workload_cls,
        ):
            mock_dora = AsyncMock()
            mock_dora.get_deployment_frequency.return_value = dep_freq
            mock_dora.get_lead_time_for_changes.return_value = lead_time
            mock_dora_cls.return_value = mock_dora

            mock_dev = AsyncMock()
            mock_dev.get_pr_review_time.return_value = review_time
            mock_dev.get_throughput.return_value = throughput
            mock_dev_cls.return_value = mock_dev

            mock_workload = AsyncMock()
            mock_workload.analyze_workload.return_value = ([], workload_summary)
            mock_workload_cls.return_value = mock_workload

            start = datetime(2026, 1, 1)
            end = datetime(2026, 1, 31)
            alerts = await service.get_alerts(start, end, repo_id=None)

        assert len(alerts) >= 1
        deployment_alert = next(
            (a for a in alerts if a.rule_id == "deployment_frequency_low"), None
        )
        assert deployment_alert is not None
        assert deployment_alert.severity == "high"
        assert deployment_alert.current_value == 0.5
