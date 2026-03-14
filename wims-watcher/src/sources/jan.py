import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from .base import BaseWatcher

logger = logging.getLogger(__name__)


class JanWatcher(BaseWatcher):
    """Watcher for Jan.ai thread conversations.

    Jan stores conversations as threads in ~/jan/threads/. Each thread is
    a directory containing a messages.jsonl file where each line is a JSON
    object with role, content, id, thread_id, and created_at fields.
    """

    def __init__(self, file_path: str | None = None, client: Any | None = None):
        path = file_path or "~/jan/threads"
        super().__init__("jan", path, client)

    def check(self):
        """Scan for new/modified Jan thread message files."""
        base = self.file_path
        if not base.exists():
            return

        message_files = list(base.glob("*/messages.jsonl"))
        if not message_files:
            return

        for msg_file in message_files:
            state_key = str(msg_file)
            last_mtime = self.state_manager.get_cursor(state_key)
            current_mtime = int(msg_file.stat().st_mtime)

            if current_mtime <= last_mtime:
                continue

            logger.info(f"Processing Jan thread: {msg_file.parent.name}")
            self._process_thread(msg_file)
            self.state_manager.update_cursor(state_key, current_mtime)

    def _process_thread(self, msg_file: Path):
        """Parse a Jan thread messages.jsonl file and ingest its messages."""
        try:
            text = msg_file.read_text(encoding="utf-8")
        except OSError as e:
            logger.warning(f"Failed to read {msg_file}: {e}")
            return

        thread_id = msg_file.parent.name

        for line_number, line in enumerate(text.splitlines(), start=1):
            line = line.strip()
            if not line:
                continue

            try:
                msg = json.loads(line)
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse line {line_number} in {msg_file}: {e}")
                continue

            payload = self._transform_message(msg, thread_id)
            if payload:
                self.client.ingest(payload)

    def _transform_message(self, msg: dict, thread_id: str) -> dict[str, Any] | None:
        """Transform a Jan message into WIMS ingestion payload."""
        content = msg.get("content", "")
        if isinstance(content, list):
            # Handle content as array of parts
            parts = []
            for part in content:
                if isinstance(part, str):
                    parts.append(part)
                elif isinstance(part, dict):
                    parts.append(part.get("text", ""))
            content = "".join(parts)

        if not content or not content.strip():
            return None

        role_raw = msg.get("role", "user")
        role = "user" if role_raw == "user" else "assistant"

        created_at = msg.get("created_at")
        if created_at:
            if isinstance(created_at, (int, float)):
                ts_iso = datetime.fromtimestamp(created_at / 1000 if created_at > 1e12 else created_at).isoformat()
            elif isinstance(created_at, str):
                ts_iso = created_at
            else:
                ts_iso = datetime.now().isoformat()
        else:
            ts_iso = datetime.now().isoformat()

        message_id = msg.get("id", "")
        msg_thread_id = msg.get("thread_id", thread_id)

        return {
            "conversation_id": msg_thread_id,
            "platform": "jan",
            "title": f"Jan {msg_thread_id[:8]}",
            "content": content,
            "role": role,
            "timestamp": ts_iso,
            "url": "",
        }

    def parse_line(self, line: str) -> dict[str, Any] | None:
        """Not used for directory-based scanning."""
        return None
