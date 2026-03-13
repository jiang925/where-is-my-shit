import io
import zipfile
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from src.app.core.config import ServerConfig


@pytest.fixture
def test_api_key():
    return "test-api-key-123456789012345678901234"


@pytest.fixture
def mock_settings(monkeypatch, test_api_key):
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
    from src.app.main import app

    return TestClient(app)


def ingest(client, api_key, **kwargs):
    response = client.post(
        "/api/v1/ingest",
        json=kwargs,
        headers={"X-API-Key": api_key},
    )
    assert response.status_code == 201
    return response


class TestExportEndpoint:
    def test_export_returns_zip(self, client, test_api_key):
        """Export endpoint returns a valid zip file."""
        # Ingest test data
        ingest(
            client,
            test_api_key,
            conversation_id="export-conv-1",
            platform="chatgpt",
            content="Hello, how can I help?",
            role="assistant",
            timestamp=datetime.now().isoformat(),
            title="Test Export",
        )

        response = client.post(
            "/api/v1/export",
            json={},
            headers={"X-API-Key": test_api_key},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/zip"
        assert "wims-export-" in response.headers.get("content-disposition", "")

        # Verify it's a valid zip
        zf = zipfile.ZipFile(io.BytesIO(response.content))
        names = zf.namelist()
        assert len(names) >= 1
        assert all(name.endswith(".md") for name in names)

    def test_export_markdown_content(self, client, test_api_key):
        """Exported markdown contains conversation data."""
        ingest(
            client,
            test_api_key,
            conversation_id="export-md-conv",
            platform="claude",
            content="What is Python?",
            role="user",
            timestamp=(datetime.now() - timedelta(minutes=5)).isoformat(),
            title="Python Basics",
        )
        ingest(
            client,
            test_api_key,
            conversation_id="export-md-conv",
            platform="claude",
            content="Python is a programming language.",
            role="assistant",
            timestamp=datetime.now().isoformat(),
            title="Python Basics",
        )

        response = client.post(
            "/api/v1/export",
            json={},
            headers={"X-API-Key": test_api_key},
        )
        assert response.status_code == 200

        zf = zipfile.ZipFile(io.BytesIO(response.content))
        # Find the Python Basics file
        md_content = None
        for name in zf.namelist():
            content = zf.read(name).decode("utf-8")
            if "Python Basics" in content:
                md_content = content
                break

        assert md_content is not None
        assert "# Python Basics" in md_content
        assert "**Platform:** claude" in md_content
        assert "## User" in md_content
        assert "## Assistant" in md_content
        assert "What is Python?" in md_content
        assert "Python is a programming language." in md_content

    def test_export_platform_filter(self, client, test_api_key):
        """Export respects platform filter."""
        ingest(
            client,
            test_api_key,
            conversation_id="export-filter-chatgpt",
            platform="chatgpt",
            content="ChatGPT content",
            role="user",
            timestamp=datetime.now().isoformat(),
            title="ChatGPT Conv",
        )
        ingest(
            client,
            test_api_key,
            conversation_id="export-filter-claude",
            platform="claude",
            content="Claude content",
            role="user",
            timestamp=datetime.now().isoformat(),
            title="Claude Conv",
        )

        # Export only chatgpt
        response = client.post(
            "/api/v1/export",
            json={"platforms": ["chatgpt"]},
            headers={"X-API-Key": test_api_key},
        )
        assert response.status_code == 200

        zf = zipfile.ZipFile(io.BytesIO(response.content))
        all_content = ""
        for name in zf.namelist():
            all_content += zf.read(name).decode("utf-8")

        assert "ChatGPT content" in all_content
        # Claude content should NOT be in the export
        assert "Claude content" not in all_content

    def test_export_requires_auth(self, client):
        """Export endpoint requires authentication."""
        response = client.post("/api/v1/export", json={})
        assert response.status_code in (401, 403)
