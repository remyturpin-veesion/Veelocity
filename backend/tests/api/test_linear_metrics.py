"""Tests for Linear metrics API endpoints."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.database import get_db
from app.main import app
from httpx import ASGITransport, AsyncClient


async def _mock_get_db():
    """Yield a mock session so tests don't need a real DB."""
    yield AsyncMock()


@pytest.fixture
async def client():
    """Async test client with mocked get_db."""
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
async def test_linear_overview_returns_200_and_structure(client):
    """GET /api/v1/metrics/linear/overview returns 200 and overview structure."""
    from unittest.mock import patch

    with patch(
        "app.api.v1.endpoints.metrics.LinearMetricsService"
    ) as mock_service_class:
        mock_service = MagicMock()
        mock_service.get_overview = AsyncMock(
            return_value={
                "start_date": "2025-01-01T00:00:00",
                "end_date": "2025-01-31T00:00:00",
                "issues_completed": 5,
                "issues_completed_per_week": 1.25,
                "backlog_count": 10,
                "time_in_state_average_hours": 24.5,
                "time_in_state_median_hours": 20.0,
                "time_in_state_count": 5,
            }
        )
        mock_service_class.return_value = mock_service

        response = await client.get("/api/v1/metrics/linear/overview")

        assert response.status_code == 200
        data = response.json()
        assert data["issues_completed"] == 5
        assert data["backlog_count"] == 10
        assert data["time_in_state_average_hours"] == 24.5
        assert "start_date" in data
        assert "end_date" in data


@pytest.mark.asyncio
async def test_linear_issues_completed_returns_200_and_structure(client):
    """GET /api/v1/metrics/linear/issues-completed returns 200 and time series."""
    from unittest.mock import patch

    with patch(
        "app.api.v1.endpoints.metrics.LinearMetricsService"
    ) as mock_service_class:
        mock_service = MagicMock()
        mock_service.get_issues_completed = AsyncMock(
            return_value={
                "period": "week",
                "start_date": "2025-01-01T00:00:00",
                "end_date": "2025-01-31T00:00:00",
                "data": [{"period": "2025-W01", "count": 2}, {"period": "2025-W02", "count": 3}],
                "total": 5,
                "average": 1.25,
            }
        )
        mock_service_class.return_value = mock_service

        response = await client.get(
            "/api/v1/metrics/linear/issues-completed",
            params={"period": "week"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["period"] == "week"
        assert len(data["data"]) == 2


@pytest.mark.asyncio
async def test_linear_backlog_returns_200_and_count(client):
    """GET /api/v1/metrics/linear/backlog returns 200 and backlog_count."""
    from unittest.mock import patch

    with patch(
        "app.api.v1.endpoints.metrics.LinearMetricsService"
    ) as mock_service_class:
        mock_service = MagicMock()
        mock_service.get_backlog = AsyncMock(return_value={"backlog_count": 12})
        mock_service_class.return_value = mock_service

        response = await client.get("/api/v1/metrics/linear/backlog")

        assert response.status_code == 200
        assert response.json()["backlog_count"] == 12


@pytest.mark.asyncio
async def test_linear_time_in_state_returns_200_and_structure(client):
    """GET /api/v1/metrics/linear/time-in-state returns 200 and avg/median."""
    from unittest.mock import patch

    with patch(
        "app.api.v1.endpoints.metrics.LinearMetricsService"
    ) as mock_service_class:
        mock_service = MagicMock()
        mock_service.get_time_in_state = AsyncMock(
            return_value={
                "start_date": "2025-01-01T00:00:00",
                "end_date": "2025-01-31T00:00:00",
                "count": 8,
                "average_hours": 36.0,
                "median_hours": 30.0,
                "min_hours": 12.0,
                "max_hours": 72.0,
                "stages": [
                    {
                        "id": "todo",
                        "label": "Todo",
                        "position": 0.0,
                        "count": 23,
                        "min_hours": 0.0,
                        "max_hours": 0.0,
                        "median_hours": 0.0,
                        "average_hours": 0.0,
                    },
                    {
                        "id": "in_progress",
                        "label": "In Progress",
                        "position": 1.0,
                        "count": 8,
                        "min_hours": 12.0,
                        "max_hours": 72.0,
                        "median_hours": 30.0,
                        "average_hours": 36.0,
                    },
                    {
                        "id": "done",
                        "label": "Done",
                        "position": 2.0,
                        "count": 8,
                        "min_hours": 0.0,
                        "max_hours": 0.0,
                        "median_hours": 0.0,
                        "average_hours": 0.0,
                    },
                ],
            }
        )
        mock_service_class.return_value = mock_service

        response = await client.get("/api/v1/metrics/linear/time-in-state")

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 8
        assert data["average_hours"] == 36.0
        assert data["median_hours"] == 30.0
        assert data["min_hours"] == 12.0
        assert data["max_hours"] == 72.0
        assert "stages" in data
        assert len(data["stages"]) == 3
        assert data["stages"][0]["id"] == "todo"
        assert data["stages"][1]["id"] == "in_progress"
        assert data["stages"][2]["id"] == "done"
        assert data["stages"][1]["median_hours"] == 30.0
