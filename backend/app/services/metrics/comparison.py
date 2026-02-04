"""Comparison service for calculating period-over-period trends."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class TrendData:
    """Data structure for period-over-period trend comparison."""

    current_value: float
    previous_value: float
    change_percent: float
    direction: Literal["up", "down", "flat"]
    is_improving: bool
    is_significant: bool  # >10% change

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "current_value": self.current_value,
            "previous_value": self.previous_value,
            "change_percent": self.change_percent,
            "direction": self.direction,
            "is_improving": self.is_improving,
            "is_significant": self.is_significant,
        }


class ComparisonService:
    """Calculate trends and comparisons across time periods."""

    # Metrics where lower values are better
    LOWER_IS_BETTER_METRICS = {
        "lead_time",
        "pr_review_time",
        "pr_merge_time",
        "cycle_time",
        "failure_rate",
    }

    # Metrics where higher values are better
    HIGHER_IS_BETTER_METRICS = {
        "deployment_frequency",
        "throughput",
    }

    def __init__(self, db: AsyncSession):
        self._db = db

    async def calculate_trend(
        self,
        metric_name: str,
        current_period: tuple[datetime, datetime],
        previous_period: tuple[datetime, datetime],
        current_value: float,
        previous_value: float,
    ) -> TrendData:
        """
        Calculate trend data for a metric comparing two periods.

        Args:
            metric_name: Name of the metric (e.g., "lead_time", "deployment_frequency")
            current_period: Tuple of (start_date, end_date) for current period
            previous_period: Tuple of (start_date, end_date) for previous period
            current_value: Metric value for current period
            previous_value: Metric value for previous period

        Returns:
            TrendData object with calculated trend information
        """
        # Calculate change percentage
        if previous_value == 0:
            # Handle division by zero
            if current_value == 0:
                change_percent = 0.0
            else:
                # If previous was 0 and current is non-zero, that's infinite growth
                # Cap at 1000% for practical display
                change_percent = 1000.0
        else:
            change_percent = ((current_value - previous_value) / previous_value) * 100

        # Determine direction
        if abs(change_percent) < 1.0:  # Less than 1% change is "flat"
            direction: Literal["up", "down", "flat"] = "flat"
        elif current_value > previous_value:
            direction = "up"
        else:
            direction = "down"

        # Determine if change is significant (>10%)
        is_significant = abs(change_percent) >= 10.0

        # Determine if change is improving (context-aware)
        is_improving = self._is_change_improving(
            metric_name, current_value, previous_value, direction
        )

        return TrendData(
            current_value=current_value,
            previous_value=previous_value,
            change_percent=round(change_percent, 1),
            direction=direction,
            is_improving=is_improving,
            is_significant=is_significant,
        )

    def _is_change_improving(
        self,
        metric_name: str,
        current_value: float,
        previous_value: float,
        direction: Literal["up", "down", "flat"],
    ) -> bool:
        """
        Determine if a change is improving based on metric context.

        For some metrics (lead time, review time), lower is better.
        For others (deployment frequency, throughput), higher is better.
        """
        if direction == "flat":
            # No significant change = neutral, not improving
            return False

        # Normalize metric name (handle variations)
        metric_lower = metric_name.lower().replace("-", "_")

        if metric_lower in self.LOWER_IS_BETTER_METRICS:
            # For these metrics, going down is improving
            return direction == "down"
        elif metric_lower in self.HIGHER_IS_BETTER_METRICS:
            # For these metrics, going up is improving
            return direction == "up"
        else:
            # Unknown metric - assume higher is better as default
            return direction == "up"

    def calculate_previous_period(
        self, start_date: datetime, end_date: datetime
    ) -> tuple[datetime, datetime]:
        """
        Calculate the previous period of equal length.

        Args:
            start_date: Start of current period
            end_date: End of current period

        Returns:
            Tuple of (previous_start_date, previous_end_date)
        """
        period_length = end_date - start_date
        previous_end = start_date - timedelta(seconds=1)  # Just before current period
        previous_start = previous_end - period_length

        return (previous_start, previous_end)
