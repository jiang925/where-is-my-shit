import json
import logging
import re
from typing import Any, Dict, Optional
from datetime import datetime

from .base import BaseWatcher
from .claude import ClaudeWatcher

logger = logging.getLogger(__name__)

class AntigravityWatcher(ClaudeWatcher):
    """
    Watcher for Antigravity logs.
    Inherits from ClaudeWatcher to reuse file reading and line processing logic.
    """
    def __init__(self, file_path: str, client: Optional[Any] = None):
        super().__init__(file_path, client)
        self.source_name = "antigravity"

    def parse_line(self, line: str) -> Optional[Dict[str, Any]]:
        """
        Parses an Antigravity log line.
        Supports JSON format.
        """
        try:
            # Try parsing as JSON first
            entry = json.loads(line)
            return self._transform_entry(entry)
        except json.JSONDecodeError:
            # Fallback to text parsing if needed, or skip
            # For now assuming JSON lines as per standard agentic tools
            return None
        except Exception as e:
            logger.error(f"Error parsing Antigravity line: {e}")
            return None

    def _transform_entry(self, entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Transforms an Antigravity log entry into a WIMS ingestion payload.
        """
        # Validate essential fields
        if not isinstance(entry, dict):
            return None

        # Extract message content
        message = entry.get("message") or entry.get("content") or entry.get("msg")
        if not message:
            return None

        # Extract timestamp
        timestamp_raw = entry.get("timestamp") or entry.get("ts") or entry.get("time")
        if timestamp_raw:
            try:
                # Handle various timestamp formats if necessary
                if isinstance(timestamp_raw, (int, float)):
                    # Heuristic: if > 10000000000 (year 2286), assume milliseconds
                    if timestamp_raw > 10000000000:
                        timestamp = datetime.fromtimestamp(timestamp_raw / 1000.0).isoformat()
                    else:
                        timestamp = datetime.fromtimestamp(timestamp_raw).isoformat()
                else:
                    timestamp = str(timestamp_raw)
            except Exception:
                timestamp = datetime.now().isoformat()
        else:
            timestamp = datetime.now().isoformat()

        # Extract agent/session info
        agent_id = entry.get("agent_id", "unknown")
        session_id = entry.get("session_id", "unknown")

        # Build metadata
        metadata = {
            "agent_id": agent_id,
            "level": entry.get("level", "INFO"),
            "source_type": "antigravity_log"
        }

        # Add any other interesting fields to metadata
        for k, v in entry.items():
            if k not in ["message", "content", "msg", "timestamp", "ts", "time", "agent_id", "session_id"]:
                metadata[k] = v

        return {
            "conversation_id": session_id,
            "external_id": f"{session_id}-{timestamp}",
            "platform": "antigravity",
            "title": f"Antigravity Session {session_id}",
            "content": str(message),
            "role": "assistant" if entry.get("level") == "response" else "user", # Heuristic mapping
            "timestamp": timestamp,
            "url": "",
            "metadata": metadata
        }
