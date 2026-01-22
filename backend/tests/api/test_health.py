import pytest


@pytest.mark.asyncio
async def test_health_endpoint_returns_healthy(client):
    """Health endpoint should return status healthy."""
    response = await client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


@pytest.mark.asyncio
async def test_root_endpoint_returns_welcome(client):
    """Root endpoint should return welcome message."""
    response = await client.get("/")

    assert response.status_code == 200
    assert "Veelocity" in response.json()["message"]
