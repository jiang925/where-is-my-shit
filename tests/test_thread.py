from datetime import datetime, timedelta

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


def ingest_test_message(
    client, content: str, platform: str, timestamp: datetime, conversation_id: str, headers: dict, role: str = "user"
):
    """Helper to ingest a test message."""
    response = client.post(
        "/api/v1/ingest",
        json={
            "conversation_id": conversation_id,
            "platform": platform,
            "title": f"Test {platform} conversation",
            "content": content,
            "role": role,
            "timestamp": timestamp.isoformat(),
            "url": f"https://{platform}.example.com/test",
        },
        headers=headers,
    )
    assert response.status_code == 201, f"Ingest failed: {response.text}"
    return response.json()


def test_thread_returns_messages_oldest_first(client, auth_headers, db_client, test_db_path):
    """Test that thread returns all messages for a conversation sorted oldest first."""
    db_client.init_db()

    now = datetime.now()
    conv_id = "test-conv-123"

    # Ingest 3 messages in the same conversation with different timestamps and roles
    ingest_test_message(client, "Hello AI", "chatgpt", now - timedelta(hours=2), conv_id, auth_headers, role="user")
    ingest_test_message(
        client, "Hi! How can I help?", "chatgpt", now - timedelta(hours=1), conv_id, auth_headers, role="assistant"
    )
    ingest_test_message(client, "Tell me a joke", "chatgpt", now, conv_id, auth_headers, role="user")

    response = client.get(f"/api/v1/thread/{conv_id}", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert data["total"] == 3
    assert data["hasMore"] is False
    assert data["nextCursor"] is None
    assert len(data["items"]) == 3

    # Verify oldest first ordering
    assert data["items"][0]["content"] == "Hello AI"
    assert data["items"][1]["content"] == "Hi! How can I help?"
    assert data["items"][2]["content"] == "Tell me a joke"


def test_thread_includes_role_field(client, auth_headers, db_client, test_db_path):
    """Test that thread response includes the role field for each message."""
    db_client.init_db()

    now = datetime.now()
    conv_id = "role-test-conv"

    ingest_test_message(
        client, "User message", "claude", now - timedelta(minutes=2), conv_id, auth_headers, role="user"
    )
    ingest_test_message(
        client, "Assistant reply", "claude", now - timedelta(minutes=1), conv_id, auth_headers, role="assistant"
    )

    response = client.get(f"/api/v1/thread/{conv_id}", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert len(data["items"]) == 2
    assert data["items"][0]["role"] == "user"
    assert data["items"][1]["role"] == "assistant"


def test_thread_filters_by_conversation_id(client, auth_headers, db_client, test_db_path):
    """Test that thread only returns messages for the specified conversation."""
    db_client.init_db()

    now = datetime.now()

    # Ingest messages in two different conversations
    ingest_test_message(client, "Conv A msg", "chatgpt", now, "conv-a", auth_headers)
    ingest_test_message(client, "Conv B msg", "claude", now, "conv-b", auth_headers)

    response = client.get("/api/v1/thread/conv-a", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["content"] == "Conv A msg"
    assert data["items"][0]["conversation_id"] == "conv-a"


def test_thread_empty_conversation(client, auth_headers, db_client, test_db_path):
    """Test that thread returns empty when conversation doesn't exist."""
    db_client.init_db()

    response = client.get("/api/v1/thread/nonexistent-conv", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert len(data["items"]) == 0
    assert data["total"] == 0


def test_thread_rejects_invalid_conversation_id(client, auth_headers, db_client, test_db_path):
    """Test that thread rejects conversation IDs with special characters."""
    db_client.init_db()

    # SQL injection attempt
    response = client.get("/api/v1/thread/'; DROP TABLE messages;--", headers=auth_headers)
    assert response.status_code == 400
    assert "Invalid conversation_id" in response.json()["detail"]

    # Special characters that could break WHERE clause
    response = client.get("/api/v1/thread/conv' OR '1'='1", headers=auth_headers)
    assert response.status_code == 400


def test_thread_requires_auth(client):
    """Test that thread endpoint requires authentication."""
    response = client.get("/api/v1/thread/some-conv-id")
    assert response.status_code == 403
    assert response.json() == {"detail": "Missing API Key"}


def test_delete_conversation_removes_all_messages(client, auth_headers, db_client, test_db_path):
    """Test that delete removes all messages for a conversation."""
    db_client.init_db()

    now = datetime.now()
    conv_id = "delete-test-conv"

    # Ingest 3 messages
    ingest_test_message(client, "Msg 1", "chatgpt", now - timedelta(hours=2), conv_id, auth_headers)
    ingest_test_message(client, "Msg 2", "chatgpt", now - timedelta(hours=1), conv_id, auth_headers, role="assistant")
    ingest_test_message(client, "Msg 3", "chatgpt", now, conv_id, auth_headers)

    # Verify messages exist
    response = client.get(f"/api/v1/thread/{conv_id}", headers=auth_headers)
    assert response.json()["total"] == 3

    # Delete
    response = client.delete(f"/api/v1/conversations/{conv_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["deleted"] == 3
    assert response.json()["conversation_id"] == conv_id

    # Verify messages are gone
    response = client.get(f"/api/v1/thread/{conv_id}", headers=auth_headers)
    assert response.json()["total"] == 0


def test_delete_conversation_not_found(client, auth_headers, db_client, test_db_path):
    """Test that deleting a nonexistent conversation returns 404."""
    db_client.init_db()

    response = client.delete("/api/v1/conversations/nonexistent-conv", headers=auth_headers)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_delete_conversation_does_not_affect_others(client, auth_headers, db_client, test_db_path):
    """Test that deleting one conversation doesn't affect other conversations."""
    db_client.init_db()

    now = datetime.now()

    # Ingest messages in two conversations
    ingest_test_message(client, "Keep me", "chatgpt", now, "keep-conv", auth_headers)
    ingest_test_message(client, "Delete me", "chatgpt", now, "delete-conv", auth_headers)

    # Delete one conversation
    response = client.delete("/api/v1/conversations/delete-conv", headers=auth_headers)
    assert response.status_code == 200

    # Verify the other conversation is untouched
    response = client.get("/api/v1/thread/keep-conv", headers=auth_headers)
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["content"] == "Keep me"


def test_delete_conversation_requires_auth(client):
    """Test that delete endpoint requires authentication."""
    response = client.delete("/api/v1/conversations/some-conv-id")
    assert response.status_code == 403


def test_delete_conversation_rejects_invalid_id(client, auth_headers, db_client, test_db_path):
    """Test that delete rejects conversation IDs with special characters."""
    db_client.init_db()

    response = client.delete("/api/v1/conversations/'; DROP TABLE messages;--", headers=auth_headers)
    assert response.status_code == 400
