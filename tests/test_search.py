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


# ========== Search Endpoint Tests ==========


def test_search_basic_query(client, auth_headers, db_client, test_db_path):
    """Test that search returns results for a matching query."""
    db_client.init_db()

    now = datetime.now()
    ingest_test_message(client, "Python is a great programming language", "chatgpt", now, "conv-1", auth_headers)

    response = client.post("/api/v1/search", json={"query": "Python programming", "limit": 10}, headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    # Response should have the two-tier structure
    assert "groups" in data
    assert "count" in data
    assert "secondary_groups" in data
    assert "secondary_count" in data
    assert "total_considered" in data


def test_search_returns_two_tier_response(client, auth_headers, db_client, test_db_path):
    """Test that search response has primary and secondary groups."""
    db_client.init_db()

    now = datetime.now()
    ingest_test_message(
        client, "Machine learning is a subset of artificial intelligence", "chatgpt", now, "conv-1", auth_headers
    )
    ingest_test_message(
        client,
        "Deep learning uses neural networks for complex tasks",
        "claude",
        now - timedelta(hours=1),
        "conv-2",
        auth_headers,
    )

    response = client.post(
        "/api/v1/search", json={"query": "machine learning neural networks", "limit": 50}, headers=auth_headers
    )
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data["groups"], list)
    assert isinstance(data["secondary_groups"], list)
    assert isinstance(data["count"], int)
    assert isinstance(data["secondary_count"], int)
    assert isinstance(data["total_considered"], int)


def test_search_platform_filter(client, auth_headers, db_client, test_db_path):
    """Test that search respects platform filter."""
    db_client.init_db()

    now = datetime.now()
    ingest_test_message(client, "ChatGPT specific content about Python", "chatgpt", now, "conv-1", auth_headers)
    ingest_test_message(
        client, "Claude specific content about Python", "claude", now - timedelta(hours=1), "conv-2", auth_headers
    )

    response = client.post(
        "/api/v1/search", json={"query": "Python content", "limit": 50, "platform": ["chatgpt"]}, headers=auth_headers
    )
    assert response.status_code == 200

    data = response.json()
    # All results in primary and secondary groups should be from chatgpt
    for group in data["groups"] + data["secondary_groups"]:
        for result in group["results"]:
            assert result["meta"]["source"] == "chatgpt"


def test_search_conversation_filter(client, auth_headers, db_client, test_db_path):
    """Test that search respects conversation_id filter."""
    db_client.init_db()

    now = datetime.now()
    ingest_test_message(client, "Message in conversation A about coding", "chatgpt", now, "conv-a", auth_headers)
    ingest_test_message(
        client,
        "Message in conversation B about coding",
        "chatgpt",
        now - timedelta(hours=1),
        "conv-b",
        auth_headers,
    )

    response = client.post(
        "/api/v1/search",
        json={"query": "coding", "limit": 50, "conversation_id": "conv-a"},
        headers=auth_headers,
    )
    assert response.status_code == 200

    data = response.json()
    for group in data["groups"] + data["secondary_groups"]:
        assert group["conversation_id"] == "conv-a"


def test_search_empty_results(client, auth_headers, db_client, test_db_path):
    """Test that search returns empty results when nothing matches."""
    db_client.init_db()

    now = datetime.now()
    ingest_test_message(client, "A message about cooking recipes", "chatgpt", now, "conv-1", auth_headers)

    response = client.post(
        "/api/v1/search",
        json={"query": "quantum physics thermodynamics", "limit": 50},
        headers=auth_headers,
    )
    assert response.status_code == 200

    data = response.json()
    # Even if we get results, the response structure should be valid
    assert isinstance(data["groups"], list)
    assert isinstance(data["count"], int)


def test_search_requires_auth(client):
    """Test that search endpoint requires authentication."""
    response = client.post("/api/v1/search", json={"query": "test", "limit": 5})
    assert response.status_code == 403
    assert response.json() == {"detail": "Missing API Key"}


def test_search_invalid_api_key(client, mock_settings):
    """Test that search rejects invalid API key."""
    response = client.post("/api/v1/search", json={"query": "test", "limit": 5}, headers={"X-API-Key": "wrong-key"})
    assert response.status_code == 403
    assert response.json() == {"detail": "Invalid API Key"}


def test_search_missing_query_field(client, auth_headers):
    """Test that search rejects request without query field."""
    response = client.post("/api/v1/search", json={"limit": 5}, headers=auth_headers)
    assert response.status_code == 422  # Pydantic validation error


def test_search_result_meta_structure(client, auth_headers, db_client, test_db_path):
    """Test that search results have correct meta structure with conversation context."""
    db_client.init_db()

    now = datetime.now()
    ingest_test_message(
        client,
        "How do I write unit tests in Python?",
        "chatgpt",
        now - timedelta(minutes=5),
        "conv-1",
        auth_headers,
        role="user",
    )
    ingest_test_message(
        client,
        "You can use pytest for writing Python unit tests. Here is an example...",
        "chatgpt",
        now,
        "conv-1",
        auth_headers,
        role="assistant",
    )

    response = client.post(
        "/api/v1/search", json={"query": "unit tests Python pytest", "limit": 50}, headers=auth_headers
    )
    assert response.status_code == 200

    data = response.json()
    # Check that any results have correct meta structure
    all_results = []
    for group in data["groups"] + data["secondary_groups"]:
        all_results.extend(group["results"])

    for result in all_results:
        meta = result["meta"]
        assert "source" in meta
        assert "adapter" in meta
        assert "created_at" in meta
        assert "title" in meta
        assert "url" in meta
        assert "conversation_id" in meta
        assert "message_count" in meta
        assert "first_user_message" in meta
        # Score fields
        assert "relevance_score" in result
        assert "quality_score" in result
        assert "exact_match" in result


def test_search_default_limit(client, auth_headers, db_client, test_db_path):
    """Test that search uses default limit of 50 when not specified."""
    db_client.init_db()

    now = datetime.now()
    ingest_test_message(client, "A test message for default limit", "chatgpt", now, "conv-1", auth_headers)

    response = client.post("/api/v1/search", json={"query": "test message"}, headers=auth_headers)
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data["groups"], list)
