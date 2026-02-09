from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional
import logging

from ..state import StateManager
from ..client import WimsClient

logger = logging.getLogger(__name__)

class BaseWatcher(ABC):
    """
    Abstract base class for all log watchers.
    """
    def __init__(self, source_name: str, file_path: str):
        self.source_name = source_name
        self.file_path = Path(file_path).expanduser().resolve()
        self.state_manager = StateManager()
        self.client = WimsClient()

    @abstractmethod
    def check(self):
        """
        Check for new data and process it.
        Can be called by a file system event handler or a poller.
        """
        pass

    @abstractmethod
    def parse_line(self, line: str) -> Optional[Dict[str, Any]]:
        """
        Parse a single line from the log file.
        Returns a dictionary suitable for WIMS ingestion, or None if invalid.
        """
        pass

    def get_state(self) -> int:
        """
        Get the current cursor position.
        """
        return self.state_manager.get_cursor(str(self.file_path))

    def update_state(self, new_offset: int):
        """
        Update the cursor position.
        """
        self.state_manager.update_cursor(str(self.file_path), new_offset)
