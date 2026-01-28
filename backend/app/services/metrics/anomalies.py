"""
Anomaly detection service for metrics.

Uses statistical methods (IQR - Interquartile Range) to detect outliers
in metric time series data.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

import numpy as np


@dataclass
class Anomaly:
    """Represents a detected anomaly in metric data."""

    metric_name: str
    period: str  # ISO date string
    value: float
    expected_range: tuple[float, float]  # (min, max)
    severity: Literal["minor", "major"]
    explanation: str
    deviation_percentage: float  # How far from expected (as %)

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "metric_name": self.metric_name,
            "period": self.period,
            "value": self.value,
            "expected_range": {
                "min": self.expected_range[0],
                "max": self.expected_range[1],
            },
            "severity": self.severity,
            "explanation": self.explanation,
            "deviation_percentage": self.deviation_percentage,
        }


class AnomalyDetectionService:
    """Service for detecting anomalies in metric time series."""

    def __init__(self, iqr_multiplier: float = 1.5, major_multiplier: float = 3.0):
        """
        Initialize anomaly detection service.

        Args:
            iqr_multiplier: Multiplier for IQR to define outlier threshold (default 1.5)
            major_multiplier: Multiplier for IQR to define major severity (default 3.0)
        """
        self.iqr_multiplier = iqr_multiplier
        self.major_multiplier = major_multiplier

    def detect_outliers(
        self,
        metric_name: str,
        values: list[float],
        dates: list[datetime] | list[str],
        metric_context: str | None = None,
    ) -> list[Anomaly]:
        """
        Detect outliers in a time series using IQR method.

        Args:
            metric_name: Name of the metric being analyzed
            values: List of metric values
            dates: List of dates corresponding to values
            metric_context: Optional context for better explanations (e.g., "higher is better")

        Returns:
            List of detected anomalies
        """
        if len(values) != len(dates):
            raise ValueError("Values and dates must have the same length")

        if len(values) < 4:
            # Need at least 4 data points for meaningful IQR calculation
            return []

        # Convert dates to strings if they're datetime objects
        date_strings = [
            d.isoformat() if isinstance(d, datetime) else d for d in dates
        ]

        # Calculate IQR
        q1 = np.percentile(values, 25)
        q3 = np.percentile(values, 75)
        iqr = q3 - q1

        if iqr == 0:
            # All values are identical - no outliers possible
            return []

        # Calculate outlier thresholds
        minor_lower = q1 - (self.iqr_multiplier * iqr)
        minor_upper = q3 + (self.iqr_multiplier * iqr)
        major_lower = q1 - (self.major_multiplier * iqr)
        major_upper = q3 + (self.major_multiplier * iqr)

        # Detect anomalies
        anomalies = []
        median = np.median(values)

        for i, (value, date_str) in enumerate(zip(values, date_strings)):
            is_outlier = value < minor_lower or value > minor_upper

            if is_outlier:
                # Determine severity
                is_major = value < major_lower or value > major_upper
                severity: Literal["minor", "major"] = "major" if is_major else "minor"

                # Calculate deviation percentage
                if value > median:
                    deviation_pct = ((value - median) / median * 100) if median != 0 else 0
                else:
                    deviation_pct = ((median - value) / median * 100) if median != 0 else 0

                # Generate explanation
                direction = "higher" if value > median else "lower"
                explanation = self._generate_explanation(
                    metric_name, value, median, direction, severity, metric_context
                )

                anomaly = Anomaly(
                    metric_name=metric_name,
                    period=date_str,
                    value=value,
                    expected_range=(minor_lower, minor_upper),
                    severity=severity,
                    explanation=explanation,
                    deviation_percentage=deviation_pct,
                )
                anomalies.append(anomaly)

        return anomalies

    def _generate_explanation(
        self,
        metric_name: str,
        value: float,
        median: float,
        direction: str,
        severity: Literal["minor", "major"],
        context: str | None,
    ) -> str:
        """Generate human-readable explanation for anomaly."""
        severity_text = "significantly" if severity == "major" else "notably"

        # Round for display
        value_rounded = round(value, 2)
        median_rounded = round(median, 2)

        explanation = (
            f"{metric_name.replace('_', ' ').title()} was {severity_text} {direction} "
            f"than expected ({value_rounded} vs median {median_rounded})."
        )

        # Add context-specific advice
        if context:
            explanation += f" {context}"

        return explanation

    def calculate_anomaly_score(self, anomalies: list[Anomaly]) -> dict:
        """
        Calculate overall anomaly score and summary statistics.

        Args:
            anomalies: List of detected anomalies

        Returns:
            Dictionary with summary statistics
        """
        if not anomalies:
            return {
                "total_count": 0,
                "minor_count": 0,
                "major_count": 0,
                "severity_score": 0,
            }

        minor_count = sum(1 for a in anomalies if a.severity == "minor")
        major_count = sum(1 for a in anomalies if a.severity == "major")

        # Calculate severity score (major anomalies weighted 3x)
        severity_score = minor_count + (major_count * 3)

        return {
            "total_count": len(anomalies),
            "minor_count": minor_count,
            "major_count": major_count,
            "severity_score": severity_score,
        }
