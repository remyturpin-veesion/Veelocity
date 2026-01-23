import pytest


@pytest.mark.asyncio
async def test_connectors_status_no_config(client):
    """Without GITHUB_TOKEN, returns empty list."""
    response = await client.get("/api/v1/connectors/status")
    assert response.status_code == 200
    assert response.json() == []
