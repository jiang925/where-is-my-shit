import pytest
from fastapi.testclient import TestClient

from src.app.core.config import ServerConfig


@pytest.fixture
def test_api_key():
    return "test-api-key-123456789012345678901234"


@pytest.fixture
def mock_settings(monkeypatch, test_api_key):
    """Mock settings to return a test API key and small embedding model."""
    from src.app.core.config import EmbeddingConfig
    from src.app.services.embedding import EmbeddingService

    test_config = ServerConfig(
        api_key=test_api_key,
        embedding=EmbeddingConfig(provider="fastembed", model="BAAI/bge-small-en-v1.5", dimensions=384),
    )

    monkeypatch.setattr("src.app.core.auth.get_settings", lambda: test_config)
    monkeypatch.setattr("src.app.core.config.settings", test_config)
    monkeypatch.setattr("src.app.core.config.get_settings", lambda: test_config)
    monkeypatch.setattr("src.app.services.embedding.get_settings", lambda: test_config)

    EmbeddingService.reset()


@pytest.fixture
def client(mock_settings):
    """Create TestClient after settings are mocked."""
    from src.app.main import app

    return TestClient(app)


@pytest.fixture
def auth_headers(test_api_key):
    """Return headers with valid API key."""
    return {"X-API-Key": test_api_key}


# ========== Health Endpoint Tests ==========


def test_health_returns_healthy_status(client):
    """Test that health endpoint returns healthy status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "healthy"


def test_health_no_auth_required(client):
    """Test that health endpoint does not require authentication."""
    # No X-API-Key header, should still succeed
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_health_system_stats_present(client):
    """Test that health response includes system stats."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert "system" in data
    system = data["system"]
    assert "memory_percent" in system
    assert "cpu_percent" in system
    assert "disk_percent" in system

    # Validate types and ranges
    assert isinstance(system["memory_percent"], (int, float))
    assert isinstance(system["cpu_percent"], (int, float))
    assert isinstance(system["disk_percent"], (int, float))
    assert 0 <= system["memory_percent"] <= 100
    assert 0 <= system["disk_percent"] <= 100


def test_health_database_stats_present(client):
    """Test that health response includes database stats."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    data = response.json()
    assert "database" in data
    db = data["database"]
    assert "connected" in db
    assert db["connected"] is True
    assert "row_count" in db
