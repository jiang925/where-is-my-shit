import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from .base import BaseWatcher

logger = logging.getLogger(__name__)


class ContinueDevWatcher(BaseWatcher):
    """Watcher for Continue.dev sessions.

    Continue.dev stores JSON session files in ~/.continue/sessions/.
    Each file is a JSON object with session metadata and message history.
    """

    def __init__(self, file_path: str | None = None, client: Any | None = None):
        path = file_path or "~/.continue/sessions"
        super().__init__("continue", path, client)

    def check(self):
        """Scan for new/modified Continue.dev session files."""
        base = self.file_path
        if not base.exists():
            return

        session_files = list(base.glob("*.json"))
        if not session_files:
            return

        for session_file in session_files:
            state_key = str(session_file)
            last_mtime = self.state_manager.get_cursor(state_key)
            current_mtime = int(session_file.stat().st_mtime)

            if current_mtime <= last_mtime:
                continue

            logger.info(f"Processing Continue.dev session: {session_file.name}")
            self._process_session(session_file)
            self.state_manager.update_cursor(state_key, current_mtime)

    def _process_session(self, session_file: Path):
        """Parse a Continue.dev session file and ingest its messages."""
        try:
            data = json.loads(session_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Failed to parse {session_file}: {e}")
            return

        session_id = data.get("sessionId", session_file.stem)
        title = data.get("title", f"Continue {session_id[:8]}")
        history = data.get("history", [])

        for step in history:
            payload = self._transform_step(step, session_id, title)
            if payload:
                self.client.ingest(payload)

    def _transform_step(self, step: dict, session_id: str, title: str) -> dict[str, Any] | None:
        """Transform a Continue.dev history step into WIMS ingestion payload."""
        # Continue.dev steps have name, description, and content fields
        content = step.get("description", "") or step.get("content", "")
        if not content.strip():
            return None

        role_raw = step.get("name", "user")
        role = "user" if role_raw in ("user", "UserInputStep") else "assistant"

        timestamp = step.get("timestamp")
        if timestamp:
            if isinstance(timestamp, (int, float)):
                ts_iso = datetime.fromtimestamp(timestamp / 1000 if timestamp > 1e12 else timestamp).isoformat()
            else:
                ts_iso = str(timestamp)
        else:
            ts_iso = datetime.now().isoformat()

        return {
            "conversation_id": session_id,
            "platform": "continue",
            "title": title,
            "content": content,
            "role": role,
            "timestamp": ts_iso,
            "url": "",
        }

    def parse_line(self, line: str) -> dict[str, Any] | None:
        """Not used for directory-based scanning."""
        return None
