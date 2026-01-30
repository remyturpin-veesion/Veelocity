"""Tests for alerts API endpoints."""

import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.fixture
async def client():
    """Async test client for FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_get_alerts_returns_200_and_shape(client: AsyncClient):
    """GET /api/v1/alerts returns 200 and has start_date, end_date, alerts."""
    response = await client.get("/api/v1/alerts")
    assert response.status_code == 200
    data = response.json()
    assert "start_date" in data
    assert "end_date" in data
    assert "alerts" in data
    assert isinstance(data["alerts"], list)


@pytest.mark.asyncio
async def test_post_notify_returns_200_and_shape(client: AsyncClient):
    """POST /api/v1/alerts/notify returns 200 and expected keys when no alerts."""
    with patch(
        "app.api.v1.endpoints.alerts.AlertsService"
    ) as MockAlertsService:
        mock_instance = AsyncMock()
        mock_instance.get_alerts = AsyncMock(return_value=[])
        MockAlertsService.return_value = mock_instance

        response = await client.post("/api/v1/alerts/notify")
        assert response.status_code == 200
        data = response.json()
        assert "notified" in data
        assert "alert_count" in data
        assert "webhook_count" in data
        assert "email_configured" in data
        assert data["notified"] is False
        assert data["alert_count"] == 0
        assert isinstance(data["webhook_count"], int)
        assert isinstance(data["email_configured"], bool)
