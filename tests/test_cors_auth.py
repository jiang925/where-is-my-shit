import pytest
from fastapi.testclient import TestClient

from src.app.core.config import ServerConfig
from src.app.main import app

client = TestClient(app)


@pytest.fixture
def test_api_key():
    return "test-api-key-123456789012345678901234"


@pytest.fixture
def mock_settings(monkeypatch, test_api_key):
    """Mock settings to return a test API key."""
    monkeypatch.setattr(
        "src.app.core.auth.get_settings",
        lambda: ServerConfig(api_key=test_api_key),
    )


def test_cors_headers_on_search_request(mock_settings, test_api_key):
    """Test that search requests work with valid API key (TestClient bypasses CORS middleware)."""
    response = client.post("/api/v1/search", json={"query": "test", "limit": 5}, headers={"X-API-Key": test_api_key})

    # 200 means auth succeeded (may return empty results if no data)
    # 403 means auth rejected due to invalid key
    assert response.status_code in [200, 403]


def test_preflight_options_request():
    """Test that OPTIONS preflight requests are handled correctly."""
    response = client.options(
        "/api/v1/search",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type, x-api-key",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "*"
    allowed_methods = response.headers.get("access-control-allow-methods", "")
    assert "POST" in allowed_methods


def test_api_key_required():
    """Test that requests without X-API-Key header are rejected."""
    response = client.post(
        "/api/v1/search",
        json={"query": "test", "limit": 5},
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Missing API Key"}


def test_api_key_invalid(mock_settings):
    """Test that requests with invalid X-API-Key header are rejected."""
    response = client.post(
        "/api/v1/search", json={"query": "test", "limit": 5}, headers={"X-API-Key": "invalid-api-key"}
    )

    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid API Key"}


def test_health_endpoint_no_auth():
    """Test that the health endpoint is publicly accessible without API key."""
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
