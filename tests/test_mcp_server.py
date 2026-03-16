"""Tests for the WIMS MCP server tools."""

import pytest

from src.app.core.config import EmbeddingConfig, ServerConfig


@pytest.fixture
def test_api_key():
    return "test-api-key-123456789012345678901234"


@pytest.fixture
def setup_db(monkeypatch, test_api_key, tmp_path):
    """Set up a temp DB with test data for MCP tool testing."""
    from src.app.services.embedding import EmbeddingService

    test_config = ServerConfig(
        api_key=test_api_key,
        DB_PATH=str(tmp_path / "test.lance"),
        embedding=EmbeddingConfig(provider="fastembed", model="BAAI/bge-small-en-v1.5", dimensions=384),
    )

    monkeypatch.setattr("src.app.core.config.settings", test_config)
    monkeypatch.setattr("src.app.core.config.get_settings", lambda: test_config)
    monkeypatch.setattr("src.app.services.embedding.get_settings", lambda: test_config)

    EmbeddingService.reset()

    # Initialize DB
    from src.app.db.client import DBClient

    client = DBClient.__new__(DBClient)
    client._db = None
    client._tables = {}
    DBClient._instance = client
    monkeypatch.setattr("src.app.db.client.db_client", client)
    monkeypatch.setattr("src.app.mcp_server.db_client", client)

    # Point to tmp DB
    monkeypatch.setattr("src.app.db.client.settings", test_config)
    client.init_db()

    # Ingest test data
    embedding_service = EmbeddingService()
    table = client.get_table("messages")

    from datetime import datetime, timedelta

    messages = [
        {
            "id": "mcp-msg-1",
            "conversation_id": "mcp-conv-react",
            "platform": "chatgpt",
            "title": "React Hooks Guide",
            "content": "How do I use useEffect in React?",
            "role": "user",
            "timestamp": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
            "url": "https://chat.openai.com/c/mcp-conv-react",
            "vector": embedding_service.embed_text("How do I use useEffect in React?"),
            "embedding_model": "BAAI/bge-small-en-v1.5",
        },
        {
            "id": "mcp-msg-2",
            "conversation_id": "mcp-conv-react",
            "platform": "chatgpt",
            "title": "React Hooks Guide",
            "content": "useEffect runs side effects after render.",
            "role": "assistant",
            "timestamp": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
            "url": "https://chat.openai.com/c/mcp-conv-react",
            "vector": embedding_service.embed_text("useEffect runs side effects after render."),
            "embedding_model": "BAAI/bge-small-en-v1.5",
        },
        {
            "id": "mcp-msg-3",
            "conversation_id": "mcp-conv-python",
            "platform": "claude",
            "title": "Python Debugging",
            "content": "Why does my Python script crash on import?",
            "role": "user",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "",
            "vector": embedding_service.embed_text("Why does my Python script crash on import?"),
            "embedding_model": "BAAI/bge-small-en-v1.5",
        },
    ]

    table.add(messages)
    return client


class TestSearchConversations:
    def test_search_returns_results(self, setup_db, monkeypatch):
        """search_conversations finds matching conversations."""
        from src.app.mcp_server import search_conversations

        # Prevent _init from reinitializing
        monkeypatch.setattr("src.app.mcp_server._init", lambda: None)

        result = search_conversations("React hooks useEffect")
        assert "React Hooks Guide" in result
        assert "chatgpt" in result
        assert "mcp-conv-react" in result

    def test_search_no_results(self, setup_db, monkeypatch):
        """search_conversations returns message for no matches."""
        from src.app.mcp_server import search_conversations

        monkeypatch.setattr("src.app.mcp_server._init", lambda: None)

        result = search_conversations("quantum physics entanglement theory", limit=1)
        # Should still return something (vector search always returns results)
        assert isinstance(result, str)

    def test_search_platform_filter(self, setup_db, monkeypatch):
        """search_conversations filters by platform."""
        from src.app.mcp_server import search_conversations

        monkeypatch.setattr("src.app.mcp_server._init", lambda: None)

        result = search_conversations("debugging", platform="claude")
        assert "Python Debugging" in result


class TestGetConversation:
    def test_get_existing_conversation(self, setup_db, monkeypatch):
        """get_conversation returns full thread."""
        from src.app.mcp_server import get_conversation

        monkeypatch.setattr("src.app.mcp_server._init", lambda: None)

        result = get_conversation("mcp-conv-react")
        assert "React Hooks Guide" in result
        assert "How do I use useEffect" in result
        assert "useEffect runs side effects" in result
        assert "User" in result
        assert "Assistant" in result

    def test_get_nonexistent_conversation(self, setup_db, monkeypatch):
        """get_conversation handles missing conversation."""
        from src.app.mcp_server import get_conversation

        monkeypatch.setattr("src.app.mcp_server._init", lambda: None)

        result = get_conversation("nonexistent-id")
        assert "No conversation found" in result


class TestGetRecentConversations:
    def test_get_recent(self, setup_db, monkeypatch):
        """get_recent_conversations returns conversations sorted by date."""
        from src.app.mcp_server import get_recent_conversations

        monkeypatch.setattr("src.app.mcp_server._init", lambda: None)

        result = get_recent_conversations(limit=10)
        assert "Python Debugging" in result
        assert "React Hooks Guide" in result

    def test_get_recent_platform_filter(self, setup_db, monkeypatch):
        """get_recent_conversations filters by platform."""
        from src.app.mcp_server import get_recent_conversations

        monkeypatch.setattr("src.app.mcp_server._init", lambda: None)

        result = get_recent_conversations(platform="chatgpt")
        assert "React Hooks Guide" in result
        assert "Python Debugging" not in result
