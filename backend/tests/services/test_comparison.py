"""Tests for comparison service and trend calculation."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock

from app.services.metrics.comparison import ComparisonService, TrendData


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    return AsyncMock()


@pytest.fixture
def comparison_service(mock_db):
    """Create a comparison service instance."""
    return ComparisonService(mock_db)


class TestTrendData:
    """Test TrendData dataclass."""

    def test_to_dict(self):
        """Test conversion to dictionary."""
        trend = TrendData(
            current_value=100.0,
            previous_value=80.0,
            change_percent=25.0,
            direction="up",
            is_improving=True,
            is_significant=True,
        )

        result = trend.to_dict()

        assert result == {
            "current_value": 100.0,
            "previous_value": 80.0,
            "change_percent": 25.0,
            "direction": "up",
            "is_improving": True,
            "is_significant": True,
        }


class TestCalculateTrend:
    """Test trend calculation logic."""

    async def test_increasing_trend_higher_is_better(self, comparison_service):
        """Test increasing trend for metrics where higher is better."""
        current_period = (datetime(2026, 1, 1), datetime(2026, 1, 7))
        previous_period = (datetime(2025, 12, 25), datetime(2025, 12, 31))

        trend = await comparison_service.calculate_trend(
            metric_name="deployment_frequency",
            current_period=current_period,
            previous_period=previous_period,
            current_value=10.0,
            previous_value=8.0,
        )

        assert trend.current_value == 10.0
        assert trend.previous_value == 8.0
        assert trend.change_percent == 25.0
        assert trend.direction == "up"
        assert trend.is_improving is True
        assert trend.is_significant is True

    async def test_decreasing_trend_lower_is_better(self, comparison_service):
        """Test decreasing trend for metrics where lower is better."""
        current_period = (datetime(2026, 1, 1), datetime(2026, 1, 7))
        previous_period = (datetime(2025, 12, 25), datetime(2025, 12, 31))

        trend = await comparison_service.calculate_trend(
            metric_name="lead_time",
            current_period=current_period,
            previous_period=previous_period,
            current_value=50.0,
            previous_value=80.0,
        )

        assert trend.current_value == 50.0
        assert trend.previous_value == 80.0
        assert trend.change_percent == -37.5
        assert trend.direction == "down"
        assert trend.is_improving is True
        assert trend.is_significant is True

    async def test_increasing_trend_lower_is_better(self, comparison_service):
        """Test increasing trend for metrics where lower is better (degrading)."""
        current_period = (datetime(2026, 1, 1), datetime(2026, 1, 7))
        previous_period = (datetime(2025, 12, 25), datetime(2025, 12, 31))

        trend = await comparison_service.calculate_trend(
            metric_name="pr_review_time",
            current_period=current_period,
            previous_period=previous_period,
            current_value=24.0,
            previous_value=12.0,
        )

        assert trend.current_value == 24.0
        assert trend.previous_value == 12.0
        assert trend.change_percent == 100.0
        assert trend.direction == "up"
        assert trend.is_improving is False  # Higher review time is worse
        assert trend.is_significant is True

    async def test_flat_trend(self, comparison_service):
        """Test flat trend (< 1% change)."""
        current_period = (datetime(2026, 1, 1), datetime(2026, 1, 7))
        previous_period = (datetime(2025, 12, 25), datetime(2025, 12, 31))

        trend = await comparison_service.calculate_trend(
            metric_name="deployment_frequency",
            current_period=current_period,
            previous_period=previous_period,
            current_value=100.0,
            previous_value=100.5,
        )

        assert trend.change_percent == -0.5
        assert trend.direction == "flat"
        assert trend.is_improving is False  # Flat is not improving
        assert trend.is_significant is False

    async def test_insignificant_change(self, comparison_service):
        """Test insignificant change (< 10%)."""
        current_period = (datetime(2026, 1, 1), datetime(2026, 1, 7))
        previous_period = (datetime(2025, 12, 25), datetime(2025, 12, 31))

        trend = await comparison_service.calculate_trend(
            metric_name="throughput",
            current_period=current_period,
            previous_period=previous_period,
            current_value=105.0,
            previous_value=100.0,
        )

        assert trend.change_percent == 5.0
        assert trend.direction == "up"
        assert trend.is_improving is True
        assert trend.is_significant is False  # Only 5% change

    async def test_significant_change(self, comparison_service):
        """Test significant change (>= 10%)."""
        current_period = (datetime(2026, 1, 1), datetime(2026, 1, 7))
        previous_period = (datetime(2025, 12, 25), datetime(2025, 12, 31))

        trend = await comparison_service.calculate_trend(
            metric_name="throughput",
            current_period=current_period,
            previous_period=previous_period,
            current_value=120.0,
            previous_value=100.0,
        )

        assert trend.change_percent == 20.0
        assert trend.direction == "up"
        assert trend.is_improving is True
        assert trend.is_significant is True

    async def test_zero_to_nonzero(self, comparison_service):
        """Test transition from zero to non-zero value."""
        current_period = (datetime(2026, 1, 1), datetime(2026, 1, 7))
        previous_period = (datetime(2025, 12, 25), datetime(2025, 12, 31))

        trend = await comparison_service.calculate_trend(
            metric_name="deployment_frequency",
            current_period=current_period,
            previous_period=previous_period,
            current_value=5.0,
            previous_value=0.0,
        )

        assert trend.current_value == 5.0
        assert trend.previous_value == 0.0
        assert trend.change_percent == 1000.0  # Capped at 1000%
        assert trend.direction == "up"
        assert trend.is_improving is True
        assert trend.is_significant is True

    async def test_both_zero(self, comparison_service):
        """Test when both values are zero."""
        current_period = (datetime(2026, 1, 1), datetime(2026, 1, 7))
        previous_period = (datetime(2025, 12, 25), datetime(2025, 12, 31))

        trend = await comparison_service.calculate_trend(
            metric_name="deployment_frequency",
            current_period=current_period,
            previous_period=previous_period,
            current_value=0.0,
            previous_value=0.0,
        )

        assert trend.current_value == 0.0
        assert trend.previous_value == 0.0
        assert trend.change_percent == 0.0
        assert trend.direction == "flat"
        assert trend.is_improving is False
        assert trend.is_significant is False

    async def test_nonzero_to_zero(self, comparison_service):
        """Test transition from non-zero to zero value."""
        current_period = (datetime(2026, 1, 1), datetime(2026, 1, 7))
        previous_period = (datetime(2025, 12, 25), datetime(2025, 12, 31))

        trend = await comparison_service.calculate_trend(
            metric_name="deployment_frequency",
            current_period=current_period,
            previous_period=previous_period,
            current_value=0.0,
            previous_value=5.0,
        )

        assert trend.current_value == 0.0
        assert trend.previous_value == 5.0
        assert trend.change_percent == -100.0
        assert trend.direction == "down"
        assert trend.is_improving is False  # Down is bad for deployment frequency
        assert trend.is_significant is True


class TestMetricContextAwareness:
    """Test context-aware improvement logic for different metrics."""

    @pytest.mark.parametrize(
        "metric_name,current,previous,expected_improving",
        [
            # Lower is better metrics
            ("lead_time", 30.0, 50.0, True),  # Decreasing = improving
            ("lead_time", 50.0, 30.0, False),  # Increasing = degrading
            ("pr_review_time", 10.0, 20.0, True),
            ("pr_review_time", 20.0, 10.0, False),
            ("pr_merge_time", 5.0, 10.0, True),
            ("pr_merge_time", 10.0, 5.0, False),
            ("cycle_time", 40.0, 60.0, True),
            ("cycle_time", 60.0, 40.0, False),
            # Higher is better metrics
            ("deployment_frequency", 20.0, 10.0, True),  # Increasing = improving
            ("deployment_frequency", 10.0, 20.0, False),  # Decreasing = degrading
            ("throughput", 50.0, 30.0, True),
            ("throughput", 30.0, 50.0, False),
        ],
    )
    async def test_context_aware_improvement(
        self, comparison_service, metric_name, current, previous, expected_improving
    ):
        """Test that improvement detection is context-aware."""
        current_period = (datetime(2026, 1, 1), datetime(2026, 1, 7))
        previous_period = (datetime(2025, 12, 25), datetime(2025, 12, 31))

        trend = await comparison_service.calculate_trend(
            metric_name=metric_name,
            current_period=current_period,
            previous_period=previous_period,
            current_value=current,
            previous_value=previous,
        )

        assert trend.is_improving == expected_improving


class TestCalculatePreviousPeriod:
    """Test previous period calculation."""

    def test_calculate_previous_period_7_days(self, comparison_service):
        """Test calculating previous period for 7-day period."""
        start_date = datetime(2026, 1, 15)
        end_date = datetime(2026, 1, 21)

        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Previous period should be same length (6 days)
        period_length = end_date - start_date
        prev_length = prev_end - prev_start

        assert period_length == prev_length
        assert prev_end < start_date  # Previous period ends before current starts
        assert prev_start == datetime(2026, 1, 8, 23, 59, 59)
        assert prev_end == datetime(2026, 1, 14, 23, 59, 59)

    def test_calculate_previous_period_30_days(self, comparison_service):
        """Test calculating previous period for 30-day period."""
        start_date = datetime(2026, 2, 1)
        end_date = datetime(2026, 3, 2)  # 30 days

        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Previous period should be same length (30 days)
        period_length = end_date - start_date
        prev_length = prev_end - prev_start

        assert period_length == prev_length
        assert prev_end < start_date

    def test_calculate_previous_period_90_days(self, comparison_service):
        """Test calculating previous period for 90-day period."""
        start_date = datetime(2026, 4, 1)
        end_date = datetime(2026, 6, 30)  # 90 days

        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Previous period should be same length (90 days)
        period_length = end_date - start_date
        prev_length = prev_end - prev_start

        assert period_length == prev_length
        assert prev_end < start_date

    def test_calculate_previous_period_no_gap(self, comparison_service):
        """Test that previous period ends immediately before current period."""
        start_date = datetime(2026, 1, 15, 0, 0, 0)
        end_date = datetime(2026, 1, 21, 23, 59, 59)

        prev_start, prev_end = comparison_service.calculate_previous_period(
            start_date, end_date
        )

        # Previous period should end 1 second before current period starts
        gap = start_date - prev_end
        assert gap == timedelta(seconds=1)
