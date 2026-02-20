from datetime import datetime

import pytest
from httpx import AsyncClient, ASGITransport

from app.core.deps import get_current_user
from app.main import app
from app.models.user import User


@pytest.fixture
def mock_user():
    """User returned by get_current_user in tests (so protected routes stay testable)."""
    return User(
        id=1,
        email="test@example.com",
        password_hash="",
        created_at=datetime.utcnow(),
    )


@pytest.fixture
async def client(mock_user):
    """Async test client for FastAPI app. Overrides auth so protected routes work without a real token."""
    async def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_current_user] = override_get_current_user
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_current_user, None)
