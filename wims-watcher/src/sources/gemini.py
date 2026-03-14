import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from .base import BaseWatcher

logger = logging.getLogger(__name__)


class GeminiCliWatcher(BaseWatcher):
    """Watcher for Gemini CLI sessions.

    Gemini CLI stores sessions as JSON files in ~/.gemini/tmp/*/chats/.
    Each session directory contains a chat JSON file with conversation messages.
    """

    def __init__(self, file_path: str | None = None, client: Any | None = None):
        # Default path is the Gemini CLI sessions directory
        path = file_path or "~/.gemini/tmp"
        super().__init__("gemini", path, client)

    def check(self):
        """Scan for new/modified Gemini CLI session files."""
        base = self.file_path
        if not base.exists():
            return

        # Find all chat JSON files in session directories
        chat_files = list(base.glob("*/chats/*.json"))
        if not chat_files:
            return

        for chat_file in chat_files:
            state_key = str(chat_file)
            last_mtime = self.state_manager.get_cursor(state_key)
            current_mtime = int(chat_file.stat().st_mtime)

            if current_mtime <= last_mtime:
                continue

            logger.info(f"Processing Gemini CLI session: {chat_file.name}")
            self._process_session(chat_file)
            self.state_manager.update_cursor(state_key, current_mtime)

    def _process_session(self, chat_file: Path):
        """Parse a Gemini CLI session file and ingest its messages."""
        try:
            data = json.loads(chat_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Failed to parse {chat_file}: {e}")
            return

        messages = data if isinstance(data, list) else data.get("messages", [])
        session_id = chat_file.stem or chat_file.parent.parent.name

        for msg in messages:
            payload = self._transform_message(msg, session_id)
            if payload:
                self.client.ingest(payload)

    def _transform_message(self, msg: dict, session_id: str) -> dict[str, Any] | None:
        """Transform a Gemini CLI message into WIMS ingestion payload."""
        content = ""
        parts = msg.get("parts", [])
        for part in parts:
            if isinstance(part, str):
                content += part
            elif isinstance(part, dict):
                content += part.get("text", "")

        if not content.strip():
            return None

        role_raw = msg.get("role", "user")
        role = "user" if role_raw == "user" else "assistant"

        timestamp = msg.get("timestamp")
        if timestamp:
            if isinstance(timestamp, (int, float)):
                ts_iso = datetime.fromtimestamp(timestamp / 1000 if timestamp > 1e12 else timestamp).isoformat()
            else:
                ts_iso = str(timestamp)
        else:
            ts_iso = datetime.now().isoformat()

        return {
            "conversation_id": session_id,
            "platform": "gemini",
            "title": f"Gemini CLI {session_id[:8]}",
            "content": content,
            "role": role,
            "timestamp": ts_iso,
            "url": "",
        }

    def parse_line(self, line: str) -> dict[str, Any] | None:
        """Not used for directory-based scanning."""
        return None
