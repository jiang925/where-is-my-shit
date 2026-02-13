"""
Tests for database migration functionality.
"""

from unittest.mock import MagicMock, patch

import pyarrow as pa
import pytest

from src.app.db.migration import add_vector_v2_column, get_migration_status, reembed_batch


class TestMigrationStatus:
    """Tests for get_migration_status function."""

    def test_status_without_v2_column(self):
        """Should report has_v2=False when vector_v2 doesn't exist."""
        # Mock table without vector_v2
        table = MagicMock()
        table.schema = pa.schema([pa.field("id", pa.utf8()), pa.field("content", pa.utf8())])
        table.count_rows.return_value = 100

        status = get_migration_status(table)

        assert status["has_v2"] is False
        assert status["total"] == 100
        assert status["migrated"] == 0
        assert status["remaining"] == 0
        assert status["percent_complete"] == 0.0

    def test_status_with_v2_all_migrated(self):
        """Should report 100% when all rows have vector_v2."""
        table = MagicMock()
        table.schema = pa.schema([
            pa.field("id", pa.utf8()),
            pa.field("vector_v2", pa.list_(pa.float32(), 384)),
        ])
        table.count_rows.return_value = 50

        # Mock search chain for NULL check
        search_mock = MagicMock()
        where_mock = MagicMock()
        limit_mock = MagicMock()

        table.search.return_value = search_mock
        search_mock.where.return_value = where_mock
        where_mock.limit.return_value = limit_mock
        limit_mock.to_list.return_value = []  # No NULL rows

        status = get_migration_status(table)

        assert status["has_v2"] is True
        assert status["total"] == 50
        assert status["migrated"] == 50
        assert status["remaining"] == 0
        assert status["percent_complete"] == 100.0

    def test_status_with_v2_partial_migration(self):
        """Should calculate correct percentages for partial migration."""
        table = MagicMock()
        table.schema = pa.schema([
            pa.field("id", pa.utf8()),
            pa.field("vector_v2", pa.list_(pa.float32(), 384)),
        ])
        table.count_rows.return_value = 100

        # Mock 30 rows with NULL vector_v2
        search_mock = MagicMock()
        where_mock = MagicMock()
        limit_mock = MagicMock()

        table.search.return_value = search_mock
        search_mock.where.return_value = where_mock
        where_mock.limit.return_value = limit_mock
        limit_mock.to_list.return_value = [{"id": f"msg-{i}"} for i in range(30)]

        status = get_migration_status(table)

        assert status["has_v2"] is True
        assert status["total"] == 100
        assert status["migrated"] == 70
        assert status["remaining"] == 30
        assert status["percent_complete"] == 70.0

    def test_status_empty_table(self):
        """Should handle empty tables correctly."""
        table = MagicMock()
        table.schema = pa.schema([
            pa.field("id", pa.utf8()),
            pa.field("vector_v2", pa.list_(pa.float32(), 384)),
        ])
        table.count_rows.return_value = 0

        status = get_migration_status(table)

        assert status["has_v2"] is True
        assert status["total"] == 0
        assert status["migrated"] == 0
        assert status["remaining"] == 0
        assert status["percent_complete"] == 0.0


class TestAddVectorV2Column:
    """Tests for add_vector_v2_column function."""

    def test_add_columns_when_missing(self):
        """Should add both vector_v2 and embedding_model_v2 when missing."""
        table = MagicMock()
        table.schema = pa.schema([pa.field("id", pa.utf8()), pa.field("content", pa.utf8())])

        add_vector_v2_column(table, dimensions=768)

        # Verify add_columns was called with correct fields
        table.add_columns.assert_called_once()
        call_args = table.add_columns.call_args[0][0]

        assert len(call_args) == 2
        assert call_args[0].name == "vector_v2"
        assert call_args[0].type == pa.list_(pa.float32(), 768)
        assert call_args[1].name == "embedding_model_v2"
        assert call_args[1].type == pa.utf8()

    def test_idempotent_when_columns_exist(self):
        """Should skip if columns already exist."""
        table = MagicMock()
        table.schema = pa.schema([
            pa.field("id", pa.utf8()),
            pa.field("vector_v2", pa.list_(pa.float32(), 768)),
            pa.field("embedding_model_v2", pa.utf8()),
        ])

        add_vector_v2_column(table, dimensions=768)

        # Should not call add_columns
        table.add_columns.assert_not_called()

    def test_add_only_missing_column(self):
        """Should add only vector_v2 if embedding_model_v2 exists."""
        table = MagicMock()
        table.schema = pa.schema([
            pa.field("id", pa.utf8()),
            pa.field("embedding_model_v2", pa.utf8()),
        ])

        add_vector_v2_column(table, dimensions=512)

        table.add_columns.assert_called_once()
        call_args = table.add_columns.call_args[0][0]

        assert len(call_args) == 1
        assert call_args[0].name == "vector_v2"
        assert call_args[0].type == pa.list_(pa.float32(), 512)


class TestReembedBatch:
    """Tests for reembed_batch function."""

    def test_reembed_batch_success(self):
        """Should successfully re-embed documents and update table."""
        table = MagicMock()
        provider = MagicMock()

        # Mock provider
        provider.get_model_name.return_value = "nomic-embed-text"
        provider.embed.return_value = [
            [0.1, 0.2, 0.3] * 128,  # 384-dim vector
            [0.4, 0.5, 0.6] * 128,
        ]

        # Mock unmigrated rows query
        search_mock = MagicMock()
        where_mock = MagicMock()
        limit_mock = MagicMock()

        table.search.return_value = search_mock
        search_mock.where.return_value = where_mock
        where_mock.limit.return_value = limit_mock
        limit_mock.to_list.return_value = [
            {"id": "msg-1", "content": "Hello world"},
            {"id": "msg-2", "content": "Test message"},
        ]

        # Mock get_migration_status for remaining count
        with patch("src.app.db.migration.get_migration_status") as status_mock:
            status_mock.return_value = {"remaining": 5}

            result = reembed_batch(table, provider, batch_size=10)

        # Verify embeddings were generated
        provider.embed.assert_called_once_with(["Hello world", "Test message"])

        # Verify table.merge was called
        table.merge.assert_called_once()
        updates = table.merge.call_args[0][0]
        assert len(updates) == 2
        assert updates[0]["id"] == "msg-1"
        assert updates[0]["embedding_model_v2"] == "nomic-embed-text"
        assert len(updates[0]["vector_v2"]) == 384

        # Verify result
        assert result["processed"] == 2
        assert result["remaining"] == 5
        assert result["status"] == "progress"

    def test_reembed_batch_complete(self):
        """Should return status='complete' when no remaining rows."""
        table = MagicMock()
        provider = MagicMock()

        provider.get_model_name.return_value = "test-model"
        provider.embed.return_value = [[0.1] * 384]

        search_mock = MagicMock()
        where_mock = MagicMock()
        limit_mock = MagicMock()

        table.search.return_value = search_mock
        search_mock.where.return_value = where_mock
        where_mock.limit.return_value = limit_mock
        limit_mock.to_list.return_value = [{"id": "msg-1", "content": "Last one"}]

        with patch("src.app.db.migration.get_migration_status") as status_mock:
            status_mock.return_value = {"remaining": 0}

            result = reembed_batch(table, provider, batch_size=10)

        assert result["processed"] == 1
        assert result["remaining"] == 0
        assert result["status"] == "complete"

    def test_reembed_batch_no_unmigrated(self):
        """Should return immediately if no unmigrated rows found."""
        table = MagicMock()
        provider = MagicMock()

        search_mock = MagicMock()
        where_mock = MagicMock()
        limit_mock = MagicMock()

        table.search.return_value = search_mock
        search_mock.where.return_value = where_mock
        where_mock.limit.return_value = limit_mock
        limit_mock.to_list.return_value = []  # No unmigrated rows

        result = reembed_batch(table, provider, batch_size=10)

        # Should not call embed or merge
        provider.embed.assert_not_called()
        table.merge.assert_not_called()

        assert result["processed"] == 0
        assert result["remaining"] == 0
        assert result["status"] == "complete"

    def test_reembed_batch_custom_model_name(self):
        """Should use custom model_name when provided."""
        table = MagicMock()
        provider = MagicMock()

        provider.embed.return_value = [[0.1] * 384]

        search_mock = MagicMock()
        where_mock = MagicMock()
        limit_mock = MagicMock()

        table.search.return_value = search_mock
        search_mock.where.return_value = where_mock
        where_mock.limit.return_value = limit_mock
        limit_mock.to_list.return_value = [{"id": "msg-1", "content": "Test"}]

        with patch("src.app.db.migration.get_migration_status") as status_mock:
            status_mock.return_value = {"remaining": 0}

            result = reembed_batch(table, provider, batch_size=10, model_name="custom-model-v2")

        # Verify custom model name was used
        updates = table.merge.call_args[0][0]
        assert updates[0]["embedding_model_v2"] == "custom-model-v2"

    def test_reembed_batch_handles_embed_error(self):
        """Should handle embedding generation errors gracefully."""
        table = MagicMock()
        provider = MagicMock()

        provider.get_model_name.return_value = "test-model"
        provider.embed.side_effect = Exception("API error")

        search_mock = MagicMock()
        where_mock = MagicMock()
        limit_mock = MagicMock()

        table.search.return_value = search_mock
        search_mock.where.return_value = where_mock
        where_mock.limit.return_value = limit_mock
        limit_mock.to_list.return_value = [{"id": "msg-1", "content": "Test"}]

        result = reembed_batch(table, provider, batch_size=10)

        # Should return error status
        assert result["processed"] == 0
        assert result["status"] == "error"
        table.merge.assert_not_called()
