"""Tests for PR health scoring service."""

from datetime import datetime, timedelta
from unittest.mock import Mock

import pytest

from app.services.metrics.pr_health import PRHealthService, PRHealthScore


@pytest.fixture
def pr_health_service():
    """Create a PR health service instance with mock DB."""
    return PRHealthService(Mock())


class TestReviewScoreCalculation:
    """Test review score component."""

    def test_zero_changes_requested(self, pr_health_service):
        """Test with no CHANGES_REQUESTED reviews (excellent)."""
        reviews = []
        score, rounds = pr_health_service._calculate_review_score(reviews)
        
        assert score == 25
        assert rounds == 0

    def test_one_changes_requested(self, pr_health_service):
        """Test with 1 CHANGES_REQUESTED review (good)."""
        reviews = [Mock(state="CHANGES_REQUESTED")]
        score, rounds = pr_health_service._calculate_review_score(reviews)
        
        assert score == 20
        assert rounds == 1

    def test_two_changes_requested(self, pr_health_service):
        """Test with 2 CHANGES_REQUESTED reviews (fair)."""
        reviews = [
            Mock(state="CHANGES_REQUESTED"),
            Mock(state="CHANGES_REQUESTED"),
        ]
        score, rounds = pr_health_service._calculate_review_score(reviews)
        
        assert score == 12
        assert rounds == 2

    def test_multiple_changes_requested(self, pr_health_service):
        """Test with 3+ CHANGES_REQUESTED reviews (poor)."""
        reviews = [Mock(state="CHANGES_REQUESTED") for _ in range(4)]
        score, rounds = pr_health_service._calculate_review_score(reviews)
        
        assert score == 5
        assert rounds == 4

    def test_mixed_review_states(self, pr_health_service):
        """Test with mixed review states (counts only CHANGES_REQUESTED)."""
        reviews = [
            Mock(state="APPROVED"),
            Mock(state="CHANGES_REQUESTED"),
            Mock(state="COMMENTED"),
            Mock(state="CHANGES_REQUESTED"),
        ]
        score, rounds = pr_health_service._calculate_review_score(reviews)
        
        assert score == 12  # 2 changes_requested
        assert rounds == 2


class TestCommentScoreCalculation:
    """Test comment score component."""

    def test_few_comments(self, pr_health_service):
        """Test with few comments (excellent)."""
        comments = [Mock() for _ in range(3)]
        score, count = pr_health_service._calculate_comment_score(comments)
        
        assert score == 25
        assert count == 3

    def test_moderate_comments(self, pr_health_service):
        """Test with moderate comments (good)."""
        comments = [Mock() for _ in range(10)]
        score, count = pr_health_service._calculate_comment_score(comments)
        
        assert score == 20
        assert count == 10

    def test_many_comments(self, pr_health_service):
        """Test with many comments (fair)."""
        comments = [Mock() for _ in range(20)]
        score, count = pr_health_service._calculate_comment_score(comments)
        
        assert score == 12
        assert count == 20

    def test_excessive_comments(self, pr_health_service):
        """Test with excessive comments (poor)."""
        comments = [Mock() for _ in range(35)]
        score, count = pr_health_service._calculate_comment_score(comments)
        
        assert score == 5
        assert count == 35


class TestSizeScoreCalculation:
    """Test size score component."""

    def test_small_pr(self, pr_health_service):
        """Test small PR (excellent)."""
        pr = Mock(additions=50, deletions=30)
        score, lines = pr_health_service._calculate_size_score(pr)
        
        assert score == 25
        assert lines == 80

    def test_medium_pr(self, pr_health_service):
        """Test medium PR (good)."""
        pr = Mock(additions=250, deletions=150)
        score, lines = pr_health_service._calculate_size_score(pr)
        
        assert score == 20
        assert lines == 400

    def test_large_pr(self, pr_health_service):
        """Test large PR (fair)."""
        pr = Mock(additions=600, deletions=200)
        score, lines = pr_health_service._calculate_size_score(pr)
        
        assert score == 12
        assert lines == 800

    def test_very_large_pr(self, pr_health_service):
        """Test very large PR (poor)."""
        pr = Mock(additions=800, deletions=400)
        score, lines = pr_health_service._calculate_size_score(pr)
        
        assert score == 5
        assert lines == 1200

    def test_pr_with_none_additions(self, pr_health_service):
        """Test PR with None values."""
        pr = Mock(additions=None, deletions=None)
        score, lines = pr_health_service._calculate_size_score(pr)
        
        assert score == 25  # Treated as 0 lines
        assert lines == 0


class TestTimeScoreCalculation:
    """Test time score component."""

    def test_quick_review_and_merge(self, pr_health_service):
        """Test quick review and merge (excellent)."""
        now = datetime.utcnow()
        pr = Mock(
            created_at=now - timedelta(hours=20),
            merged_at=now,
        )
        reviews = [Mock(submitted_at=now - timedelta(hours=18))]
        
        score, hours_review, hours_merge = pr_health_service._calculate_time_score(
            pr, reviews
        )
        
        assert score >= 21  # 12 (quick review) + at least 9 (quick merge)
        assert hours_review == 2
        assert hours_merge == 20

    def test_slow_review_and_merge(self, pr_health_service):
        """Test slow review and merge (poor)."""
        now = datetime.utcnow()
        pr = Mock(
            created_at=now - timedelta(days=15),
            merged_at=now,
        )
        reviews = [Mock(submitted_at=now - timedelta(days=14))]
        
        score, hours_review, hours_merge = pr_health_service._calculate_time_score(
            pr, reviews
        )
        
        assert score <= 10  # Low score for slow times
        assert hours_review >= 24
        assert hours_merge >= 168

    def test_no_reviews(self, pr_health_service):
        """Test PR with no reviews."""
        now = datetime.utcnow()
        pr = Mock(
            created_at=now - timedelta(hours=10),
            merged_at=now,
        )
        reviews = []
        
        score, hours_review, hours_merge = pr_health_service._calculate_time_score(
            pr, reviews
        )
        
        assert hours_review is None
        assert hours_merge == 10

    def test_not_merged_pr(self, pr_health_service):
        """Test PR that hasn't been merged yet."""
        now = datetime.utcnow()
        pr = Mock(
            created_at=now - timedelta(hours=10),
            merged_at=None,
        )
        reviews = [Mock(submitted_at=now - timedelta(hours=9))]
        
        score, hours_review, hours_merge = pr_health_service._calculate_time_score(
            pr, reviews
        )
        
        assert hours_review == 1
        assert hours_merge is None


class TestHealthCategoryClassification:
    """Test health category determination."""

    def test_excellent_category(self, pr_health_service):
        """Test excellent category classification."""
        assert pr_health_service._get_health_category(90) == "excellent"
        assert pr_health_service._get_health_category(85) == "excellent"

    def test_good_category(self, pr_health_service):
        """Test good category classification."""
        assert pr_health_service._get_health_category(75) == "good"
        assert pr_health_service._get_health_category(70) == "good"

    def test_fair_category(self, pr_health_service):
        """Test fair category classification."""
        assert pr_health_service._get_health_category(60) == "fair"
        assert pr_health_service._get_health_category(50) == "fair"

    def test_poor_category(self, pr_health_service):
        """Test poor category classification."""
        assert pr_health_service._get_health_category(40) == "poor"
        assert pr_health_service._get_health_category(20) == "poor"

    def test_boundary_values(self, pr_health_service):
        """Test exact boundary values."""
        assert pr_health_service._get_health_category(84) == "good"
        assert pr_health_service._get_health_category(69) == "fair"
        assert pr_health_service._get_health_category(49) == "poor"


class TestIssueIdentification:
    """Test issue identification logic."""

    def test_no_issues(self, pr_health_service):
        """Test PR with no issues."""
        issues = pr_health_service._identify_issues(0, 5, 100, 2.0, 20.0)
        
        assert len(issues) == 0

    def test_review_rounds_issue(self, pr_health_service):
        """Test PR with multiple review rounds."""
        issues = pr_health_service._identify_issues(4, 5, 100, 2.0, 20.0)
        
        assert len(issues) == 1
        assert "Multiple review rounds (4)" in issues[0]

    def test_excessive_discussion_issue(self, pr_health_service):
        """Test PR with excessive comments."""
        issues = pr_health_service._identify_issues(0, 35, 100, 2.0, 20.0)
        
        assert len(issues) == 1
        assert "Excessive discussion (35 comments)" in issues[0]

    def test_large_pr_issue(self, pr_health_service):
        """Test PR that is too large."""
        issues = pr_health_service._identify_issues(0, 5, 1500, 2.0, 20.0)
        
        assert len(issues) == 1
        assert "Very large PR (1500 lines)" in issues[0]

    def test_slow_review_issue(self, pr_health_service):
        """Test PR with slow first review."""
        issues = pr_health_service._identify_issues(0, 5, 100, 30.0, 20.0)
        
        assert len(issues) == 1
        assert "Slow first review" in issues[0]

    def test_slow_merge_issue(self, pr_health_service):
        """Test PR that took too long to merge."""
        issues = pr_health_service._identify_issues(0, 5, 100, 2.0, 200.0)
        
        assert len(issues) == 1
        assert "Slow to merge" in issues[0]

    def test_all_issues(self, pr_health_service):
        """Test PR with all possible issues."""
        issues = pr_health_service._identify_issues(4, 35, 1200, 30.0, 200.0)
        
        assert len(issues) == 5
        assert any("Multiple review rounds" in i for i in issues)
        assert any("Excessive discussion" in i for i in issues)
        assert any("Very large PR" in i for i in issues)
        assert any("Slow first review" in i for i in issues)
        assert any("Slow to merge" in i for i in issues)


class TestPRHealthScoreSerialization:
    """Test PRHealthScore dataclass."""

    def test_to_dict(self):
        """Test conversion to dictionary."""
        score = PRHealthScore(
            pr_number=123,
            pr_title="Test PR",
            repository="test/repo",
            author="dev1",
            created_at=datetime(2026, 1, 1),
            merged_at=datetime(2026, 1, 2),
            health_score=85,
            health_category="excellent",
            review_score=25,
            comment_score=25,
            size_score=20,
            time_score=15,
            review_rounds=0,
            comment_count=3,
            lines_changed=150,
            hours_to_first_review=2.0,
            hours_to_merge=20.0,
            issues=[],
        )
        
        result = score.to_dict()
        
        # Verify structure
        assert result["pr_number"] == 123
        assert result["health_score"] == 85
        assert result["health_category"] == "excellent"
        assert "component_scores" in result
        assert "metrics" in result
        assert "issues" in result
        
        # Verify component scores
        assert result["component_scores"]["review"] == 25
        assert result["component_scores"]["comment"] == 25
        assert result["component_scores"]["size"] == 20
        assert result["component_scores"]["time"] == 15
        
        # Verify metrics
        assert result["metrics"]["review_rounds"] == 0
        assert result["metrics"]["comment_count"] == 3
        assert result["metrics"]["lines_changed"] == 150
        assert result["metrics"]["hours_to_first_review"] == 2.0
        assert result["metrics"]["hours_to_merge"] == 20.0

    def test_to_dict_with_none_times(self):
        """Test serialization with None time values."""
        score = PRHealthScore(
            pr_number=123,
            pr_title="Test PR",
            repository="test/repo",
            author="dev1",
            created_at=datetime(2026, 1, 1),
            merged_at=None,
            health_score=50,
            health_category="fair",
            review_score=15,
            comment_score=15,
            size_score=10,
            time_score=10,
            review_rounds=2,
            comment_count=20,
            lines_changed=500,
            hours_to_first_review=None,
            hours_to_merge=None,
            issues=["Large PR", "Multiple review rounds"],
        )
        
        result = score.to_dict()
        
        assert result["metrics"]["hours_to_first_review"] is None
        assert result["metrics"]["hours_to_merge"] is None
        assert len(result["issues"]) == 2


class TestEdgeCases:
    """Test edge cases in PR health scoring."""

    def test_all_max_scores(self, pr_health_service):
        """Test PR with perfect score."""
        # Simulate perfect PR
        reviews = []
        comments = []
        pr = Mock(additions=50, deletions=20)
        
        review_score, _ = pr_health_service._calculate_review_score(reviews)
        comment_score, _ = pr_health_service._calculate_comment_score(comments)
        size_score, _ = pr_health_service._calculate_size_score(pr)
        
        total = review_score + comment_score + size_score
        assert total >= 75  # Can get up to 100 with time score

    def test_all_min_scores(self, pr_health_service):
        """Test PR with worst possible score."""
        # Simulate bad PR
        reviews = [Mock(state="CHANGES_REQUESTED") for _ in range(5)]
        comments = [Mock() for _ in range(50)]
        pr = Mock(additions=1500, deletions=500)
        
        review_score, _ = pr_health_service._calculate_review_score(reviews)
        comment_score, _ = pr_health_service._calculate_comment_score(comments)
        size_score, _ = pr_health_service._calculate_size_score(pr)
        
        total = review_score + comment_score + size_score
        assert total == 15  # 5 + 5 + 5 (minimum for each component)

    def test_score_boundaries(self, pr_health_service):
        """Test score boundaries for each tier."""
        # Exactly 200 lines (boundary)
        pr = Mock(additions=100, deletions=100)
        score, lines = pr_health_service._calculate_size_score(pr)
        assert score == 25
        assert lines == 200
        
        # 201 lines (just over boundary)
        pr = Mock(additions=101, deletions=100)
        score, lines = pr_health_service._calculate_size_score(pr)
        assert score == 20
        assert lines == 201
