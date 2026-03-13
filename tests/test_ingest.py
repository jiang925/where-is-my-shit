from datetime import datetime

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


# ========== Ingest Endpoint Tests ==========


def test_ingest_basic(client, auth_headers, db_client, test_db_path):
    """Test basic document ingestion returns 201 and created status."""
    db_client.init_db()

    now = datetime.now()
    response = client.post(
        "/api/v1/ingest",
        json={
            "id": "test-msg-001",
            "conversation_id": "conv-1",
            "platform": "chatgpt",
            "title": "Test conversation",
            "content": "Hello, this is a test message",
            "role": "user",
            "timestamp": now.isoformat(),
            "url": "https://chatgpt.example.com/test",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201

    data = response.json()
    assert data["id"] == "test-msg-001"
    assert data["status"] == "created"


def test_ingest_auto_generated_id(client, auth_headers, db_client, test_db_path):
    """Test that an ID is auto-generated when not provided."""
    db_client.init_db()

    now = datetime.now()
    response = client.post(
        "/api/v1/ingest",
        json={
            "conversation_id": "conv-1",
            "platform": "claude",
            "content": "Message without explicit ID",
            "timestamp": now.isoformat(),
        },
        headers=auth_headers,
    )
    assert response.status_code == 201

    data = response.json()
    assert data["id"] is not None
    assert len(data["id"]) > 0
    assert data["status"] == "created"


def test_ingest_duplicate_id(client, auth_headers, db_client, test_db_path):
    """Test ingesting a message with an existing ID (LanceDB appends, doesn't reject)."""
    db_client.init_db()

    now = datetime.now()
    payload = {
        "id": "duplicate-test-id",
        "conversation_id": "conv-1",
        "platform": "chatgpt",
        "content": "First message",
        "timestamp": now.isoformat(),
    }

    # First ingest
    response1 = client.post("/api/v1/ingest", json=payload, headers=auth_headers)
    assert response1.status_code == 201

    # Second ingest with same ID - LanceDB does not enforce uniqueness so this succeeds
    payload["content"] = "Second message same ID"
    response2 = client.post("/api/v1/ingest", json=payload, headers=auth_headers)
    assert response2.status_code == 201


def test_ingest_missing_required_fields(client, auth_headers):
    """Test that missing required fields return 422 validation error."""
    # Missing conversation_id, platform, content, timestamp
    response = client.post(
        "/api/v1/ingest",
        json={"title": "Only title provided"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_ingest_missing_content_field(client, auth_headers):
    """Test that missing content field returns 422."""
    now = datetime.now()
    response = client.post(
        "/api/v1/ingest",
        json={
            "conversation_id": "conv-1",
            "platform": "chatgpt",
            "timestamp": now.isoformat(),
            # content is missing
        },
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_ingest_requires_auth(client):
    """Test that ingest endpoint requires authentication."""
    now = datetime.now()
    response = client.post(
        "/api/v1/ingest",
        json={
            "conversation_id": "conv-1",
            "platform": "chatgpt",
            "content": "Test message",
            "timestamp": now.isoformat(),
        },
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "Missing API Key"}


def test_ingest_invalid_api_key(client, mock_settings):
    """Test that ingest rejects invalid API key."""
    now = datetime.now()
    response = client.post(
        "/api/v1/ingest",
        json={
            "conversation_id": "conv-1",
            "platform": "chatgpt",
            "content": "Test message",
            "timestamp": now.isoformat(),
        },
        headers={"X-API-Key": "wrong-key"},
    )
    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid API Key"}


def test_ingest_default_role(client, auth_headers, db_client, test_db_path):
    """Test that role defaults to 'user' when not provided."""
    db_client.init_db()

    now = datetime.now()
    response = client.post(
        "/api/v1/ingest",
        json={
            "conversation_id": "conv-1",
            "platform": "chatgpt",
            "content": "Message with default role",
            "timestamp": now.isoformat(),
        },
        headers=auth_headers,
    )
    assert response.status_code == 201

    # Verify by retrieving the thread
    msg_id = response.json()["id"]
    thread_response = client.get("/api/v1/thread/conv-1", headers=auth_headers)
    assert thread_response.status_code == 200
    items = thread_response.json()["items"]
    assert len(items) >= 1
    # Find the message we just ingested
    matching = [item for item in items if item["id"] == msg_id]
    assert len(matching) == 1
    assert matching[0]["role"] == "user"
