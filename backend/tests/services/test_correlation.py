"""Tests for correlation service."""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch

from app.services.metrics.correlation import (
    CorrelationService,
    _align_series,
    _pearson,
)


class TestAlignSeries:
    """Test _align_series helper."""

    def test_align_series_common_periods(self):
        """Align two series by common period keys."""
        a = [{"period": "W1", "count": 5}, {"period": "W2", "count": 3}]
        b = [{"period": "W1", "count": 10}, {"period": "W2", "count": 8}]
        x, y = _align_series(a, b, "period", "period", "count", "count")
        assert x == [5, 3]
        assert y == [10, 8]

    def test_align_series_partial_overlap(self):
        """Only common periods are included."""
        a = [{"period": "W1", "count": 1}, {"period": "W2", "count": 2}]
        b = [{"period": "W2", "count": 20}, {"period": "W3", "count": 30}]
        x, y = _align_series(a, b, "period", "period", "count", "count")
        assert x == [2]
        assert y == [20]


class TestPearson:
    """Test _pearson helper."""

    def test_pearson_positive(self):
        """Positive correlation returns value near 1."""
        x = [1.0, 2.0, 3.0, 4.0, 5.0]
        y = [2.0, 4.0, 6.0, 8.0, 10.0]
        r = _pearson(x, y)
        assert r is not None
        assert abs(r - 1.0) < 0.001

    def test_pearson_negative(self):
        """Negative correlation returns value near -1."""
        x = [1.0, 2.0, 3.0, 4.0, 5.0]
        y = [10.0, 8.0, 6.0, 4.0, 2.0]
        r = _pearson(x, y)
        assert r is not None
        assert abs(r - (-1.0)) < 0.001

    def test_pearson_insufficient_data(self):
        """Fewer than 3 points returns None."""
        assert _pearson([1.0, 2.0], [3.0, 4.0]) is None

    def test_pearson_mismatched_lengths(self):
        """Mismatched lengths return None."""
        assert _pearson([1.0, 2.0, 3.0], [1.0, 2.0]) is None

    def test_pearson_zero_variance(self):
        """Constant series returns None."""
        assert _pearson([1.0, 1.0, 1.0], [2.0, 3.0, 4.0]) is None


class TestCorrelationService:
    """Test CorrelationService.get_correlations."""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.fixture
    def service(self, mock_db):
        return CorrelationService(mock_db)

    @pytest.mark.asyncio
    async def test_get_correlations_returns_pairs(self, service):
        """get_correlations returns list of pair dicts with expected keys."""
        deploy_data = [
            {"period": "2026-W01", "count": 5},
            {"period": "2026-W02", "count": 7},
            {"period": "2026-W03", "count": 4},
        ]
        throughput_data = [
            {"period": "2026-W01", "count": 10},
            {"period": "2026-W02", "count": 14},
            {"period": "2026-W03", "count": 8},
        ]
        lead_data = [
            {"period": "2026-W01", "median_hours": 24.0},
            {"period": "2026-W02", "median_hours": 20.0},
            {"period": "2026-W03", "median_hours": 28.0},
        ]

        with (
            patch(
                "app.services.metrics.correlation.DORAMetricsService",
                spec=True,
            ) as mock_dora_cls,
            patch(
                "app.services.metrics.correlation.DevelopmentMetricsService",
                spec=True,
            ) as mock_dev_cls,
        ):
            mock_dora = AsyncMock()
            mock_dora.get_deployment_frequency.return_value = {
                "data": deploy_data,
            }
            mock_dora.get_lead_time_by_period.return_value = lead_data
            mock_dora_cls.return_value = mock_dora

            mock_dev = AsyncMock()
            mock_dev.get_throughput.return_value = {"data": throughput_data}
            mock_dev_cls.return_value = mock_dev

            start = datetime(2026, 1, 1)
            end = datetime(2026, 1, 21)
            pairs = await service.get_correlations(
                start, end, period="week", repo_id=None
            )

        assert len(pairs) >= 1
        for p in pairs:
            assert "metric_a" in p
            assert "metric_b" in p
            assert "correlation" in p
            assert "period_count" in p
            assert -1 <= p["correlation"] <= 1
            assert p["period_count"] == 3
