from datetime import datetime, timedelta

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
    """Mock settings to return a test API key and small embedding model."""
    from src.app.core.config import EmbeddingConfig

    # Use fastembed with bge-small-en-v1.5 (384 dimensions) for tests
    test_config = ServerConfig(
        api_key=test_api_key,
        embedding=EmbeddingConfig(provider="fastembed", model="BAAI/bge-small-en-v1.5", dimensions=384),
    )
    monkeypatch.setattr("src.app.core.auth.get_settings", lambda: test_config)
    # Also patch the global settings object
    monkeypatch.setattr("src.app.core.config.settings", test_config)


@pytest.fixture
def auth_headers(test_api_key):
    """Return headers with valid API key."""
    return {"X-API-Key": test_api_key}


def ingest_test_message(content: str, platform: str, timestamp: datetime, conversation_id: str, headers: dict):
    """Helper to ingest a test message."""
    response = client.post(
        "/api/v1/ingest",
        json={
            "conversation_id": conversation_id,
            "platform": platform,
            "title": f"Test {platform} conversation",
            "content": content,
            "role": "user",
            "timestamp": timestamp.isoformat(),
            "url": f"https://{platform}.example.com/test",
        },
        headers=headers,
    )
    assert response.status_code == 201, f"Ingest failed: {response.text}"
    return response.json()


def test_browse_returns_conversations_newest_first(mock_settings, auth_headers, db_client, test_db_path):
    """Test that browse returns conversations sorted by timestamp (newest first)."""
    db_client.init_db()

    # Ingest 3 messages with different timestamps
    now = datetime.now()
    _msg1 = ingest_test_message("Oldest message", "chatgpt", now - timedelta(hours=2), "conv1", auth_headers)
    _msg2 = ingest_test_message("Middle message", "claude", now - timedelta(hours=1), "conv2", auth_headers)
    _msg3 = ingest_test_message("Newest message", "gemini", now, "conv3", auth_headers)

    # Browse without filters
    response = client.post("/api/v1/browse", json={"limit": 10}, headers=auth_headers)
    assert response.status_code == 200, f"Browse failed: {response.text}"

    data = response.json()
    assert len(data["items"]) == 3
    assert data["hasMore"] is False

    # Verify order: newest first
    assert data["items"][0]["content"] == "Newest message"
    assert data["items"][1]["content"] == "Middle message"
    assert data["items"][2]["content"] == "Oldest message"


def test_browse_cursor_pagination(mock_settings, auth_headers, db_client, test_db_path):
    """Test cursor-based pagination prevents duplicates."""
    db_client.init_db()

    # Ingest 5 messages with distinct timestamps
    now = datetime.now()
    for i in range(5):
        timestamp = now - timedelta(hours=i)
        ingest_test_message(f"Message {i}", "chatgpt", timestamp, f"conv{i}", auth_headers)

    # First page: limit=2
    response1 = client.post("/api/v1/browse", json={"limit": 2}, headers=auth_headers)
    assert response1.status_code == 200

    data1 = response1.json()
    assert len(data1["items"]) == 2
    assert data1["hasMore"] is True
    assert data1["nextCursor"] is not None

    first_page_ids = {item["id"] for item in data1["items"]}

    # Second page: use cursor
    response2 = client.post("/api/v1/browse", json={"limit": 2, "cursor": data1["nextCursor"]}, headers=auth_headers)
    assert response2.status_code == 200

    data2 = response2.json()
    assert len(data2["items"]) == 2
    assert data2["hasMore"] is True
    assert data2["nextCursor"] is not None

    second_page_ids = {item["id"] for item in data2["items"]}

    # Verify no overlap between pages
    assert first_page_ids.isdisjoint(second_page_ids), "Pages should not have overlapping items"

    # Verify chronological order is maintained
    assert data1["items"][0]["content"] == "Message 0"
    assert data1["items"][1]["content"] == "Message 1"
    assert data2["items"][0]["content"] == "Message 2"
    assert data2["items"][1]["content"] == "Message 3"


def test_browse_date_range_today(mock_settings, auth_headers, db_client, test_db_path):
    """Test date range filter for 'today'."""
    db_client.init_db()

    now = datetime.now()
    week_ago = now - timedelta(days=7)

    # Ingest 2 messages: one today, one from 7 days ago
    ingest_test_message("Today's message", "chatgpt", now, "conv1", auth_headers)
    ingest_test_message("Old message", "claude", week_ago, "conv2", auth_headers)

    # Browse with date_range="today"
    response = client.post("/api/v1/browse", json={"limit": 10, "date_range": "today"}, headers=auth_headers)
    assert response.status_code == 200, f"Browse failed: {response.text}"

    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["content"] == "Today's message"


def test_browse_platform_filter(mock_settings, auth_headers, db_client, test_db_path):
    """Test platform filtering."""
    db_client.init_db()

    now = datetime.now()

    # Ingest messages from different platforms
    ingest_test_message("ChatGPT message", "chatgpt", now - timedelta(hours=1), "conv1", auth_headers)
    ingest_test_message("Claude message", "claude", now - timedelta(hours=2), "conv2", auth_headers)
    ingest_test_message("Gemini message", "gemini", now - timedelta(hours=3), "conv3", auth_headers)

    # Browse with platform filter
    response = client.post("/api/v1/browse", json={"limit": 10, "platforms": ["chatgpt"]}, headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["platform"] == "chatgpt"
    assert data["items"][0]["content"] == "ChatGPT message"


def test_browse_combined_filters(mock_settings, auth_headers, db_client, test_db_path):
    """Test combining date range and platform filters."""
    db_client.init_db()

    now = datetime.now()
    week_ago = now - timedelta(days=7)

    # Ingest messages with different platforms and dates
    ingest_test_message("Recent ChatGPT", "chatgpt", now, "conv1", auth_headers)
    ingest_test_message("Old ChatGPT", "chatgpt", week_ago, "conv2", auth_headers)
    ingest_test_message("Recent Claude", "claude", now, "conv3", auth_headers)

    # Browse with both filters
    response = client.post(
        "/api/v1/browse", json={"limit": 10, "date_range": "today", "platforms": ["chatgpt"]}, headers=auth_headers
    )
    assert response.status_code == 200

    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["content"] == "Recent ChatGPT"
    assert data["items"][0]["platform"] == "chatgpt"


def test_browse_empty_result(mock_settings, auth_headers, db_client, test_db_path):
    """Test browse returns empty result when no matches."""
    db_client.init_db()

    week_ago = datetime.now() - timedelta(days=7)

    # Ingest only an old message
    ingest_test_message("Old message", "chatgpt", week_ago, "conv1", auth_headers)

    # Browse with date_range="today" (should return nothing)
    response = client.post("/api/v1/browse", json={"limit": 10, "date_range": "today"}, headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert len(data["items"]) == 0
    assert data["hasMore"] is False
    assert data["nextCursor"] is None
    assert data["total"] == 0


def test_browse_requires_auth(mock_settings):
    """Test that browse endpoint requires authentication."""
    # Call without X-API-Key header
    response = client.post("/api/v1/browse", json={"limit": 10})
    assert response.status_code == 403
    assert response.json() == {"detail": "Missing API Key"}
