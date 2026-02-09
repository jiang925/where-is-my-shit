import json
import logging
from typing import List, Dict, Any, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

def read_new_entries(file_path: Path, offset: int) -> Tuple[List[Dict[str, Any]], int]:
    """
    Reads new lines from file starting at byte offset.
    Returns (list of parsed JSON dicts, new byte offset).
    Only processes complete lines (ending in newline).
    """
    if not file_path.exists():
        return [], offset

    entries = []
    new_offset = offset

    try:
        with open(file_path, 'rb') as f:
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

            # Decode and parse
            try:
                text = valid_chunk.decode('utf-8')
                for line in text.splitlines():
                    if line.strip():
                        try:
                            entry = json.loads(line)
                            entries.append(entry)
                        except json.JSONDecodeError:
                            logger.warning(f"Skipping invalid JSON line: {line[:50]}...")
            except UnicodeDecodeError as e:
                 logger.error(f"Unicode decode error in log file: {e}")
                 # In a real robust watcher we might want to skip bad bytes,
                 # but for now we'll just not advance if it's catastrophic,
                 # or advance and skip. Here we advance.
                 pass

            return entries, new_offset

    except Exception as e:
        logger.error(f"Error reading {file_path}: {e}")
        return [], offset

def transform_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transforms a Claude Code history entry into a WIMS ingestion payload.

    Claude entry sample:
    {
      "display": "/mcp ",
      "pastedContents": {},
      "timestamp": 1762824199682,
      "project": "/home/pter/code/nexusphp",
      "sessionId": "94ba6257-5181-4e6c-a28d-41d165fb686d"
    }

    WIMS payload:
    {
      "source": "claude-code",
      "external_id": "sessionId",
      "timestamp": 123456789,
      "content": "display",
      "metadata": { ... }
    }
    """
    return {
        "source": "claude-code",
        "external_id": entry.get("sessionId", "unknown"),
        "timestamp": entry.get("timestamp"),
        "content": entry.get("display", ""),
        "metadata": {
            "project": entry.get("project"),
            "pasted_contents": entry.get("pastedContents"),
            "original_entry": entry  # Optional: store full raw entry if needed
        }
    }
