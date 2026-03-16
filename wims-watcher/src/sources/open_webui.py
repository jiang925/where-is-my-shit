import json
import logging
from datetime import datetime
from typing import Any
from urllib.request import Request, urlopen

from .base import BaseWatcher

logger = logging.getLogger(__name__)


class OpenWebUIWatcher(BaseWatcher):
    """Watcher for Open WebUI (formerly Ollama WebUI).

    Open WebUI exposes a REST API at /api/v1/chats that returns
    conversation history. This watcher polls the API for new/updated
    conversations and ingests them into WIMS.

    Requires OPEN_WEBUI_URL and optionally OPEN_WEBUI_API_KEY env vars.
    """

    def __init__(
        self,
        file_path: str | None = None,
        client: Any | None = None,
        base_url: str = "http://localhost:3000",
        api_key: str = "",
    ):
        # file_path is used as state key for the watcher
        path = file_path or "~/.wims/open-webui-state"
        super().__init__("open-webui", path, client)
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def check(self):
        """Poll Open WebUI API for new/updated conversations."""
        state_key = f"open-webui:{self.base_url}"
        last_ts = self.state_manager.get_cursor(state_key)

        try:
            chats = self._fetch_chats()
        except Exception as e:
            logger.warning(f"Failed to fetch Open WebUI chats: {e}")
            return

        if not chats:
            return

        latest_ts = last_ts
        for chat in chats:
            updated = chat.get("updated_at", 0)
            if isinstance(updated, str):
                try:
                    updated = int(datetime.fromisoformat(updated).timestamp())
                except ValueError:
                    updated = 0

            if updated <= last_ts:
                continue

            chat_id = chat.get("id", "")
            if not chat_id:
                continue

            logger.info(f"Processing Open WebUI chat: {chat_id}")
            self._process_chat(chat)

            if updated > latest_ts:
                latest_ts = updated

        if latest_ts > last_ts:
            self.state_manager.update_cursor(state_key, latest_ts)

    def _fetch_chats(self) -> list[dict]:
        """Fetch chat list from Open WebUI API."""
        url = f"{self.base_url}/api/v1/chats"
        req = Request(url, method="GET")
        req.add_header("Content-Type", "application/json")
        if self.api_key:
            req.add_header("Authorization", f"Bearer {self.api_key}")

        with urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            # API returns {"data": [...]} or just [...]
            if isinstance(data, dict):
                return data.get("data", data.get("chats", []))
            return data if isinstance(data, list) else []

    def _process_chat(self, chat: dict):
        """Process a single chat and ingest its messages."""
        chat_id = chat.get("id", "")
        title = chat.get("title", "Untitled")

        # Chat object may contain messages directly or need a detail fetch
        messages = chat.get("messages", chat.get("history", {}).get("messages", {}))

        if isinstance(messages, dict):
            # Open WebUI stores messages as {id: {role, content, ...}}
            msg_list = sorted(
                messages.values(),
                key=lambda m: m.get("timestamp", 0),
            )
        elif isinstance(messages, list):
            msg_list = messages
        else:
            return

        for msg in msg_list:
            payload = self._transform_message(msg, chat_id, title)
            if payload:
                self.client.ingest(payload)

    def _transform_message(
        self, msg: dict, chat_id: str, title: str
    ) -> dict[str, Any] | None:
        """Transform an Open WebUI message into WIMS ingestion payload."""
        content = msg.get("content", "")
        if not content.strip():
            return None

        role_raw = msg.get("role", "user")
        role = "user" if role_raw == "user" else "assistant"

        timestamp = msg.get("timestamp")
        if timestamp:
            if isinstance(timestamp, (int, float)):
                ts_iso = datetime.fromtimestamp(
                    timestamp / 1000 if timestamp > 1e12 else timestamp
                ).isoformat()
            else:
                ts_iso = str(timestamp)
        else:
            ts_iso = datetime.now().isoformat()

        return {
            "conversation_id": chat_id,
            "platform": "open-webui",
            "title": title,
            "content": content,
            "role": role,
            "timestamp": ts_iso,
            "url": f"{self.base_url}/c/{chat_id}",
        }

    def parse_line(self, line: str) -> dict[str, Any] | None:
        """Not used for API-based watcher."""
        return None
