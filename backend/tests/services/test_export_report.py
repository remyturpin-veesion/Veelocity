"""Tests for export report service."""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch

from app.services.export_report import build_report, report_to_csv


class TestReportToCsv:
    """Test report_to_csv."""

    def test_csv_has_header_and_one_row(self):
        """CSV contains header row and one data row."""
        report = {
            "period": {"start_date": "2026-01-01", "end_date": "2026-01-31"},
            "dora": {
                "deployment_frequency": {"average_per_week": 2.5, "total": 10},
                "lead_time": {"average_hours": 24.0},
                "deployment_reliability": {
                    "stability_score": 95.0,
                    "failure_rate": 5.0,
                    "mttr_hours": 2.0,
                },
            },
            "development": {
                "pr_review_time": {"average_hours": 4.0, "count": 5},
                "pr_merge_time": {"average_hours": 12.0, "count": 5},
                "throughput": {"total": 8, "average_per_week": 2.0},
            },
            "alerts": {"count": 1},
            "recommendations": {"count": 2},
        }
        csv_content = report_to_csv(report)
        lines = csv_content.strip().split("\n")
        assert len(lines) == 2
        assert "period_start" in lines[0]
        assert "alert_count" in lines[0]
        assert "2026-01-01" in lines[1]
        assert "1" in lines[1]
        assert "2" in lines[1]

    def test_csv_handles_empty_report(self):
        """CSV handles minimal report structure."""
        report = {
            "period": {},
            "dora": {
                "deployment_frequency": {},
                "lead_time": {},
                "deployment_reliability": {},
            },
            "development": {
                "pr_review_time": {},
                "pr_merge_time": {},
                "throughput": {},
            },
            "alerts": {"count": 0},
            "recommendations": {"count": 0},
        }
        csv_content = report_to_csv(report)
        assert "period_start" in csv_content
        assert csv_content.count("\n") >= 1


class TestBuildReport:
    """Test build_report."""

    @pytest.fixture
    def mock_db(self):
        return AsyncMock()

    @pytest.mark.asyncio
    async def test_build_report_returns_expected_structure(self, mock_db):
        """build_report returns dict with period, dora, development, alerts, recommendations."""
        with (
            patch(
                "app.services.export_report.DORAMetricsService",
                spec=True,
            ) as mock_dora_cls,
            patch(
                "app.services.export_report.DevelopmentMetricsService",
                spec=True,
            ) as mock_dev_cls,
            patch(
                "app.services.export_report.AlertsService",
                spec=True,
            ) as mock_alerts_cls,
            patch(
                "app.services.export_report.RecommendationEngine",
                spec=True,
            ) as mock_rec_cls,
        ):
            mock_dora = AsyncMock()
            mock_dora.get_deployment_frequency.return_value = {
                "average": 1.0,
                "total": 4,
            }
            mock_dora.get_lead_time_for_changes.return_value = {
                "average_hours": 24.0,
                "median_hours": 20.0,
                "count": 5,
            }
            mock_dora.get_deployment_reliability.return_value = {
                "stability_score": 100.0,
                "failure_rate": 0.0,
                "mttr_hours": None,
                "total_runs": 10,
            }
            mock_dora_cls.return_value = mock_dora

            mock_dev = AsyncMock()
            mock_dev.get_pr_review_time.return_value = {
                "average_hours": 6.0,
                "count": 5,
            }
            mock_dev.get_pr_merge_time.return_value = {
                "average_hours": 24.0,
                "count": 5,
            }
            mock_dev.get_throughput.return_value = {"total": 5, "average": 1.25}
            mock_dev_cls.return_value = mock_dev

            mock_alerts = AsyncMock()
            mock_alerts.get_alerts.return_value = []
            mock_alerts_cls.return_value = mock_alerts

            mock_rec = AsyncMock()
            mock_rec.get_recommendations.return_value = []
            mock_rec_cls.return_value = mock_rec

            start = datetime(2026, 1, 1)
            end = datetime(2026, 1, 31)
            report = await build_report(mock_db, start, end, repo_id=None)

        assert "period" in report
        assert report["period"]["start_date"] == start.isoformat()
        assert report["period"]["end_date"] == end.isoformat()
        assert "dora" in report
        assert report["dora"]["deployment_frequency"]["average_per_week"] == 1.0
        assert report["dora"]["lead_time"]["average_hours"] == 24.0
        assert "development" in report
        assert report["development"]["throughput"]["total"] == 5
        assert "alerts" in report
        assert report["alerts"]["count"] == 0
        assert "recommendations" in report
        assert report["recommendations"]["count"] == 0
