import json
import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

class StateManager:
    """
    Manages the file cursor position to resume reading after restarts.
    Persists state to ~/.local/state/wims/watcher_cursor.json
    """

    def __init__(self, state_file: Optional[Path] = None):
        if state_file:
            self.state_file = state_file
        else:
            # Default location: ~/.local/state/wims/watcher_cursor.json
            xdg_state_home = os.environ.get("XDG_STATE_HOME", os.path.expanduser("~/.local/state"))
            self.state_file = Path(xdg_state_home) / "wims" / "watcher_cursor.json"

        # Ensure directory exists
        self.state_file.parent.mkdir(parents=True, exist_ok=True)

        self.cursor_data: Dict[str, Any] = {
            "offset": 0,
            "inode": 0,
            "file_path": ""
        }
        self.load()

    def load(self) -> None:
        """Load state from disk."""
        if self.state_file.exists():
            try:
                with open(self.state_file, 'r') as f:
                    data = json.load(f)
                    self.cursor_data.update(data)
                logger.debug(f"Loaded state: {self.cursor_data}")
            except Exception as e:
                logger.error(f"Failed to load state from {self.state_file}: {e}")

    def save(self) -> None:
        """Save state to disk."""
        try:
            with open(self.state_file, 'w') as f:
                json.dump(self.cursor_data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save state to {self.state_file}: {e}")

    def get_cursor(self, file_path: str) -> int:
        """
        Get the last read offset for the given file.
        Checks inode to detect log rotation/truncation.
        """
        path = Path(file_path)
        if not path.exists():
            return 0

        current_inode = path.stat().st_ino
        stored_inode = self.cursor_data.get("inode", 0)
        stored_path = self.cursor_data.get("file_path", "")
        stored_offset = self.cursor_data.get("offset", 0)

        # If file path matches and inode matches, return stored offset
        if stored_path == str(path) and stored_inode == current_inode:
            # Check for truncation (if file is now smaller than offset)
            current_size = path.stat().st_size
            if current_size < stored_offset:
                logger.warning(f"File truncated. Resetting cursor for {file_path}")
                return 0
            return stored_offset

        # If inode changed or path changed, start from beginning (or tail?)
        # For this use case, if log rotated, we probably want to start new file from 0
        if stored_path == str(path) and stored_inode != current_inode:
             logger.info(f"File rotated (inode changed). Resetting cursor for {file_path}")
             return 0

        return 0

    def update_cursor(self, file_path: str, offset: int) -> None:
        """Update the cursor position."""
        path = Path(file_path)
        if not path.exists():
            return

        self.cursor_data["file_path"] = str(path)
        self.cursor_data["inode"] = path.stat().st_ino
        self.cursor_data["offset"] = offset
        self.save()
