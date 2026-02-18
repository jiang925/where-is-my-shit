"""
LanceDB automatic compaction manager.

This module provides background compaction for LanceDB tables to maintain
query performance over time as fragments accumulate from writes.

Features:
- Automatic compaction on server startup
- Threshold-based compaction after N writes
- Concurrent compaction protection (skip-silently approach)
- Background threading to avoid blocking API requests
- Structured logging for observability
"""

import threading

import structlog

logger = structlog.get_logger()


class CompactionManager:
    """
    Manages automatic LanceDB table compaction.

    Compaction reduces the number of data fragments in a LanceDB table by merging
    small files, which improves query performance. This manager handles:
    - Startup compaction (runs once when server starts)
    - Write-triggered compaction (after threshold writes)
    - Concurrency control (prevents overlapping compaction)
    """

    def __init__(self, write_threshold: int = 100):
        """
        Initialize the CompactionManager.

        Args:
            write_threshold: Number of writes before triggering compaction.
                           Default 100 is reasonable for single-user tool.
        """
        self.write_threshold = write_threshold
        self._write_count = 0
        self._counter_lock = threading.Lock()  # Protects write counter
        self._compaction_lock = threading.Lock()  # Prevents concurrent compaction
        self._stop_event = threading.Event()  # Signals thread to stop
        self._thread: threading.Thread | None = None
        self._table = None

    def set_table(self, table):
        """
        Set the LanceDB table to compact.

        Args:
            table: LanceDB table instance
        """
        self._table = table
        logger.info("compaction_table_set", table_name=getattr(table, "name", "unknown"))

    def record_write(self, count: int = 1):
        """
        Record write operations and trigger compaction if threshold exceeded.

        This is a non-blocking call that increments the write counter atomically.
        If the threshold is exceeded, compaction is triggered in a background thread.

        Args:
            count: Number of writes to record (default 1)
        """
        with self._counter_lock:
            self._write_count += count
            current_count = self._write_count

            if current_count >= self.write_threshold:
                logger.debug(
                    "write_threshold_exceeded",
                    write_count=current_count,
                    threshold=self.write_threshold
                )
                # Reset counter and trigger compaction
                self._write_count = 0
                self._trigger_compact()

    def _trigger_compact(self):
        """
        Trigger compaction in a background thread.

        This method spawns a daemon thread to run compaction without blocking
        the calling thread (typically an API request handler).
        """
        compact_thread = threading.Thread(
            target=self._compact,
            daemon=True,
            name="CompactionTriggerThread"
        )
        compact_thread.start()
        logger.debug("compaction_triggered", thread_name=compact_thread.name)

    def _compact(self):
        """
        Perform table compaction with concurrency protection.

        This method:
        1. Attempts to acquire the compaction lock (non-blocking)
        2. If lock is already held, skips silently (no duplicate compaction)
        3. Otherwise, runs compaction and logs fragment counts
        4. Releases lock in finally block

        The skip-silently approach prevents compaction queue buildup and
        log spam when writes are happening rapidly.
        """
        if self._table is None:
            logger.warning("compaction_skipped", reason="no_table_set")
            return

        # Try to acquire lock without blocking
        acquired = self._compaction_lock.acquire(blocking=False)
        if not acquired:
            logger.info("compaction_skipped", reason="already_running")
            return

        try:
            logger.info("compaction_started")

            # Count fragments before compaction via stats API
            stats = self._table.stats()
            fragments_before = stats.get("fragment_stats", {}).get("num_fragments", -1)

            # Perform compaction
            self._table.compact_files()

            # Count fragments after compaction
            stats = self._table.stats()
            fragments_after = stats.get("fragment_stats", {}).get("num_fragments", -1)
            fragments_merged = fragments_before - fragments_after if fragments_before >= 0 else -1

            logger.info(
                "compaction_complete",
                fragments_before=fragments_before,
                fragments_after=fragments_after,
                fragments_merged=fragments_merged
            )

        except Exception as e:
            logger.error("compaction_failed", error=str(e), exc_info=True)

        finally:
            self._compaction_lock.release()

    def start(self):
        """
        Start the compaction manager background thread.

        This thread:
        1. Runs initial compaction on startup
        2. Then enters a wait loop (checks stop event every 10s)
        3. Exits when stop_event is set

        Note: Write-triggered compaction happens via record_write() calls,
        not through this background thread.
        """
        if self._thread is not None and self._thread.is_alive():
            logger.warning("compaction_start_skipped", reason="already_running")
            return

        def background_loop():
            """Background thread that handles startup compaction."""
            # Run startup compaction
            logger.info("compaction_startup_begin")
            self._compact()

            # Wait loop (allows clean shutdown via stop_event)
            while not self._stop_event.is_set():
                # Check every 10 seconds
                self._stop_event.wait(10)

            logger.info("compaction_thread_stopped")

        self._thread = threading.Thread(
            target=background_loop,
            daemon=True,
            name="CompactionManagerThread"
        )
        self._thread.start()
        logger.info("compaction_manager_started", thread_name=self._thread.name)

    def stop(self):
        """
        Stop the compaction manager background thread.

        Signals the thread to stop and waits up to 5 seconds for it to exit.
        """
        if self._thread is None or not self._thread.is_alive():
            logger.debug("compaction_stop_skipped", reason="not_running")
            return

        logger.info("compaction_manager_stopping")
        self._stop_event.set()
        self._thread.join(timeout=5)

        if self._thread.is_alive():
            logger.warning("compaction_thread_did_not_stop", timeout_seconds=5)
        else:
            logger.info("compaction_manager_stopped")


# Global singleton instance
compaction_manager = CompactionManager()
