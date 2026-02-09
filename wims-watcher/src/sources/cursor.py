import json
import logging
import sqlite3
import time
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime
from pathlib import Path

from .base import BaseWatcher

logger = logging.getLogger(__name__)

class CursorWatcher(BaseWatcher):
    """
    Watcher for Cursor IDE chat history.
    Reads from SQLite state database (state.vscdb).
    """
    def __init__(self, db_path: str, client: Optional[Any] = None):
        super().__init__("cursor", db_path, client)
        self.db_path = Path(db_path).expanduser().resolve()

    def check(self):
        """
        Polls the SQLite database for new chat messages.
        State is tracked by the 'last_modified' timestamp or max rowid of messages.
        """
        if not self.db_path.exists():
            return

        try:
            # Connect to SQLite DB in read-only mode if possible
            # URI mode needs file path to be absolute URI
            conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            cursor = conn.cursor()

            # Helper to get keys from ItemTable which stores extension state
            # Cursor chat is typically stored in 'workbench.panel.aichat.view.state' or similar keys
            # or sometimes in dedicated tables if they changed schema.
            # For MVP, we look for known keys containing chat history.

            # Strategy:
            # 1. Fetch the blob for chat state.
            # 2. Parse JSON.
            # 3. Extract messages.
            # 4. Filter by timestamp > last_seen_timestamp (stored in state).

            # Note: This is inefficient for huge histories as we read the whole blob.
            # But SQLite state dumps are usually overwritten, not appended to in a log table.
            # If it's a single key-value update, we just check if it changed.

            cursor.execute("SELECT value FROM ItemTable WHERE key = 'workbench.panel.aichat.view.state'")
            row = cursor.fetchone()

            if not row:
                # Try alternative keys if known, or just return
                conn.close()
                return

            data = row[0]
            conn.close()

            self._process_chat_data(data)

        except sqlite3.Error as e:
            logger.error(f"SQLite error reading Cursor state: {e}")
        except Exception as e:
            logger.error(f"Error checking Cursor state: {e}")

    def _process_chat_data(self, json_data: str):
        try:
            state = json.loads(json_data)
            # Schema exploration needed here. Assuming a structure based on common VSCode/Cursor patterns.
            # Usually: { "conversations": [ { "id": "...", "messages": [...] } ] }

            # We track the last processed timestamp in our state file
            last_processed_ts = self.get_state() or 0.0
            max_ts = last_processed_ts

            new_entries = []

            conversations = state.get('conversations', [])
            if not conversations and isinstance(state, list):
                # Sometimes it's just a list of conversations
                conversations = state

            for conv in conversations:
                conv_id = conv.get('id', 'unknown')
                messages = conv.get('messages', [])

                for msg in messages:
                    # Extract timestamp (ms)
                    ts = msg.get('timestamp') or msg.get('createdAt')
                    if not ts:
                        continue

                    # Normalize to float seconds if needed (usually ms in JS)
                    if ts > 10000000000: # Assuming ms
                        ts_sec = ts / 1000.0
                    else:
                        ts_sec = float(ts)

                    if ts_sec > last_processed_ts:
                        entry = self._transform_message(conv_id, msg, ts_sec)
                        if entry:
                            new_entries.append((ts_sec, entry))
                            if ts_sec > max_ts:
                                max_ts = ts_sec

            # Sort by timestamp to ingest in order
            new_entries.sort(key=lambda x: x[0])

            success_count = 0
            for _, payload in new_entries:
                if self.client.ingest(payload):
                    success_count += 1

            if success_count > 0:
                logger.info(f"Ingested {success_count} new Cursor messages.")
                self.update_state(max_ts)

        except json.JSONDecodeError:
            logger.warning("Failed to decode Cursor state JSON.")
        except Exception as e:
            logger.error(f"Error processing Cursor data: {e}")

    def _transform_message(self, conv_id: str, msg: Dict[str, Any], timestamp: float) -> Optional[Dict[str, Any]]:
        text = msg.get('text') or msg.get('content')
        if not text:
            return None

        role = msg.get('role', 'user') # user or ai/assistant

        return {
            "conversation_id": conv_id,
            "external_id": msg.get('id', f"{conv_id}-{timestamp}"),
            "platform": "cursor",
            "title": f"Cursor Chat {conv_id[:8]}",
            "content": text,
            "role": role,
            "timestamp": datetime.fromtimestamp(timestamp).isoformat(),
            "url": "",
            "metadata": {
                "model": msg.get('model'),
                "context": msg.get('context') # If available
            }
        }

    def parse_line(self, line: str) -> Optional[Dict[str, Any]]:
        # Not used for SQLite watcher
        pass
