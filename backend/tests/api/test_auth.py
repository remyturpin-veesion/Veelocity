"""Tests for auth API (register, login, me)."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.deps import get_current_user
from app.main import app
from app.models.user import User


async def _mock_get_db():
    yield AsyncMock()


def _mock_user():
    return User(
        id=1,
        email="test@example.com",
        password_hash="",
        created_at=datetime.utcnow(),
        is_active=True,
    )


@pytest.fixture
async def client():
    """Client with mocked get_db and get_current_user for protected route (me)."""
    app.dependency_overrides[get_db] = _mock_get_db
    async def override_get_current_user():
        return _mock_user()
    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_register_returns_token_and_user(client: AsyncClient):
    """POST /api/v1/auth/register creates user and returns token."""
    with patch("app.api.v1.endpoints.auth.register_user", new_callable=AsyncMock) as mock_register:
        mock_user = User(
            id=1,
            email="newuser@example.com",
            password_hash="hash",
            created_at=datetime.utcnow(),
            is_active=True,
        )
        mock_register.return_value = mock_user
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "newuser@example.com", "password": "securepass123"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "newuser@example.com"
    assert "id" in data["user"]


@pytest.mark.asyncio
async def test_register_duplicate_email_returns_400(client: AsyncClient):
    """Registering same email twice returns 400."""
    with patch("app.api.v1.endpoints.auth.register_user", new_callable=AsyncMock) as mock_register:
        mock_register.side_effect = ValueError("A user with this email already exists")
        response = await client.post(
            "/api/v1/auth/register",
            json={"email": "dup@example.com", "password": "securepass123"},
        )
    assert response.status_code == 400
    assert "already exists" in response.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_login_returns_token(client: AsyncClient):
    """POST /api/v1/auth/login returns token for valid credentials."""
    with patch("app.api.v1.endpoints.auth.authenticate_user", new_callable=AsyncMock) as mock_auth:
        mock_user = User(
            id=1,
            email="login@example.com",
            password_hash="hash",
            created_at=datetime.utcnow(),
            is_active=True,
        )
        mock_auth.return_value = mock_user
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "login@example.com", "password": "mypassword123"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "login@example.com"


@pytest.mark.asyncio
async def test_login_invalid_returns_401(client: AsyncClient):
    """Login with invalid credentials returns 401."""
    with patch("app.api.v1.endpoints.auth.authenticate_user", new_callable=AsyncMock) as mock_auth:
        mock_auth.return_value = None
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "wrong@example.com", "password": "wrong"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_returns_user_with_valid_token(client: AsyncClient):
    """GET /api/v1/auth/me returns user when Bearer token is valid."""
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer any-token-works-due-to-mock"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"


@pytest.fixture
async def client_no_auth():
    """Client with only get_db mocked (no auth override) to test 401 on protected routes."""
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
async def test_me_without_token_returns_401(client_no_auth: AsyncClient):
    """GET /api/v1/auth/me returns 401 without Authorization header."""
    response = await client_no_auth.get("/api/v1/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_change_password_success(client: AsyncClient):
    """POST /api/v1/auth/change-password updates password and returns 200."""
    with patch("app.api.v1.endpoints.auth.change_password", new_callable=AsyncMock) as mock_change:
        mock_user = User(
            id=1,
            email="test@example.com",
            password_hash="newhash",
            created_at=datetime.utcnow(),
            is_active=True,
        )
        mock_change.return_value = mock_user
        response = await client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": "Bearer any"},
            json={
                "current_password": "oldpass123",
                "new_password": "newpass123",
                "new_password_confirm": "newpass123",
            },
        )
    assert response.status_code == 200
    assert response.json().get("message") == "Password updated"


@pytest.mark.asyncio
async def test_change_password_wrong_current_returns_400(client: AsyncClient):
    """Change password with wrong current password returns 400."""
    with patch("app.api.v1.endpoints.auth.change_password", new_callable=AsyncMock) as mock_change:
        mock_change.return_value = None
        response = await client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": "Bearer any"},
            json={
                "current_password": "wrong",
                "new_password": "newpass123",
                "new_password_confirm": "newpass123",
            },
        )
    assert response.status_code == 400
    assert "incorrect" in response.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_change_password_mismatch_returns_422(client: AsyncClient):
    """New password and confirmation mismatch returns 422 (validation error)."""
    response = await client.post(
        "/api/v1/auth/change-password",
        headers={"Authorization": "Bearer any"},
        json={
            "current_password": "oldpass",
            "new_password": "newpass123",
            "new_password_confirm": "different123",
        },
    )
    assert response.status_code == 422