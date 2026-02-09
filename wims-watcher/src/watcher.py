import time
import logging
from pathlib import Path
from typing import List, Dict
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from .sources.base import BaseWatcher

logger = logging.getLogger(__name__)

class MultiSourceEventHandler(FileSystemEventHandler):
    """
    Handles file system events for multiple watchers.
    """
    def __init__(self, watchers: List[BaseWatcher]):
        self.watchers = watchers
        # Map resolved paths to watchers for quick lookup
        self.path_map: Dict[str, BaseWatcher] = {
            str(w.file_path.resolve()): w for w in watchers
        }

    def on_modified(self, event):
        if event.is_directory:
            return

        # Check if the modified file matches any of our targets
        src_path = str(Path(event.src_path).resolve())
        watcher = self.path_map.get(src_path)

        if watcher:
            logger.info(f"File modified: {event.src_path} (Source: {watcher.source_name})")
            watcher.check()

class LogWatcher:
    """
    Main watcher class that sets up the observer for multiple sources.
    """
    def __init__(self, watchers: List[BaseWatcher]):
        self.watchers = watchers
        self.observer = Observer()
        self.event_handler = MultiSourceEventHandler(self.watchers)

    def start(self):
        """
        Starts the watcher.
        """
        if not self.watchers:
            logger.warning("No watchers configured.")
            return

        # Group watchers by parent directory to minimize watches
        # (Though watchdog usually handles this, we need to schedule specifically)
        # Actually, we can just schedule the handler for each parent dir.
        # But if multiple files are in same dir, we only need one schedule.
        watched_dirs = set()

        for watcher in self.watchers:
            if not watcher.file_path.exists():
                logger.warning(f"Target file {watcher.file_path} does not exist. Waiting for it to be created...")
                # We assume parent exists or will exist

            # Initial catch-up
            logger.info(f"Performing initial catch-up for {watcher.source_name}...")
            watcher.check()

            watch_dir = watcher.file_path.parent
            if watch_dir.exists():
                if str(watch_dir) not in watched_dirs:
                    logger.info(f"Starting watcher on {watch_dir}")
                    self.observer.schedule(self.event_handler, str(watch_dir), recursive=False)
                    watched_dirs.add(str(watch_dir))
            else:
                logger.error(f"Directory {watch_dir} does not exist. Cannot watch {watcher.file_path.name}")

        if not watched_dirs:
            logger.error("No valid directories to watch.")
            return

        self.observer.start()

        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.stop()

    def stop(self):
        self.observer.stop()
        self.observer.join()
