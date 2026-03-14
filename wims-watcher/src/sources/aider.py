import hashlib
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from .base import BaseWatcher

logger = logging.getLogger(__name__)

# Regex to match aider chat history role headers
_ROLE_HEADER_RE = re.compile(r"^####\s+(user|assistant)\s*$", re.IGNORECASE)


class AiderWatcher(BaseWatcher):
    """Watcher for Aider chat history files.

    Aider writes conversation history to .aider.chat.history.md in each
    project root. The format is Markdown with `#### user` and `#### assistant`
    headers separating messages.

    By default, this watcher scans the user's home directory for
    .aider.chat.history.md files. A custom scan root can be provided.
    """

    def __init__(self, file_path: str | None = None, client: Any | None = None):
        path = file_path or "~"
        super().__init__("aider", path, client)

    def check(self):
        """Scan for new/modified Aider chat history files."""
        base = self.file_path
        if not base.exists():
            return

        history_files = list(base.glob("**/.aider.chat.history.md"))
        if not history_files:
            return

        for history_file in history_files:
            state_key = str(history_file)
            last_mtime = self.state_manager.get_cursor(state_key)
            current_mtime = int(history_file.stat().st_mtime)

            if current_mtime <= last_mtime:
                continue

            logger.info(f"Processing Aider history: {history_file}")
            self._process_history(history_file)
            self.state_manager.update_cursor(state_key, current_mtime)

    def _process_history(self, history_file: Path):
        """Parse an Aider chat history file and ingest its messages."""
        try:
            text = history_file.read_text(encoding="utf-8")
        except OSError as e:
            logger.warning(f"Failed to read {history_file}: {e}")
            return

        # Derive a stable conversation id from the file path
        conversation_id = hashlib.sha256(str(history_file).encode()).hexdigest()[:16]
        messages = self._parse_messages(text)

        for msg in messages:
            payload = self._transform_message(msg, conversation_id, history_file)
            if payload:
                self.client.ingest(payload)

    def _parse_messages(self, text: str) -> list[dict[str, str]]:
        """Split markdown text into messages by #### role headers."""
        messages: list[dict[str, str]] = []
        current_role: str | None = None
        current_lines: list[str] = []

        for line in text.splitlines():
            match = _ROLE_HEADER_RE.match(line)
            if match:
                # Flush previous message
                if current_role is not None:
                    content = "\n".join(current_lines).strip()
                    if content:
                        messages.append({"role": current_role, "content": content})
                current_role = match.group(1).lower()
                current_lines = []
            else:
                current_lines.append(line)

        # Flush last message
        if current_role is not None:
            content = "\n".join(current_lines).strip()
            if content:
                messages.append({"role": current_role, "content": content})

        return messages

    def _transform_message(
        self, msg: dict[str, str], conversation_id: str, history_file: Path
    ) -> dict[str, Any] | None:
        """Transform a parsed Aider message into WIMS ingestion payload."""
        content = msg.get("content", "")
        if not content.strip():
            return None

        role = "user" if msg.get("role") == "user" else "assistant"

        return {
            "conversation_id": conversation_id,
            "platform": "aider",
            "title": f"Aider {history_file.parent.name}",
            "content": content,
            "role": role,
            "timestamp": datetime.now().isoformat(),
            "url": "",
        }

    def parse_line(self, line: str) -> dict[str, Any] | None:
        """Not used for directory-based scanning."""
        return None
