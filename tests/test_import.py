import io
import json
import os
import shutil
import tempfile
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from src.app.core.config import ServerConfig


@pytest.fixture
def test_api_key():
    return "test-api-key-123456789012345678901234"


@pytest.fixture
def temp_db_dir():
    """Create and clean up a temp directory for test DB."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def mock_settings(monkeypatch, test_api_key, temp_db_dir):
    from src.app.core.config import EmbeddingConfig
    from src.app.db.client import db_client
    from src.app.services.embedding import EmbeddingService

    db_path = os.path.join(temp_db_dir, "test.lance")
    test_config = ServerConfig(
        api_key=test_api_key,
        DB_PATH=db_path,
        embedding=EmbeddingConfig(provider="fastembed", model="BAAI/bge-small-en-v1.5", dimensions=384),
    )

    monkeypatch.setattr("src.app.core.auth.get_settings", lambda: test_config)
    monkeypatch.setattr("src.app.core.config.settings", test_config)
    monkeypatch.setattr("src.app.core.config.get_settings", lambda: test_config)
    monkeypatch.setattr("src.app.services.embedding.get_settings", lambda: test_config)
    monkeypatch.setattr("src.app.db.client.settings", test_config)

    EmbeddingService.reset()
    # Reset the existing db_client singleton to force reconnection with new path
    db_client._db = None
    db_client._tables = {}


@pytest.fixture
def client(mock_settings):
    from src.app.main import app

    with TestClient(app) as c:
        yield c


def _upload_json(client, url, data, api_key):
    """Upload JSON data as a file."""
    json_bytes = json.dumps(data).encode("utf-8")
    return client.post(
        url,
        files={"file": ("test.json", io.BytesIO(json_bytes), "application/json")},
        headers={"X-API-Key": api_key},
    )


class TestWimsImport:
    def test_import_wims_archive(self, client, test_api_key):
        """Import a valid WIMS archive."""
        archive = {
            "version": "1.0",
            "exported_at": datetime.now(UTC).isoformat(),
            "source": "wims",
            "conversations": [
                {
                    "conversation_id": "import-test-1",
                    "platform": "chatgpt",
                    "title": "Import Test",
                    "url": "https://chat.openai.com/c/import-test-1",
                    "messages": [
                        {
                            "id": "msg-1",
                            "role": "user",
                            "content": "How do I import data into WIMS?",
                            "timestamp": datetime.now(UTC).isoformat(),
                        },
                        {
                            "id": "msg-2",
                            "role": "assistant",
                            "content": "You can use the import endpoint.",
                            "timestamp": datetime.now(UTC).isoformat(),
                        },
                    ],
                }
            ],
        }

        response = _upload_json(client, "/api/v1/import", archive, test_api_key)
        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 2
        assert data["conversations"] == 1
        assert data["archive_version"] == "1.0"

    def test_import_invalid_format(self, client, test_api_key):
        """Reject invalid WIMS archive format."""
        response = _upload_json(client, "/api/v1/import", {"not_valid": True}, test_api_key)
        assert response.status_code == 400

    def test_import_skips_empty_messages(self, client, test_api_key):
        """Messages with empty content are skipped."""
        archive = {
            "version": "1.0",
            "conversations": [
                {
                    "conversation_id": "import-empty",
                    "platform": "chatgpt",
                    "messages": [
                        {
                            "id": "msg-1", "role": "user",
                            "content": "Valid message",
                            "timestamp": datetime.now(UTC).isoformat(),
                        },
                        {
                            "id": "msg-2", "role": "assistant",
                            "content": "",
                            "timestamp": datetime.now(UTC).isoformat(),
                        },
                        {
                            "id": "msg-3", "role": "assistant",
                            "content": "  ",
                            "timestamp": datetime.now(UTC).isoformat(),
                        },
                    ],
                }
            ],
        }

        response = _upload_json(client, "/api/v1/import", archive, test_api_key)
        assert response.status_code == 200
        assert response.json()["imported"] == 1

    def test_import_requires_auth(self, client):
        """Import endpoint requires authentication."""
        response = client.post(
            "/api/v1/import",
            files={"file": ("test.json", io.BytesIO(b"{}"), "application/json")},
        )
        assert response.status_code in (401, 403)


class TestChatGPTImport:
    def test_import_chatgpt(self, client, test_api_key):
        """Import a ChatGPT conversations.json export."""
        chatgpt_data = [
            {
                "id": "chatgpt-conv-1",
                "title": "React Hooks Help",
                "create_time": 1710000000,
                "mapping": {
                    "node-1": {
                        "message": {
                            "id": "msg-u1",
                            "author": {"role": "user"},
                            "content": {"parts": ["How do useEffect hooks work?"]},
                            "create_time": 1710000000,
                        }
                    },
                    "node-2": {
                        "message": {
                            "id": "msg-a1",
                            "author": {"role": "assistant"},
                            "content": {"parts": ["useEffect runs after render."]},
                            "create_time": 1710000001,
                        }
                    },
                },
            }
        ]

        response = _upload_json(client, "/api/v1/import/chatgpt", chatgpt_data, test_api_key)
        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 2
        assert data["conversations"] == 1
        assert data["platform"] == "chatgpt"

    def test_import_chatgpt_skips_system(self, client, test_api_key):
        """System messages are excluded from ChatGPT import."""
        chatgpt_data = [
            {
                "id": "chatgpt-conv-sys",
                "title": "With System",
                "create_time": 1710000000,
                "mapping": {
                    "sys-node": {
                        "message": {
                            "id": "msg-sys",
                            "author": {"role": "system"},
                            "content": {"parts": ["You are a helpful assistant"]},
                            "create_time": 1710000000,
                        }
                    },
                    "user-node": {
                        "message": {
                            "id": "msg-user",
                            "author": {"role": "user"},
                            "content": {"parts": ["Hello"]},
                            "create_time": 1710000001,
                        }
                    },
                },
            }
        ]

        response = _upload_json(client, "/api/v1/import/chatgpt", chatgpt_data, test_api_key)
        assert response.status_code == 200
        assert response.json()["imported"] == 1  # system message excluded

    def test_import_chatgpt_invalid(self, client, test_api_key):
        """Reject non-array ChatGPT data."""
        response = _upload_json(client, "/api/v1/import/chatgpt", {"not": "an array"}, test_api_key)
        assert response.status_code == 400


class TestClaudeImport:
    def test_import_claude(self, client, test_api_key):
        """Import a Claude data export."""
        claude_data = [
            {
                "uuid": "claude-conv-1",
                "name": "Python Debugging",
                "chat_messages": [
                    {
                        "uuid": "msg-c1",
                        "sender": "human",
                        "text": "My Python script crashes on import",
                        "created_at": datetime.now(UTC).isoformat(),
                    },
                    {
                        "uuid": "msg-c2",
                        "sender": "assistant",
                        "text": "Check your import paths and dependencies.",
                        "created_at": datetime.now(UTC).isoformat(),
                    },
                ],
            }
        ]

        response = _upload_json(client, "/api/v1/import/claude", claude_data, test_api_key)
        assert response.status_code == 200
        data = response.json()
        assert data["imported"] == 2
        assert data["conversations"] == 1
        assert data["platform"] == "claude"

    def test_import_claude_requires_auth(self, client):
        """Claude import requires authentication."""
        response = client.post(
            "/api/v1/import/claude",
            files={"file": ("test.json", io.BytesIO(b"[]"), "application/json")},
        )
        assert response.status_code in (401, 403)


class TestJsonExport:
    def test_export_json_format(self, client, test_api_key):
        """Export as WIMS JSON archive."""
        # Ingest test data
        client.post(
            "/api/v1/ingest",
            json={
                "conversation_id": "json-export-test",
                "platform": "chatgpt",
                "content": "JSON export test message",
                "role": "user",
                "timestamp": datetime.now(UTC).isoformat(),
                "title": "JSON Export",
            },
            headers={"X-API-Key": test_api_key},
        )

        response = client.post(
            "/api/v1/export",
            json={"format": "json"},
            headers={"X-API-Key": test_api_key},
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"
        assert "wims-archive-" in response.headers.get("content-disposition", "")

        data = response.json()
        assert data["version"] == "1.0"
        assert data["source"] == "wims"
        assert "conversations" in data
        assert len(data["conversations"]) >= 1

        # Verify conversation structure
        conv = next(c for c in data["conversations"] if c["conversation_id"] == "json-export-test")
        assert conv["platform"] == "chatgpt"
        assert conv["title"] == "JSON Export"
        assert len(conv["messages"]) >= 1
        assert conv["messages"][0]["content"] == "JSON export test message"

    def test_export_json_roundtrip(self, client, test_api_key):
        """Export as JSON, then re-import should work."""
        # Ingest
        client.post(
            "/api/v1/ingest",
            json={
                "conversation_id": "roundtrip-test",
                "platform": "claude",
                "content": "This is a roundtrip test",
                "role": "user",
                "timestamp": datetime.now(UTC).isoformat(),
                "title": "Roundtrip",
            },
            headers={"X-API-Key": test_api_key},
        )

        # Export as JSON
        export_response = client.post(
            "/api/v1/export",
            json={"format": "json"},
            headers={"X-API-Key": test_api_key},
        )
        assert export_response.status_code == 200
        archive = export_response.json()

        # Import the exported data (re-import detects duplicates)
        import_response = _upload_json(client, "/api/v1/import", archive, test_api_key)
        assert import_response.status_code == 200
        result = import_response.json()
        # Dedup: existing messages are skipped
        assert result["skipped_duplicates"] >= 1
        assert result["imported"] + result["skipped_duplicates"] >= 1
