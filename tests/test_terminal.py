from unittest.mock import patch

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
    return {"X-API-Key": test_api_key}


def test_open_terminal_requires_auth(client):
    """Test that open-terminal requires authentication."""
    response = client.post("/api/v1/open-terminal", json={"path": "/tmp"})
    assert response.status_code == 403


def test_open_terminal_nonexistent_path(client, auth_headers):
    """Test that open-terminal returns 404 for nonexistent paths."""
    response = client.post(
        "/api/v1/open-terminal",
        json={"path": "/nonexistent/path/that/does/not/exist"},
        headers=auth_headers,
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


@patch("src.app.api.v1.endpoints.terminal.subprocess.Popen")
def test_open_terminal_opens_directory(mock_popen, client, auth_headers, tmp_path):
    """Test that open-terminal calls subprocess for a valid directory."""
    response = client.post(
        "/api/v1/open-terminal",
        json={"path": str(tmp_path)},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["opened"] == str(tmp_path)
    mock_popen.assert_called_once()


@patch("src.app.api.v1.endpoints.terminal.subprocess.Popen")
def test_open_terminal_file_opens_parent(mock_popen, client, auth_headers, tmp_path):
    """Test that open-terminal opens parent directory when given a file path."""
    test_file = tmp_path / "test.txt"
    test_file.write_text("hello")

    response = client.post(
        "/api/v1/open-terminal",
        json={"path": str(test_file)},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["opened"] == str(tmp_path)
    mock_popen.assert_called_once()
