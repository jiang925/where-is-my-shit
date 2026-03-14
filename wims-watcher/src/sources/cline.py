import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from .base import BaseWatcher

logger = logging.getLogger(__name__)


class ClineWatcher(BaseWatcher):
    """Watcher for Cline (formerly Claude Dev) sessions.

    Cline stores task conversations in directories under its global storage.
    Each task directory contains an api_conversation_history.json file with
    an array of messages. Messages have a role and content (array of objects
    with type and text fields).

    Supported paths:
    - ~/.cline/tasks/ (newer versions)
    - ~/.vscode/extensions/saoudrizwan.claude-dev-*/globalStorage/tasks/
    - ~/.vscode-server/data/Machine/globalStorage/saoudrizwan.claude-dev/tasks/
    """

    def __init__(self, file_path: str | None = None, client: Any | None = None):
        path = file_path or "~/.cline/tasks"
        super().__init__("cline", path, client)

    def check(self):
        """Scan for new/modified Cline task conversations."""
        base = self.file_path
        if not base.exists():
            return

        conversation_files = list(base.glob("*/api_conversation_history.json"))
        if not conversation_files:
            return

        for conv_file in conversation_files:
            state_key = str(conv_file)
            last_mtime = self.state_manager.get_cursor(state_key)
            current_mtime = int(conv_file.stat().st_mtime)

            if current_mtime <= last_mtime:
                continue

            logger.info(f"Processing Cline task: {conv_file.parent.name}")
            self._process_task(conv_file)
            self.state_manager.update_cursor(state_key, current_mtime)

    def _process_task(self, conv_file: Path):
        """Parse a Cline task conversation file and ingest its messages."""
        try:
            data = json.loads(conv_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Failed to parse {conv_file}: {e}")
            return

        if not isinstance(data, list):
            logger.warning(f"Unexpected format in {conv_file}: expected a list")
            return

        task_id = conv_file.parent.name

        for msg in data:
            payload = self._transform_message(msg, task_id)
            if payload:
                self.client.ingest(payload)

    def _transform_message(self, msg: dict, task_id: str) -> dict[str, Any] | None:
        """Transform a Cline message into WIMS ingestion payload."""
        content_parts = msg.get("content", [])
        content = ""
        if isinstance(content_parts, list):
            for part in content_parts:
                if isinstance(part, dict):
                    content += part.get("text", "")
                elif isinstance(part, str):
                    content += part
        elif isinstance(content_parts, str):
            content = content_parts

        if not content.strip():
            return None

        role_raw = msg.get("role", "user")
        role = "user" if role_raw == "human" or role_raw == "user" else "assistant"

        timestamp = msg.get("ts") or msg.get("timestamp")
        if timestamp:
            if isinstance(timestamp, (int, float)):
                ts_iso = datetime.fromtimestamp(timestamp / 1000 if timestamp > 1e12 else timestamp).isoformat()
            else:
                ts_iso = str(timestamp)
        else:
            ts_iso = datetime.now().isoformat()

        return {
            "conversation_id": task_id,
            "platform": "cline",
            "title": f"Cline {task_id[:8]}",
            "content": content,
            "role": role,
            "timestamp": ts_iso,
            "url": "",
        }

    def parse_line(self, line: str) -> dict[str, Any] | None:
        """Not used for directory-based scanning."""
        return None
