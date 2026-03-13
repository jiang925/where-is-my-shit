from datetime import datetime

import pytest
from pydantic import ValidationError

from src.app.schemas.message import (
    BrowseItem,
    BrowseRequest,
    IngestRequest,
    SearchRequest,
    SearchResult,
    SearchResultMeta,
)
from src.app.schemas.stats import ActivityEntry, StatsResponse


# ========== Pydantic Model Tests ==========


def test_ingest_request_validation():
    """Test IngestRequest validates required fields and allows optional ones."""
    now = datetime.now()

    # Valid minimal request
    req = IngestRequest(
        conversation_id="conv-1",
        platform="chatgpt",
        content="Hello world",
        timestamp=now,
    )
    assert req.conversation_id == "conv-1"
    assert req.platform == "chatgpt"
    assert req.content == "Hello world"
    assert req.id is None
    assert req.role == "user"  # default
    assert req.title == ""  # default
    assert req.url == ""  # default


def test_ingest_request_missing_required_fields():
    """Test IngestRequest rejects missing required fields."""
    with pytest.raises(ValidationError):
        IngestRequest(platform="chatgpt", content="test")  # missing conversation_id, timestamp

    with pytest.raises(ValidationError):
        IngestRequest(conversation_id="conv-1", timestamp=datetime.now())  # missing platform, content


def test_search_request_defaults():
    """Test SearchRequest has correct defaults."""
    req = SearchRequest(query="test search")
    assert req.query == "test search"
    assert req.limit == 50
    assert req.offset == 0
    assert req.conversation_id is None
    assert req.platform is None


def test_search_request_with_platform_list():
    """Test SearchRequest accepts platform as list or string."""
    # As list
    req_list = SearchRequest(query="test", platform=["chatgpt", "claude"])
    assert req_list.platform == ["chatgpt", "claude"]

    # As string
    req_str = SearchRequest(query="test", platform="chatgpt")
    assert req_str.platform == "chatgpt"


def test_search_result_meta_fields():
    """Test SearchResultMeta construction with all fields."""
    meta = SearchResultMeta(
        source="chatgpt",
        adapter="chatgpt",
        created_at=1700000000,
        title="Test conversation",
        url="https://chatgpt.com/test",
        conversation_id="conv-1",
        message_count=5,
        first_user_message="Hello, can you help me?",
    )
    assert meta.source == "chatgpt"
    assert meta.adapter == "chatgpt"
    assert meta.created_at == 1700000000
    assert meta.title == "Test conversation"
    assert meta.url == "https://chatgpt.com/test"
    assert meta.conversation_id == "conv-1"
    assert meta.message_count == 5
    assert meta.first_user_message == "Hello, can you help me?"


def test_stats_response_structure():
    """Test StatsResponse model construction."""
    stats = StatsResponse(
        total_messages=100,
        total_conversations=25,
        by_platform={"chatgpt": 60, "claude": 40},
        conversations_by_platform={"chatgpt": 15, "claude": 10},
        activity=[
            ActivityEntry(date="2025-01-01", count=5),
            ActivityEntry(date="2025-01-02", count=10),
        ],
    )
    assert stats.total_messages == 100
    assert stats.total_conversations == 25
    assert stats.by_platform["chatgpt"] == 60
    assert stats.conversations_by_platform["claude"] == 10
    assert len(stats.activity) == 2
    assert stats.activity[0].date == "2025-01-01"
    assert stats.activity[0].count == 5
