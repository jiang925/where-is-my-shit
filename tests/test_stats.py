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


# ========== Stats Endpoint Tests ==========


def test_stats_basic_counts(client, auth_headers, db_client, test_db_path):
    """Test that stats returns correct total message and conversation counts."""
    db_client.init_db()

    now = datetime.now()

    # Ingest 3 messages across 2 conversations
    ingest_test_message(client, "Msg 1", "chatgpt", now - timedelta(hours=2), "conv-1", auth_headers)
    ingest_test_message(client, "Msg 2", "chatgpt", now - timedelta(hours=1), "conv-1", auth_headers, role="assistant")
    ingest_test_message(client, "Msg 3", "claude", now, "conv-2", auth_headers)

    response = client.get("/api/v1/stats", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert data["total_messages"] == 3
    assert data["total_conversations"] == 2


def test_stats_by_platform(client, auth_headers, db_client, test_db_path):
    """Test that stats returns correct per-platform breakdowns."""
    db_client.init_db()

    now = datetime.now()

    ingest_test_message(client, "GPT msg 1", "chatgpt", now - timedelta(hours=3), "conv-1", auth_headers)
    ingest_test_message(
        client, "GPT msg 2", "chatgpt", now - timedelta(hours=2), "conv-1", auth_headers, role="assistant"
    )
    ingest_test_message(client, "Claude msg", "claude", now - timedelta(hours=1), "conv-2", auth_headers)
    ingest_test_message(client, "Gemini msg", "gemini", now, "conv-3", auth_headers)

    response = client.get("/api/v1/stats", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()

    # Message counts by platform
    assert data["by_platform"]["chatgpt"] == 2
    assert data["by_platform"]["claude"] == 1
    assert data["by_platform"]["gemini"] == 1

    # Conversation counts by platform
    assert data["conversations_by_platform"]["chatgpt"] == 1
    assert data["conversations_by_platform"]["claude"] == 1
    assert data["conversations_by_platform"]["gemini"] == 1


def test_stats_platform_filter(client, auth_headers, db_client, test_db_path):
    """Test that stats respects platform filter query param."""
    db_client.init_db()

    now = datetime.now()

    ingest_test_message(client, "GPT msg", "chatgpt", now - timedelta(hours=1), "conv-1", auth_headers)
    ingest_test_message(client, "Claude msg", "claude", now, "conv-2", auth_headers)

    response = client.get("/api/v1/stats?platforms=chatgpt", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert data["total_messages"] == 1
    assert data["total_conversations"] == 1
    assert "chatgpt" in data["by_platform"]
    assert "claude" not in data["by_platform"]


def test_stats_day_granularity(client, auth_headers, db_client, test_db_path):
    """Test that day granularity returns 30 entries."""
    db_client.init_db()

    now = datetime.now()
    ingest_test_message(client, "Today msg", "chatgpt", now, "conv-1", auth_headers)

    response = client.get("/api/v1/stats?granularity=day", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert len(data["activity"]) == 30

    # Today's entry should have count >= 1
    today_str = now.date().isoformat()
    today_entries = [e for e in data["activity"] if e["date"] == today_str]
    assert len(today_entries) == 1
    assert today_entries[0]["count"] >= 1


def test_stats_week_granularity(client, auth_headers, db_client, test_db_path):
    """Test that week granularity returns 12 entries."""
    db_client.init_db()

    now = datetime.now()
    ingest_test_message(client, "This week msg", "chatgpt", now, "conv-1", auth_headers)

    response = client.get("/api/v1/stats?granularity=week", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert len(data["activity"]) == 12

    # All dates should be Mondays (weekday 0)
    for entry in data["activity"]:
        d = datetime.fromisoformat(entry["date"]).date()
        assert d.weekday() == 0, f"{entry['date']} is not a Monday"


def test_stats_month_granularity(client, auth_headers, db_client, test_db_path):
    """Test that month granularity returns 12 entries."""
    db_client.init_db()

    now = datetime.now()
    ingest_test_message(client, "This month msg", "chatgpt", now, "conv-1", auth_headers)

    response = client.get("/api/v1/stats?granularity=month", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert len(data["activity"]) == 12

    # All dates should be first of month
    for entry in data["activity"]:
        assert entry["date"].endswith("-01"), f"{entry['date']} is not first of month"


def test_stats_invalid_granularity(client, auth_headers, db_client, test_db_path):
    """Test that invalid granularity is rejected."""
    db_client.init_db()

    response = client.get("/api/v1/stats?granularity=invalid", headers=auth_headers)
    assert response.status_code == 422  # FastAPI validation error


def test_stats_empty_database(client, auth_headers, db_client, test_db_path):
    """Test that stats works on an empty database."""
    db_client.init_db()

    response = client.get("/api/v1/stats", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert data["total_messages"] == 0
    assert data["total_conversations"] == 0
    assert data["by_platform"] == {}
    assert data["conversations_by_platform"] == {}
    assert len(data["activity"]) == 30  # Default: 30 days of zeros


def test_stats_requires_auth(client):
    """Test that stats endpoint requires authentication."""
    response = client.get("/api/v1/stats")
    assert response.status_code == 403
    assert response.json() == {"detail": "Missing API Key"}


def test_stats_multiple_platforms_filter(client, auth_headers, db_client, test_db_path):
    """Test filtering by multiple platforms."""
    db_client.init_db()

    now = datetime.now()

    ingest_test_message(client, "GPT msg", "chatgpt", now - timedelta(hours=2), "conv-1", auth_headers)
    ingest_test_message(client, "Claude msg", "claude", now - timedelta(hours=1), "conv-2", auth_headers)
    ingest_test_message(client, "Gemini msg", "gemini", now, "conv-3", auth_headers)

    response = client.get("/api/v1/stats?platforms=chatgpt,claude", headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert data["total_messages"] == 2
    assert data["total_conversations"] == 2
    assert "gemini" not in data["by_platform"]
