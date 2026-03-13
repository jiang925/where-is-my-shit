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


# ========== SPA Serving Tests ==========


def test_spa_index_html_fallback(client):
    """Test that unknown paths serve index.html (SPA client-side routing)."""
    response = client.get("/some/unknown/route")
    assert response.status_code == 200
    # Should serve index.html content
    assert "html" in response.text.lower() or "<!doctype" in response.text.lower() or "<html" in response.text.lower()


def test_spa_root_serves_index(client):
    """Test that root path serves index.html."""
    response = client.get("/")
    assert response.status_code == 200
    assert "html" in response.text.lower() or "<!doctype" in response.text.lower() or "<html" in response.text.lower()


def test_spa_static_file_serving(client):
    """Test that existing static files are served directly."""
    # vite.svg exists in src/static/
    response = client.get("/vite.svg")
    assert response.status_code == 200
    assert "svg" in response.headers.get("content-type", "").lower() or len(response.content) > 0


def test_spa_api_404_passthrough(client):
    """Test that API paths return JSON 404 instead of index.html."""
    response = client.get("/api/nonexistent-endpoint")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Not Found"


def test_spa_path_traversal_prevention(client):
    """Test that path traversal attempts are blocked and serve index.html instead."""
    # Attempt to traverse out of static directory
    response = client.get("/../../etc/passwd")
    assert response.status_code == 200
    # Should serve index.html, not the traversed file
    content = response.text.lower()
    assert "html" in content or "<!doctype" in content or "<html" in content
    assert "root:" not in content  # Ensure /etc/passwd content is not served
