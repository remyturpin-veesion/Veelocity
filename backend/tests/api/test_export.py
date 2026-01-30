"""Tests for export API endpoints."""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app


async def _mock_get_db():
    """Yield a mock session so tests don't need a real DB."""
    yield AsyncMock()


@pytest.fixture
async def client():
    """Async test client for FastAPI app."""
    app.dependency_overrides[get_db] = _mock_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_export_report_json_returns_200_and_structure(client: AsyncClient):
    """GET /api/v1/export/report?format=json returns 200 and report structure."""
    with patch(
        "app.api.v1.endpoints.export.build_report",
        new_callable=AsyncMock,
    ) as mock_build:
        mock_build.return_value = {
            "period": {"start_date": "2026-01-01", "end_date": "2026-01-31"},
            "dora": {
                "deployment_frequency": {"average_per_week": 1.0, "total": 4},
                "lead_time": {"average_hours": 24.0},
                "deployment_reliability": {},
            },
            "development": {
                "pr_review_time": {},
                "pr_merge_time": {},
                "throughput": {"total": 5, "average_per_week": 1.25},
            },
            "alerts": {"count": 0, "items": []},
            "recommendations": {"count": 0, "items": []},
        }

        response = await client.get(
            "/api/v1/export/report",
            params={"format": "json"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "period" in data
        assert "dora" in data
        assert "development" in data
        assert "alerts" in data
        assert "recommendations" in data
        assert mock_build.called


@pytest.mark.asyncio
async def test_export_report_csv_returns_200_and_attachment(client: AsyncClient):
    """GET /api/v1/export/report?format=csv returns 200, CSV body, and Content-Disposition."""
    with patch(
        "app.api.v1.endpoints.export.build_report",
        new_callable=AsyncMock,
    ) as mock_build:
        mock_build.return_value = {
            "period": {"start_date": "2026-01-01", "end_date": "2026-01-31"},
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

        response = await client.get(
            "/api/v1/export/report",
            params={"format": "csv"},
        )

        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        assert "Content-Disposition" in response.headers
        assert "attachment" in response.headers["Content-Disposition"]
        assert ".csv" in response.headers["Content-Disposition"]
        assert "period_start" in response.text
