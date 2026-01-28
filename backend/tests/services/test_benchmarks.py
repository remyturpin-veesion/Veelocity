"""Tests for benchmark service."""

import pytest

from app.services.metrics.benchmarks import BenchmarkService


class TestDeploymentFrequencyBenchmark:
    """Test deployment frequency benchmarking."""

    def test_elite_category(self):
        """Test elite category (7+ per week)."""
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(10.0)

        assert benchmark.category == "elite"
        assert benchmark.your_value == 10.0
        assert benchmark.elite_threshold == 7.0
        assert benchmark.improvement_direction == "higher"
        assert "Elite level" in benchmark.gap_to_elite

    def test_high_category(self):
        """Test high category (1-7 per week)."""
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(3.5)

        assert benchmark.category == "high"
        assert benchmark.your_value == 3.5
        assert "High" in benchmark.description

    def test_medium_category(self):
        """Test medium category (0.25-1 per week)."""
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(0.5)

        assert benchmark.category == "medium"
        assert benchmark.your_value == 0.5
        assert "Medium" in benchmark.description

    def test_low_category(self):
        """Test low category (<0.25 per week)."""
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(0.1)

        assert benchmark.category == "low"
        assert benchmark.your_value == 0.1
        assert "Low" in benchmark.description

    def test_gap_calculation(self):
        """Test gap to elite calculation."""
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(3.5)

        assert "2.0x more frequently" in benchmark.gap_to_elite


class TestLeadTimeBenchmark:
    """Test lead time benchmarking."""

    def test_elite_category(self):
        """Test elite category (<24 hours)."""
        benchmark = BenchmarkService.get_lead_time_benchmark(12.0)

        assert benchmark.category == "elite"
        assert benchmark.your_value == 12.0
        assert benchmark.elite_threshold == 24.0
        assert benchmark.improvement_direction == "lower"
        assert "Elite level" in benchmark.gap_to_elite

    def test_high_category(self):
        """Test high category (24-168 hours)."""
        benchmark = BenchmarkService.get_lead_time_benchmark(72.0)

        assert benchmark.category == "high"
        assert benchmark.your_value == 72.0
        assert "High" in benchmark.description

    def test_medium_category(self):
        """Test medium category (168-720 hours)."""
        benchmark = BenchmarkService.get_lead_time_benchmark(400.0)

        assert benchmark.category == "medium"
        assert benchmark.your_value == 400.0
        assert "Medium" in benchmark.description

    def test_low_category(self):
        """Test low category (>720 hours)."""
        benchmark = BenchmarkService.get_lead_time_benchmark(1000.0)

        assert benchmark.category == "low"
        assert benchmark.your_value == 1000.0
        assert "Low" in benchmark.description

    def test_gap_calculation(self):
        """Test gap to elite calculation."""
        benchmark = BenchmarkService.get_lead_time_benchmark(48.0)

        assert "2.0x" in benchmark.gap_to_elite
        assert "Reduce" in benchmark.gap_to_elite


class TestPRReviewTimeBenchmark:
    """Test PR review time benchmarking."""

    def test_elite_category(self):
        """Test elite category (<3 hours)."""
        benchmark = BenchmarkService.get_pr_review_time_benchmark(2.0)

        assert benchmark.category == "elite"
        assert benchmark.your_value == 2.0
        assert benchmark.elite_threshold == 3.0
        assert benchmark.improvement_direction == "lower"

    def test_high_category(self):
        """Test high category (3-12 hours)."""
        benchmark = BenchmarkService.get_pr_review_time_benchmark(8.0)

        assert benchmark.category == "high"
        assert "same day" in benchmark.description.lower()

    def test_medium_category(self):
        """Test medium category (12-24 hours)."""
        benchmark = BenchmarkService.get_pr_review_time_benchmark(18.0)

        assert benchmark.category == "medium"

    def test_low_category(self):
        """Test low category (>24 hours)."""
        benchmark = BenchmarkService.get_pr_review_time_benchmark(48.0)

        assert benchmark.category == "low"


class TestPRMergeTimeBenchmark:
    """Test PR merge time benchmarking."""

    def test_elite_category(self):
        """Test elite category (<24 hours)."""
        benchmark = BenchmarkService.get_pr_merge_time_benchmark(18.0)

        assert benchmark.category == "elite"
        assert benchmark.your_value == 18.0

    def test_high_category(self):
        """Test high category (24-72 hours)."""
        benchmark = BenchmarkService.get_pr_merge_time_benchmark(48.0)

        assert benchmark.category == "high"
        assert "1-3 days" in benchmark.description

    def test_medium_category(self):
        """Test medium category (72-168 hours)."""
        benchmark = BenchmarkService.get_pr_merge_time_benchmark(100.0)

        assert benchmark.category == "medium"

    def test_low_category(self):
        """Test low category (>168 hours)."""
        benchmark = BenchmarkService.get_pr_merge_time_benchmark(200.0)

        assert benchmark.category == "low"


class TestCycleTimeBenchmark:
    """Test cycle time benchmarking."""

    def test_elite_category(self):
        """Test elite category (<48 hours)."""
        benchmark = BenchmarkService.get_cycle_time_benchmark(36.0)

        assert benchmark.category == "elite"
        assert benchmark.elite_threshold == 48.0
        assert "2 days" in benchmark.description

    def test_high_category(self):
        """Test high category (48-83 hours)."""
        benchmark = BenchmarkService.get_cycle_time_benchmark(60.0)

        assert benchmark.category == "high"
        assert "median" in benchmark.description.lower()

    def test_medium_category(self):
        """Test medium category (83-168 hours)."""
        benchmark = BenchmarkService.get_cycle_time_benchmark(120.0)

        assert benchmark.category == "medium"

    def test_low_category(self):
        """Test low category (>168 hours)."""
        benchmark = BenchmarkService.get_cycle_time_benchmark(200.0)

        assert benchmark.category == "low"


class TestThroughputBenchmark:
    """Test throughput benchmarking."""

    def test_elite_category(self):
        """Test elite category (5+ PRs/week)."""
        benchmark = BenchmarkService.get_throughput_benchmark(6.0)

        assert benchmark.category == "elite"
        assert benchmark.your_value == 6.0
        assert benchmark.elite_threshold == 5.0
        assert benchmark.improvement_direction == "higher"

    def test_high_category(self):
        """Test high category (3-5 PRs/week)."""
        benchmark = BenchmarkService.get_throughput_benchmark(4.0)

        assert benchmark.category == "high"
        assert "3-5 PRs" in benchmark.description

    def test_medium_category(self):
        """Test medium category (1-3 PRs/week)."""
        benchmark = BenchmarkService.get_throughput_benchmark(2.0)

        assert benchmark.category == "medium"

    def test_low_category(self):
        """Test low category (<1 PR/week)."""
        benchmark = BenchmarkService.get_throughput_benchmark(0.5)

        assert benchmark.category == "low"

    def test_gap_calculation(self):
        """Test gap to elite calculation."""
        benchmark = BenchmarkService.get_throughput_benchmark(2.5)

        assert "2.0x" in benchmark.gap_to_elite
        assert "Increase" in benchmark.gap_to_elite


class TestBenchmarkDataSerialization:
    """Test BenchmarkData serialization."""

    def test_to_dict(self):
        """Test that BenchmarkData can be serialized to dict."""
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(10.0)

        result = benchmark.to_dict()

        assert result["category"] == "elite"
        assert result["your_value"] == 10.0
        assert "thresholds" in result
        assert result["thresholds"]["elite"] == 7.0
        assert result["thresholds"]["high"] == 1.0
        assert result["thresholds"]["medium"] == 0.25
        assert result["gap_to_elite"] == benchmark.gap_to_elite
        assert result["improvement_direction"] == "higher"

    def test_all_metrics_serializable(self):
        """Test that all benchmark functions return serializable data."""
        benchmarks = [
            BenchmarkService.get_deployment_frequency_benchmark(3.0),
            BenchmarkService.get_lead_time_benchmark(50.0),
            BenchmarkService.get_pr_review_time_benchmark(10.0),
            BenchmarkService.get_pr_merge_time_benchmark(48.0),
            BenchmarkService.get_cycle_time_benchmark(60.0),
            BenchmarkService.get_throughput_benchmark(3.5),
        ]

        for benchmark in benchmarks:
            result = benchmark.to_dict()
            assert isinstance(result, dict)
            assert "category" in result
            assert "thresholds" in result
            assert "gap_to_elite" in result


class TestEdgeCases:
    """Test edge cases in benchmarking."""

    def test_zero_value(self):
        """Test benchmarking with zero value."""
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(0.0)

        assert benchmark.category == "low"
        assert benchmark.your_value == 0.0

    def test_very_large_value(self):
        """Test benchmarking with very large value."""
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(1000.0)

        assert benchmark.category == "elite"
        assert "Elite level" in benchmark.gap_to_elite

    def test_boundary_values(self):
        """Test exact boundary values."""
        # Exactly at elite threshold
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(7.0)
        assert benchmark.category == "elite"

        # Just below elite threshold
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(6.9)
        assert benchmark.category == "high"

        # Exactly at high threshold
        benchmark = BenchmarkService.get_deployment_frequency_benchmark(1.0)
        assert benchmark.category == "high"

    def test_decimal_precision(self):
        """Test that decimal values are handled correctly."""
        benchmark = BenchmarkService.get_pr_review_time_benchmark(2.5)

        assert benchmark.category == "elite"
        assert benchmark.your_value == 2.5
