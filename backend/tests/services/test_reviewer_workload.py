"""Tests for reviewer workload analysis service."""

import pytest
from unittest.mock import Mock

from app.services.metrics.reviewer_workload import ReviewerWorkloadService


@pytest.fixture
def reviewer_service():
    """Create a reviewer workload service instance."""
    return ReviewerWorkloadService(Mock())


class TestGiniCoefficient:
    """Test Gini coefficient calculation."""

    def test_perfect_equality(self, reviewer_service):
        """Test with perfectly equal distribution."""
        values = [10, 10, 10, 10]
        gini = reviewer_service._calculate_gini_coefficient(values)
        
        assert gini == pytest.approx(0.0, abs=0.01)

    def test_total_inequality(self, reviewer_service):
        """Test with one person doing everything."""
        values = [0, 0, 0, 100]
        gini = reviewer_service._calculate_gini_coefficient(values)
        
        assert gini > 0.7  # High inequality

    def test_moderate_inequality(self, reviewer_service):
        """Test with typical team distribution."""
        values = [5, 10, 15, 20]  # Realistic distribution
        gini = reviewer_service._calculate_gini_coefficient(values)
        
        assert 0.2 < gini < 0.4  # Moderate range

    def test_empty_list(self, reviewer_service):
        """Test with empty list."""
        gini = reviewer_service._calculate_gini_coefficient([])
        
        assert gini == 0.0

    def test_single_value(self, reviewer_service):
        """Test with single reviewer."""
        gini = reviewer_service._calculate_gini_coefficient([10])
        
        assert gini == 0.0


class TestReviewerWorkload:
    """Test ReviewerWorkload dataclass."""

    def test_to_dict(self):
        """Test conversion to dictionary."""
        from app.services.metrics.reviewer_workload import ReviewerWorkload
        
        workload = ReviewerWorkload(
            reviewer_login="alice",
            review_count=25,
            avg_reviews_per_week=6.25,
            percentage_of_total=50.0,
            is_bottleneck=True,
            is_under_utilized=False,
        )
        
        result = workload.to_dict()
        
        assert result["reviewer_login"] == "alice"
        assert result["review_count"] == 25
        assert result["avg_reviews_per_week"] == 6.25
        assert result["percentage_of_total"] == 50.0
        assert result["is_bottleneck"] is True
        assert result["is_under_utilized"] is False


class TestWorkloadSummary:
    """Test WorkloadSummary dataclass."""

    def test_to_dict(self):
        """Test conversion to dictionary."""
        from app.services.metrics.reviewer_workload import WorkloadSummary
        
        summary = WorkloadSummary(
            total_reviews=100,
            unique_reviewers=5,
            avg_reviews_per_reviewer=20.0,
            max_reviews=45,
            min_reviews=5,
            gini_coefficient=0.35,
            has_bottleneck=True,
            bottleneck_reviewers=["alice"],
        )
        
        result = summary.to_dict()
        
        assert result["total_reviews"] == 100
        assert result["unique_reviewers"] == 5
        assert result["avg_reviews_per_reviewer"] == 20.0
        assert result["max_reviews"] == 45
        assert result["min_reviews"] == 5
        assert result["gini_coefficient"] == 0.35
        assert result["has_bottleneck"] is True
        assert result["bottleneck_reviewers"] == ["alice"]
