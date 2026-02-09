import json
import logging
from typing import Any, Dict, List, Tuple, Optional
from datetime import datetime
from pathlib import Path

from .base import BaseWatcher

logger = logging.getLogger(__name__)

class ClaudeWatcher(BaseWatcher):
    def __init__(self, file_path: str):
        super().__init__("claude-code", file_path)

    def check(self):
        """
        Reads new lines from the file and ingests them.
        """
        current_offset = self.get_state()
        new_lines, new_offset = self._read_new_lines(current_offset)

        if not new_lines:
            return

        logger.info(f"Found {len(new_lines)} new lines.")

        success_count = 0
        for line in new_lines:
            payload = self.parse_line(line)
            if payload:
                if self.client.ingest(payload):
                    success_count += 1
                else:
                    logger.warning("Failed to ingest entry. Stopping processing for now.")
                    break
            else:
                # If parsing fails (e.g. invalid JSON), we treat it as processed (skipped)
                # so we don't get stuck in a loop.
                success_count += 1

        if success_count == len(new_lines):
            self.update_state(new_offset)
            logger.info(f"Updated cursor to {new_offset}")
        else:
            logger.warning(f"Only ingested {success_count}/{len(new_lines)}. Not updating cursor to avoid data loss on retry.")

    def _read_new_lines(self, offset: int) -> Tuple[List[str], int]:
        """
        Reads new lines from file starting at byte offset.
        Returns (list of strings, new byte offset).
        Only processes complete lines (ending in newline).
        """
        if not self.file_path.exists():
            return [], offset

        try:
            with open(self.file_path, 'rb') as f:
                f.seek(offset)
                chunk = f.read()

                if not chunk:
                    return [], offset

                # Find last newline to ensure we only process complete lines
                last_newline_index = chunk.rfind(b'\n')

                if last_newline_index == -1:
                    # No complete line found, wait for more data
                    return [], offset

                # Extract valid chunk up to the last newline
                valid_chunk = chunk[:last_newline_index + 1]
                new_offset = offset + len(valid_chunk)

                # Decode and split
                try:
                    text = valid_chunk.decode('utf-8')
                    lines = [line for line in text.splitlines() if line.strip()]
                    return lines, new_offset
                except UnicodeDecodeError as e:
                    logger.error(f"Unicode decode error in log file: {e}")
                    # In case of decode error, we might want to skip the chunk or error out.
                    # For now, following parser.py logic, we return empty which might cause loop if we don't advance?
                    # parser.py returned [], offset which means stuck loop.
                    # But here let's stick to migration.
                    return [], offset

        except Exception as e:
            logger.error(f"Error reading {self.file_path}: {e}")
            return [], offset

    def parse_line(self, line: str) -> Optional[Dict[str, Any]]:
        try:
            entry = json.loads(line)
            return self._transform_entry(entry)
        except json.JSONDecodeError:
            logger.warning(f"Skipping invalid JSON line: {line[:50]}...")
            return None
        except Exception as e:
            logger.error(f"Error parsing line: {e}")
            return None

    def _transform_entry(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transforms a Claude Code history entry into a WIMS ingestion payload.
        """
        metadata = {}

        project = entry.get("project")
        if project:
            metadata["project"] = project

        pasted = entry.get("pastedContents")
        if pasted:
            metadata["pasted"] = pasted

        return {
            "conversation_id": entry.get("sessionId", "unknown"),
            "external_id": entry.get("sessionId"),
            "platform": "claude-code",
            "title": f"Session {entry.get('sessionId', 'unknown')[:8]}",
            "content": entry.get("display", "") or "[Empty Command]",
            "role": "user",
            "timestamp": datetime.fromtimestamp(entry.get("timestamp", 0) / 1000.0).isoformat(),
            "url": project or "",
            "metadata": metadata
        }
