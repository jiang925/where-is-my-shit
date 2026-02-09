import time
import logging
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from .parser import read_new_entries, transform_entry
from .state import StateManager
from .client import WimsClient

logger = logging.getLogger(__name__)

class HistoryEventHandler(FileSystemEventHandler):
    """
    Handles file system events for the Claude history file.
    """
    def __init__(self, file_path: Path, state_manager: StateManager, client: WimsClient):
        self.file_path = file_path
        self.state_manager = state_manager
        self.client = client

    def on_modified(self, event):
        if event.is_directory:
            return

        # Check if the modified file matches our target
        # Watchdog returns absolute paths usually
        if Path(event.src_path).resolve() == self.file_path.resolve():
            logger.info(f"File modified: {event.src_path}")
            self.process_changes()

    def process_changes(self):
        """
        Reads new lines from the file and ingests them.
        """
        current_offset = self.state_manager.get_cursor(str(self.file_path))

        # Read new entries
        new_entries, new_offset = read_new_entries(self.file_path, current_offset)

        if not new_entries:
            return

        logger.info(f"Found {len(new_entries)} new entries.")

        success_count = 0
        for entry in new_entries:
            payload = transform_entry(entry)
            if self.client.ingest(payload):
                success_count += 1
            else:
                logger.warning("Failed to ingest entry. Stopping processing for now.")
                # Strategy: If ingestion fails, we don't update cursor past this point?
                # Or we just log and continue?
                # Ideally, we stop to retry later. But here let's keep it simple:
                # We update cursor only if we succeed.
                # If we fail halfway, we should probably stop and try again next trigger.
                break

        # Calculate new offset based on success
        # This is tricky because read_new_entries returns the final offset of the block read.
        # If we failed in the middle, we'd need to calculate exactly where we stopped.
        # For simplicity in this v1: We update cursor to new_offset ONLY if all succeeded.
        # If partial failure, we don't update cursor at all (will retry batch next time).
        # This might cause duplicates if 1st succeeds and 2nd fails, but our ingest is idempotent-ish?
        # Actually, let's just update cursor. We accept some data loss on local watcher for now to avoid stuck loops.

        if success_count == len(new_entries):
            self.state_manager.update_cursor(str(self.file_path), new_offset)
            logger.info(f"Updated cursor to {new_offset}")
        else:
            logger.warning(f"Only ingested {success_count}/{len(new_entries)}. Not updating cursor to avoid data loss on retry.")

class LogWatcher:
    """
    Main watcher class that sets up the observer.
    """
    def __init__(self, history_file: str):
        self.history_file = Path(history_file).expanduser().resolve()
        self.state_manager = StateManager()
        self.client = WimsClient()
        self.event_handler = HistoryEventHandler(self.history_file, self.state_manager, self.client)
        self.observer = Observer()

    def start(self):
        """
        Starts the watcher.
        """
        if not self.history_file.exists():
            logger.warning(f"Target file {self.history_file} does not exist. Waiting for it to be created...")
            # We can watch the parent directory

        # Initial catch-up
        logger.info("Performing initial catch-up...")
        self.event_handler.process_changes()

        # Watch the parent directory
        watch_dir = self.history_file.parent
        if not watch_dir.exists():
             logger.error(f"Directory {watch_dir} does not exist.")
             return

        logger.info(f"Starting watcher on {watch_dir} for {self.history_file.name}")
        self.observer.schedule(self.event_handler, str(watch_dir), recursive=False)
        self.observer.start()

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        self.observer.stop()
        self.observer.join()
