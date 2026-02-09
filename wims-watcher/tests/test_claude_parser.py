import json
from unittest.mock import MagicMock, patch

import pytest
from src.sources.claude import ClaudeWatcher


@pytest.fixture
def mock_client():
    return MagicMock()


@pytest.fixture
def claude_watcher(mock_client):
    # Mocking file path and client
    with patch("src.sources.base.WimsClient", return_value=mock_client):
        watcher = ClaudeWatcher("dummy_path")
        return watcher


def test_parse_line_standard(claude_watcher):
    line = json.dumps(
        {
            "display": "ls -la",
            "timestamp": 1609459200000,
            "project": "/home/user/project",
            "sessionId": "test-session-id",
        }
    )

    result = claude_watcher.parse_line(line)

    assert result is not None
    assert result["conversation_id"] == "test-session-id"
    assert result["content"] == "ls -la"
    assert result["url"] == "/home/user/project"
    assert result["metadata"]["project"] == "/home/user/project"
    assert "pasted" not in result["metadata"]


def test_parse_line_with_pasted(claude_watcher):
    line = json.dumps(
        {
            "display": "analyze this",
            "timestamp": 1609459200000,
            "project": "/home/user/project",
            "sessionId": "test-session-id",
            "pastedContents": {"file.txt": "content"},
        }
    )

    result = claude_watcher.parse_line(line)

    assert result is not None
    assert result["metadata"]["pasted"] == {"file.txt": "content"}


def test_parse_line_malformed_json(claude_watcher):
    line = "{invalid json"

    result = claude_watcher.parse_line(line)

    assert result is None


def test_parse_line_missing_fields(claude_watcher):
    line = json.dumps({"timestamp": 1609459200000})

    result = claude_watcher.parse_line(line)

    assert result is not None
    assert result["conversation_id"] == "unknown"
    assert result["content"] == "[Empty Command]"
