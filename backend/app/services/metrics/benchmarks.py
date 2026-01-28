"""
DORA metrics benchmarking service.

Provides industry-standard benchmark comparisons for DORA and development metrics
based on 2026 research data (LinearB, DORA State of DevOps, etc.).
"""

from dataclasses import dataclass
from typing import Literal


BenchmarkCategory = Literal["elite", "high", "medium", "low"]


@dataclass
class BenchmarkData:
    """Benchmark comparison data for a metric."""

    category: BenchmarkCategory
    description: str
    your_value: float
    elite_threshold: float
    high_threshold: float
    medium_threshold: float
    gap_to_elite: str  # Human-readable gap description
    improvement_direction: Literal["higher", "lower"]  # Which direction is better

    def to_dict(self) -> dict:
        """Convert to dictionary for API response."""
        return {
            "category": self.category,
            "description": self.description,
            "your_value": self.your_value,
            "thresholds": {
                "elite": self.elite_threshold,
                "high": self.high_threshold,
                "medium": self.medium_threshold,
            },
            "gap_to_elite": self.gap_to_elite,
            "improvement_direction": self.improvement_direction,
        }


class BenchmarkService:
    """Service for calculating benchmark comparisons."""

    # ============================================================================
    # DORA Metrics Benchmarks (based on 2024-2026 industry data)
    # ============================================================================

    @staticmethod
    def get_deployment_frequency_benchmark(
        deployments_per_week: float,
    ) -> BenchmarkData:
        """
        Benchmark for deployment frequency.

        Categories (per week):
        - Elite: 7+ (multiple times per day)
        - High: 1-7 (daily to weekly)
        - Medium: 0.25-1 (monthly to weekly)
        - Low: <0.25 (less than monthly)

        Source: DORA State of DevOps 2024
        """
        value = deployments_per_week

        # Determine category
        if value >= 7:
            category: BenchmarkCategory = "elite"
            description = "Elite: Multiple deployments per day"
        elif value >= 1:
            category = "high"
            description = "High: Daily to weekly deployments"
        elif value >= 0.25:
            category = "medium"
            description = "Medium: Monthly to weekly deployments"
        else:
            category = "low"
            description = "Low: Less than monthly deployments"

        # Calculate gap to elite
        elite_threshold = 7.0
        if value >= elite_threshold:
            gap = f"You're at Elite level! {value:.1f}x per week"
        else:
            ratio = elite_threshold / value if value > 0 else float("inf")
            gap = f"Deploy {ratio:.1f}x more frequently to reach Elite"

        return BenchmarkData(
            category=category,
            description=description,
            your_value=value,
            elite_threshold=7.0,
            high_threshold=1.0,
            medium_threshold=0.25,
            gap_to_elite=gap,
            improvement_direction="higher",
        )

    @staticmethod
    def get_lead_time_benchmark(average_hours: float) -> BenchmarkData:
        """
        Benchmark for lead time for changes.

        Categories (hours):
        - Elite: <24 hours
        - High: 24-168 hours (1 day to 1 week)
        - Medium: 168-720 hours (1 week to 1 month)
        - Low: >720 hours (more than 1 month)

        Source: DORA State of DevOps 2024
        """
        value = average_hours

        # Determine category
        if value < 24:
            category: BenchmarkCategory = "elite"
            description = "Elite: Less than one day"
        elif value < 168:  # 1 week
            category = "high"
            description = "High: One day to one week"
        elif value < 720:  # 1 month
            category = "medium"
            description = "Medium: One week to one month"
        else:
            category = "low"
            description = "Low: More than one month"

        # Calculate gap to elite
        elite_threshold = 24.0
        if value <= elite_threshold:
            gap = f"You're at Elite level! {value:.1f} hours"
        else:
            ratio = value / elite_threshold
            gap = f"Reduce lead time by {ratio:.1f}x to reach Elite"

        return BenchmarkData(
            category=category,
            description=description,
            your_value=value,
            elite_threshold=24.0,
            high_threshold=168.0,
            medium_threshold=720.0,
            gap_to_elite=gap,
            improvement_direction="lower",
        )

    # ============================================================================
    # Development Metrics Benchmarks (based on 2026 LinearB data)
    # ============================================================================

    @staticmethod
    def get_pr_review_time_benchmark(average_hours: float) -> BenchmarkData:
        """
        Benchmark for PR review time.

        Categories (hours):
        - Elite: <3 hours
        - High: 3-12 hours
        - Medium: 12-24 hours
        - Low: >24 hours

        Source: 2026 industry practice (24-hour SLA standard)
        """
        value = average_hours

        # Determine category
        if value < 3:
            category: BenchmarkCategory = "elite"
            description = "Elite: Less than 3 hours"
        elif value < 12:
            category = "high"
            description = "High: 3-12 hours (same day)"
        elif value < 24:
            category = "medium"
            description = "Medium: 12-24 hours"
        else:
            category = "low"
            description = "Low: More than 24 hours"

        # Calculate gap to elite
        elite_threshold = 3.0
        if value <= elite_threshold:
            gap = f"You're at Elite level! {value:.1f} hours"
        else:
            ratio = value / elite_threshold
            gap = f"Reduce review time by {ratio:.1f}x to reach Elite"

        return BenchmarkData(
            category=category,
            description=description,
            your_value=value,
            elite_threshold=3.0,
            high_threshold=12.0,
            medium_threshold=24.0,
            gap_to_elite=gap,
            improvement_direction="lower",
        )

    @staticmethod
    def get_pr_merge_time_benchmark(average_hours: float) -> BenchmarkData:
        """
        Benchmark for PR merge time (time from opened to merged).

        Categories (hours):
        - Elite: <24 hours
        - High: 24-72 hours (1-3 days)
        - Medium: 72-168 hours (3-7 days)
        - Low: >168 hours (more than 1 week)

        Source: Industry best practices
        """
        value = average_hours

        # Determine category
        if value < 24:
            category: BenchmarkCategory = "elite"
            description = "Elite: Less than 1 day"
        elif value < 72:
            category = "high"
            description = "High: 1-3 days"
        elif value < 168:
            category = "medium"
            description = "Medium: 3-7 days"
        else:
            category = "low"
            description = "Low: More than 1 week"

        # Calculate gap to elite
        elite_threshold = 24.0
        if value <= elite_threshold:
            gap = f"You're at Elite level! {value:.1f} hours"
        else:
            ratio = value / elite_threshold
            gap = f"Reduce merge time by {ratio:.1f}x to reach Elite"

        return BenchmarkData(
            category=category,
            description=description,
            your_value=value,
            elite_threshold=24.0,
            high_threshold=72.0,
            medium_threshold=168.0,
            gap_to_elite=gap,
            improvement_direction="lower",
        )

    @staticmethod
    def get_cycle_time_benchmark(average_hours: float) -> BenchmarkData:
        """
        Benchmark for cycle time (issue created to PR merged).

        Categories (hours):
        - Elite: <48 hours
        - High: 48-83 hours (median)
        - Medium: 83-168 hours (1 week)
        - Low: >168 hours

        Source: 2026 LinearB data (8.1M PRs analyzed)
        """
        value = average_hours

        # Determine category
        if value < 48:
            category: BenchmarkCategory = "elite"
            description = "Elite: Less than 2 days"
        elif value < 83:
            category = "high"
            description = "High: 2-3.5 days (above median)"
        elif value < 168:
            category = "medium"
            description = "Medium: 3.5-7 days"
        else:
            category = "low"
            description = "Low: More than 1 week"

        # Calculate gap to elite
        elite_threshold = 48.0
        if value <= elite_threshold:
            gap = f"You're at Elite level! {value:.1f} hours"
        else:
            ratio = value / elite_threshold
            gap = f"Reduce cycle time by {ratio:.1f}x to reach Elite"

        return BenchmarkData(
            category=category,
            description=description,
            your_value=value,
            elite_threshold=48.0,
            high_threshold=83.0,
            medium_threshold=168.0,
            gap_to_elite=gap,
            improvement_direction="lower",
        )

    @staticmethod
    def get_throughput_benchmark(prs_per_week: float) -> BenchmarkData:
        """
        Benchmark for throughput (PRs merged per developer per week).

        Categories (PRs per developer per week):
        - Elite: 5+
        - High: 3-5
        - Medium: 1-3
        - Low: <1

        Source: 2026 industry data
        """
        value = prs_per_week

        # Determine category
        if value >= 5:
            category: BenchmarkCategory = "elite"
            description = "Elite: 5+ PRs per developer per week"
        elif value >= 3:
            category = "high"
            description = "High: 3-5 PRs per developer per week"
        elif value >= 1:
            category = "medium"
            description = "Medium: 1-3 PRs per developer per week"
        else:
            category = "low"
            description = "Low: Less than 1 PR per developer per week"

        # Calculate gap to elite
        elite_threshold = 5.0
        if value >= elite_threshold:
            gap = f"You're at Elite level! {value:.1f} PRs/week"
        else:
            ratio = elite_threshold / value if value > 0 else float("inf")
            gap = f"Increase throughput by {ratio:.1f}x to reach Elite"

        return BenchmarkData(
            category=category,
            description=description,
            your_value=value,
            elite_threshold=5.0,
            high_threshold=3.0,
            medium_threshold=1.0,
            gap_to_elite=gap,
            improvement_direction="higher",
        )
