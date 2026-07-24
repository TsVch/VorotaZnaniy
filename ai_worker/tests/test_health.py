"""Tests for the health check endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the FastAPI application."""
    return TestClient(app)


class TestHealthEndpoint:
    """Test suite for GET /health."""

    def test_health_returns_ok_status(self, client: TestClient) -> None:
        """Should return 200 with status ok and service name."""
        response = client.get("/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "ai_worker"

    def test_health_returns_valid_json(self, client: TestClient) -> None:
        """Should return valid JSON with correct keys."""
        response = client.get("/health")
        data = response.json()

        assert isinstance(data, dict)
        assert "status" in data
        assert "service" in data
        assert len(data) == 2
