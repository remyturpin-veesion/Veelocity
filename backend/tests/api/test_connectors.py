from unittest.mock import AsyncMock, patch

import pytest

from app.services.credentials import ResolvedCredentials


@pytest.mark.asyncio
async def test_connectors_status_no_config(client):
    """Without credentials (env or DB), returns empty list."""
    empty_creds = ResolvedCredentials(
        github_token=None,
        github_repos="",
        linear_api_key=None,
        linear_workspace_name="",
        cursor_api_key=None,
        greptile_api_key=None,
    )
    with patch(
        "app.api.v1.endpoints.connectors.CredentialsService"
    ) as mock_creds_class:
        mock_instance = mock_creds_class.return_value
        mock_instance.get_credentials = AsyncMock(return_value=empty_creds)
        response = await client.get("/api/v1/connectors/status")
    assert response.status_code == 200
    assert response.json() == []
