"""
Tests for LanceDB compaction manager.
"""

import threading
import time
from unittest.mock import MagicMock, patch

import pytest

from src.app.db.compaction import CompactionManager


class TestCompactionManager:
    """Tests for CompactionManager class."""

    def test_init_defaults(self):
        """Should initialize with default threshold of 100."""
        manager = CompactionManager()
        assert manager.write_threshold == 100
        assert manager._write_count == 0
        assert manager._table is None

    def test_init_custom_threshold(self):
        """Should initialize with custom threshold."""
        manager = CompactionManager(write_threshold=50)
        assert manager.write_threshold == 50

    def test_set_table(self):
        """Should store table reference."""
        manager = CompactionManager()
        mock_table = MagicMock()
        mock_table.name = "messages"

        manager.set_table(mock_table)

        assert manager._table is mock_table

    def test_record_write_increments_counter(self):
        """Should increment write counter atomically."""
        manager = CompactionManager(write_threshold=1000)  # High threshold to avoid trigger

        manager.record_write()
        assert manager._write_count == 1

        manager.record_write(count=5)
        assert manager._write_count == 6

    def test_record_write_triggers_compaction_at_threshold(self):
        """Should trigger compaction when threshold is reached."""
        manager = CompactionManager(write_threshold=3)
        mock_table = MagicMock()
        mock_table.list_fragments.return_value = [1, 2, 3]
        manager.set_table(mock_table)

        # Record writes below threshold
        manager.record_write(count=2)
        assert manager._write_count == 2
        time.sleep(0.1)  # Brief wait to ensure no compaction triggered
        mock_table.compact_files.assert_not_called()

        # Hit threshold
        manager.record_write(count=1)

        # Counter should be reset
        assert manager._write_count == 0

        # Wait for background thread to complete
        time.sleep(0.5)

        # Compaction should have been triggered
        mock_table.compact_files.assert_called_once()

    def test_record_write_resets_counter_after_trigger(self):
        """Should reset counter to 0 after triggering compaction."""
        manager = CompactionManager(write_threshold=5)
        mock_table = MagicMock()
        mock_table.list_fragments.return_value = []
        manager.set_table(mock_table)

        manager.record_write(count=5)

        # Counter should be reset immediately (before compaction completes)
        assert manager._write_count == 0

        # Wait for compaction thread
        time.sleep(0.5)

    def test_compact_skips_when_no_table(self):
        """Should skip compaction if table not set."""
        manager = CompactionManager()

        # Should not raise, just skip
        manager._compact()

    def test_compact_skips_when_lock_held(self):
        """Should skip compaction when another compaction is running."""
        manager = CompactionManager()
        mock_table = MagicMock()
        mock_table.list_fragments.return_value = [1, 2]
        manager.set_table(mock_table)

        # Manually acquire lock
        manager._compaction_lock.acquire()

        try:
            # Try to compact - should skip
            manager._compact()

            # Should not have called compact_files
            mock_table.compact_files.assert_not_called()
        finally:
            manager._compaction_lock.release()

    def test_compact_calls_compact_files(self):
        """Should call table.compact_files and log fragment counts."""
        manager = CompactionManager()
        mock_table = MagicMock()

        # Mock fragment counts
        mock_table.list_fragments.side_effect = [
            [1, 2, 3, 4, 5],  # Before compaction: 5 fragments
            [1, 2],           # After compaction: 2 fragments
        ]
        manager.set_table(mock_table)

        manager._compact()

        # Should have called compact_files
        mock_table.compact_files.assert_called_once()

        # Should have queried fragments twice (before and after)
        assert mock_table.list_fragments.call_count == 2

    def test_compact_handles_errors(self):
        """Should handle and log compaction errors."""
        manager = CompactionManager()
        mock_table = MagicMock()
        mock_table.list_fragments.return_value = [1, 2, 3]
        mock_table.compact_files.side_effect = Exception("Compaction failed")
        manager.set_table(mock_table)

        # Should not raise exception
        manager._compact()

        # Lock should be released even after error
        # Verify we can acquire it
        acquired = manager._compaction_lock.acquire(blocking=False)
        assert acquired is True
        manager._compaction_lock.release()

    def test_start_runs_startup_compaction(self):
        """Should run compaction once on startup."""
        manager = CompactionManager()
        mock_table = MagicMock()
        mock_table.list_fragments.return_value = [1, 2, 3]
        manager.set_table(mock_table)

        manager.start()

        # Wait for startup compaction to complete
        time.sleep(0.5)

        # Should have run compaction
        mock_table.compact_files.assert_called()

        # Clean up
        manager.stop()

    def test_start_skips_if_already_running(self):
        """Should not start multiple threads."""
        manager = CompactionManager()
        mock_table = MagicMock()
        mock_table.list_fragments.return_value = []
        manager.set_table(mock_table)

        manager.start()
        first_thread = manager._thread

        # Try to start again
        manager.start()

        # Should still be the same thread
        assert manager._thread is first_thread

        # Clean up
        manager.stop()

    def test_stop_signals_thread_to_exit(self):
        """Should stop background thread cleanly."""
        manager = CompactionManager()
        mock_table = MagicMock()
        mock_table.list_fragments.return_value = []
        manager.set_table(mock_table)

        manager.start()
        time.sleep(0.5)  # Let thread start

        assert manager._thread.is_alive()

        manager.stop()

        # Thread should exit
        assert not manager._thread.is_alive()

    def test_stop_when_not_running(self):
        """Should handle stop when thread is not running."""
        manager = CompactionManager()

        # Should not raise
        manager.stop()

    def test_concurrent_write_recording(self):
        """Should handle concurrent write recording safely."""
        manager = CompactionManager(write_threshold=1000)  # High threshold
        threads = []

        def record_writes():
            for _ in range(10):
                manager.record_write()

        # Start 5 threads recording writes
        for _ in range(5):
            thread = threading.Thread(target=record_writes)
            thread.start()
            threads.append(thread)

        # Wait for all threads
        for thread in threads:
            thread.join()

        # Should have recorded all 50 writes
        assert manager._write_count == 50


class TestCompactionManagerSingleton:
    """Tests for the global compaction_manager singleton."""

    def test_singleton_exists(self):
        """Should export a compaction_manager singleton."""
        from src.app.db.compaction import compaction_manager

        assert compaction_manager is not None
        assert isinstance(compaction_manager, CompactionManager)
