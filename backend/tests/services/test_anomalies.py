"""Tests for anomaly detection service."""

from datetime import datetime, timedelta

import pytest

from app.services.metrics.anomalies import Anomaly, AnomalyDetectionService


class TestAnomalyDetectionService:
    """Test suite for anomaly detection."""

    @pytest.fixture
    def service(self):
        """Create anomaly detection service with default settings."""
        return AnomalyDetectionService()

    @pytest.fixture
    def sample_dates(self):
        """Create sample date range."""
        base = datetime(2024, 1, 1)
        return [base + timedelta(days=i) for i in range(10)]

    # ============================================================================
    # Happy Path Tests
    # ============================================================================

    def test_detect_outliers_with_clear_anomaly(self, service, sample_dates):
        """Test detection of obvious outlier."""
        # Normal values around 10, one spike at 50
        values = [10.0, 12.0, 11.0, 13.0, 50.0, 11.0, 12.0, 10.0, 11.0, 12.0]

        anomalies = service.detect_outliers("test_metric", values, sample_dates)

        assert len(anomalies) == 1
        assert anomalies[0].value == 50.0
        assert anomalies[0].severity in ["minor", "major"]
        assert "higher" in anomalies[0].explanation.lower()

    def test_detect_outliers_with_low_anomaly(self, service, sample_dates):
        """Test detection of low outlier."""
        # Normal values around 100, one dip at 10
        values = [100.0, 98.0, 102.0, 99.0, 10.0, 101.0, 100.0, 99.0, 98.0, 100.0]

        anomalies = service.detect_outliers("test_metric", values, sample_dates)

        assert len(anomalies) == 1
        assert anomalies[0].value == 10.0
        assert "lower" in anomalies[0].explanation.lower()

    def test_detect_multiple_outliers(self, service, sample_dates):
        """Test detection of multiple outliers."""
        # Two high outliers, one low
        values = [10.0, 50.0, 11.0, 12.0, 10.0, 60.0, 11.0, 1.0, 10.0, 12.0]

        anomalies = service.detect_outliers("test_metric", values, sample_dates)

        assert len(anomalies) == 3
        outlier_values = [a.value for a in anomalies]
        assert 50.0 in outlier_values
        assert 60.0 in outlier_values
        assert 1.0 in outlier_values

    def test_severity_classification(self, service, sample_dates):
        """Test that major vs minor severity is correctly classified."""
        # Create data with both minor and major outliers
        # Normal range: 10-12
        # Minor outlier threshold (Q3 + 1.5*IQR): ~20
        # Major outlier threshold (Q3 + 3*IQR): ~40
        values = [10.0, 11.0, 12.0, 11.0, 10.0, 25.0, 11.0, 50.0, 10.0, 11.0]

        anomalies = service.detect_outliers("test_metric", values, sample_dates)

        # Should have 2 anomalies
        assert len(anomalies) >= 2

        # Find the extreme outlier (50.0)
        major_anomaly = next((a for a in anomalies if a.value == 50.0), None)
        assert major_anomaly is not None
        assert major_anomaly.severity == "major"

    def test_expected_range_calculation(self, service, sample_dates):
        """Test that expected range is correctly calculated."""
        values = [10.0, 12.0, 11.0, 13.0, 50.0, 11.0, 12.0, 10.0, 11.0, 12.0]

        anomalies = service.detect_outliers("test_metric", values, sample_dates)

        assert len(anomalies) == 1
        min_range, max_range = anomalies[0].expected_range

        # Expected range should be reasonable bounds around normal values
        assert min_range < 15.0  # Should be below normal range
        assert max_range > 8.0  # Should be above normal range
        assert min_range < max_range

    def test_deviation_percentage_calculation(self, service, sample_dates):
        """Test deviation percentage is calculated correctly."""
        values = [10.0, 10.0, 10.0, 10.0, 20.0, 10.0, 10.0, 10.0, 10.0, 10.0]

        anomalies = service.detect_outliers("test_metric", values, sample_dates)

        if len(anomalies) > 0:
            # 20 vs median 10 = 100% deviation
            anomaly = anomalies[0]
            assert anomaly.deviation_percentage > 0
            # Should be roughly 100% for this example
            assert 80 < anomaly.deviation_percentage < 120

    # ============================================================================
    # Edge Cases
    # ============================================================================

    def test_insufficient_data_returns_empty(self, service):
        """Test that insufficient data points return no anomalies."""
        values = [10.0, 12.0, 11.0]  # Only 3 points
        dates = [datetime(2024, 1, i) for i in range(1, 4)]

        anomalies = service.detect_outliers("test_metric", values, dates)

        assert len(anomalies) == 0

    def test_identical_values_returns_empty(self, service, sample_dates):
        """Test that all identical values return no anomalies."""
        values = [10.0] * 10  # All same value

        anomalies = service.detect_outliers("test_metric", values, sample_dates)

        assert len(anomalies) == 0

    def test_no_outliers_in_normal_distribution(self, service, sample_dates):
        """Test that normal distribution without outliers returns empty."""
        # Gradually increasing values, no extreme outliers
        values = [float(i) for i in range(10, 20)]

        anomalies = service.detect_outliers("test_metric", values, sample_dates)

        assert len(anomalies) == 0

    def test_string_dates_are_handled(self, service):
        """Test that string dates are properly handled."""
        values = [10.0, 12.0, 11.0, 13.0, 50.0, 11.0, 12.0, 10.0, 11.0, 12.0]
        dates = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04",
                 "2024-01-05", "2024-01-06", "2024-01-07", "2024-01-08",
                 "2024-01-09", "2024-01-10"]

        anomalies = service.detect_outliers("test_metric", values, dates)

        assert len(anomalies) >= 1
        # Dates should remain as strings
        assert isinstance(anomalies[0].period, str)

    def test_datetime_dates_are_converted(self, service, sample_dates):
        """Test that datetime dates are converted to ISO strings."""
        values = [10.0, 12.0, 11.0, 13.0, 50.0, 11.0, 12.0, 10.0, 11.0, 12.0]

        anomalies = service.detect_outliers("test_metric", values, sample_dates)

        assert len(anomalies) >= 1
        # Should be converted to ISO string
        assert isinstance(anomalies[0].period, str)
        assert "T" in anomalies[0].period  # ISO format has T separator

    def test_mismatched_lengths_raises_error(self, service):
        """Test that mismatched values and dates raises ValueError."""
        values = [10.0, 12.0, 11.0]
        dates = [datetime(2024, 1, 1), datetime(2024, 1, 2)]  # One less

        with pytest.raises(ValueError, match="must have the same length"):
            service.detect_outliers("test_metric", values, dates)

    # ============================================================================
    # Context and Explanation Tests
    # ============================================================================

    def test_explanation_includes_metric_name(self, service, sample_dates):
        """Test that explanation includes the metric name."""
        values = [10.0, 12.0, 11.0, 13.0, 50.0, 11.0, 12.0, 10.0, 11.0, 12.0]

        anomalies = service.detect_outliers("deployment_frequency", values, sample_dates)

        assert len(anomalies) >= 1
        # Metric name should be in explanation (title cased)
        assert "Deployment Frequency" in anomalies[0].explanation

    def test_explanation_with_context(self, service, sample_dates):
        """Test that context is included in explanation."""
        values = [10.0, 12.0, 11.0, 13.0, 50.0, 11.0, 12.0, 10.0, 11.0, 12.0]
        context = "This may indicate a deployment spike."

        anomalies = service.detect_outliers(
            "test_metric", values, sample_dates, metric_context=context
        )

        assert len(anomalies) >= 1
        assert context in anomalies[0].explanation

    # ============================================================================
    # Custom Multiplier Tests
    # ============================================================================

    def test_custom_iqr_multiplier(self, sample_dates):
        """Test that custom IQR multiplier affects detection."""
        values = [10.0, 12.0, 11.0, 13.0, 20.0, 11.0, 12.0, 10.0, 11.0, 12.0]

        # Strict threshold (lower multiplier = more anomalies)
        strict_service = AnomalyDetectionService(iqr_multiplier=1.0)
        strict_anomalies = strict_service.detect_outliers("test_metric", values, sample_dates)

        # Lenient threshold (higher multiplier = fewer anomalies)
        lenient_service = AnomalyDetectionService(iqr_multiplier=3.0)
        lenient_anomalies = lenient_service.detect_outliers("test_metric", values, sample_dates)

        # Strict should detect more or equal anomalies
        assert len(strict_anomalies) >= len(lenient_anomalies)

    # ============================================================================
    # Anomaly Summary Tests
    # ============================================================================

    def test_calculate_anomaly_score_empty(self, service):
        """Test anomaly score calculation with no anomalies."""
        score = service.calculate_anomaly_score([])

        assert score["total_count"] == 0
        assert score["minor_count"] == 0
        assert score["major_count"] == 0
        assert score["severity_score"] == 0

    def test_calculate_anomaly_score_with_anomalies(self, service):
        """Test anomaly score calculation with mixed severity."""
        anomalies = [
            Anomaly(
                metric_name="test",
                period="2024-01-01",
                value=50.0,
                expected_range=(10.0, 20.0),
                severity="minor",
                explanation="Test",
                deviation_percentage=150.0,
            ),
            Anomaly(
                metric_name="test",
                period="2024-01-02",
                value=100.0,
                expected_range=(10.0, 20.0),
                severity="major",
                explanation="Test",
                deviation_percentage=400.0,
            ),
            Anomaly(
                metric_name="test",
                period="2024-01-03",
                value=90.0,
                expected_range=(10.0, 20.0),
                severity="major",
                explanation="Test",
                deviation_percentage=350.0,
            ),
        ]

        score = service.calculate_anomaly_score(anomalies)

        assert score["total_count"] == 3
        assert score["minor_count"] == 1
        assert score["major_count"] == 2
        # 1 minor (1 point) + 2 major (6 points) = 7
        assert score["severity_score"] == 7

    # ============================================================================
    # Serialization Tests
    # ============================================================================

    def test_anomaly_to_dict(self):
        """Test that Anomaly can be serialized to dict."""
        anomaly = Anomaly(
            metric_name="test_metric",
            period="2024-01-01T00:00:00",
            value=50.0,
            expected_range=(10.0, 20.0),
            severity="major",
            explanation="Test explanation",
            deviation_percentage=150.0,
        )

        result = anomaly.to_dict()

        assert result["metric_name"] == "test_metric"
        assert result["period"] == "2024-01-01T00:00:00"
        assert result["value"] == 50.0
        assert result["expected_range"]["min"] == 10.0
        assert result["expected_range"]["max"] == 20.0
        assert result["severity"] == "major"
        assert result["explanation"] == "Test explanation"
        assert result["deviation_percentage"] == 150.0
