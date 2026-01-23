"""Tests for pagination schemas and utilities."""

import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient

from app.schemas.pagination import (
    PaginatedResponse,
    PaginationParams,
    get_pagination_params,
)
from app.core.config import settings


class TestPaginationParams:
    """Test PaginationParams model."""

    def test_default_values(self):
        """Test default pagination values."""
        params = PaginationParams()
        assert params.page == 1
        assert params.limit == settings.pagination_default_limit

    def test_offset_calculation(self):
        """Test offset is calculated correctly."""
        params = PaginationParams(page=1, limit=20)
        assert params.offset == 0

        params = PaginationParams(page=2, limit=20)
        assert params.offset == 20

        params = PaginationParams(page=3, limit=50)
        assert params.offset == 100


class TestPaginatedResponse:
    """Test PaginatedResponse model."""

    def test_create_first_page(self):
        """Test creating response for first page."""
        items = [{"id": i} for i in range(20)]
        params = PaginationParams(page=1, limit=20)
        
        response = PaginatedResponse.create(items, total=100, params=params)
        
        assert response.total == 100
        assert response.page == 1
        assert response.limit == 20
        assert response.pages == 5
        assert response.has_next is True
        assert response.has_prev is False
        assert len(response.items) == 20

    def test_create_middle_page(self):
        """Test creating response for middle page."""
        items = [{"id": i} for i in range(20)]
        params = PaginationParams(page=3, limit=20)
        
        response = PaginatedResponse.create(items, total=100, params=params)
        
        assert response.page == 3
        assert response.has_next is True
        assert response.has_prev is True

    def test_create_last_page(self):
        """Test creating response for last page."""
        items = [{"id": i} for i in range(10)]
        params = PaginationParams(page=5, limit=20)
        
        response = PaginatedResponse.create(items, total=90, params=params)
        
        assert response.pages == 5
        assert response.has_next is False
        assert response.has_prev is True

    def test_create_empty_results(self):
        """Test creating response with no results."""
        params = PaginationParams(page=1, limit=20)
        
        response = PaginatedResponse.create([], total=0, params=params)
        
        assert response.total == 0
        assert response.pages == 0
        assert response.has_next is False
        assert response.has_prev is False


class TestGetPaginationParams:
    """Test the FastAPI dependency."""

    @pytest.fixture
    def app(self):
        """Create test app with pagination endpoint."""
        app = FastAPI()

        @app.get("/test")
        def test_endpoint(params: PaginationParams = Depends(get_pagination_params)):
            return {"page": params.page, "limit": params.limit}

        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    def test_default_params(self, client):
        """Test default pagination parameters."""
        response = client.get("/test")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["limit"] == settings.pagination_default_limit

    def test_custom_params(self, client):
        """Test custom pagination parameters."""
        response = client.get("/test?page=2&limit=50")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["limit"] == 50

    def test_max_limit_enforced(self, client):
        """Test that max limit is enforced by FastAPI validation."""
        response = client.get(f"/test?limit={settings.pagination_max_limit + 1}")
        assert response.status_code == 422  # Validation error

    def test_page_minimum_enforced(self, client):
        """Test that page >= 1 is enforced."""
        response = client.get("/test?page=0")
        assert response.status_code == 422  # Validation error

    def test_limit_minimum_enforced(self, client):
        """Test that limit >= 1 is enforced."""
        response = client.get("/test?limit=0")
        assert response.status_code == 422  # Validation error
