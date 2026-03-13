"""
Tests for database migration functionality.
"""

from unittest.mock import MagicMock, patch

import pyarrow as pa

from src.app.db.migration import (
    add_vector_v2_column,
    auto_resume_migration,
    get_migration_status,
    is_migration_incomplete,
    promote_migration,
    reembed_batch,
)


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
        table.schema = pa.schema(
            [
                pa.field("id", pa.utf8()),
                pa.field("vector_v2", pa.list_(pa.float32(), 384)),
            ]
        )
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
        table.schema = pa.schema(
            [
                pa.field("id", pa.utf8()),
                pa.field("vector_v2", pa.list_(pa.float32(), 384)),
            ]
        )
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
        table.schema = pa.schema(
            [
                pa.field("id", pa.utf8()),
                pa.field("vector_v2", pa.list_(pa.float32(), 384)),
            ]
        )
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
        table.schema = pa.schema(
            [
                pa.field("id", pa.utf8()),
                pa.field("vector_v2", pa.list_(pa.float32(), 768)),
                pa.field("embedding_model_v2", pa.utf8()),
            ]
        )

        add_vector_v2_column(table, dimensions=768)

        # Should not call add_columns
        table.add_columns.assert_not_called()

    def test_add_only_missing_column(self):
        """Should add only vector_v2 if embedding_model_v2 exists."""
        table = MagicMock()
        table.schema = pa.schema(
            [
                pa.field("id", pa.utf8()),
                pa.field("embedding_model_v2", pa.utf8()),
            ]
        )

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

        # Verify table.update was called for each row
        assert table.update.call_count == 2
        first_call = table.update.call_args_list[0]
        assert first_call[1]["where"] == "id = 'msg-1'"
        assert first_call[1]["values"]["embedding_model_v2"] == "nomic-embed-text"
        assert len(first_call[1]["values"]["vector_v2"]) == 384

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

        # Should not call embed or update
        provider.embed.assert_not_called()
        table.update.assert_not_called()

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

            _result = reembed_batch(table, provider, batch_size=10, model_name="custom-model-v2")

        # Verify custom model name was used in table.update calls
        first_call = table.update.call_args_list[0]
        assert first_call[1]["values"]["embedding_model_v2"] == "custom-model-v2"

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

    def test_reembed_batch_auto_promotes_on_completion(self):
        """Should automatically promote migration when all rows are migrated."""
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

        # Mock promote_migration
        with patch("src.app.db.migration.get_migration_status") as status_mock:
            with patch("src.app.db.migration.promote_migration") as promote_mock:
                status_mock.return_value = {"remaining": 0}

                result = reembed_batch(table, provider, batch_size=10)

                # Should have called promote_migration
                promote_mock.assert_called_once_with(table)

                assert result["status"] == "complete"


class TestPromoteMigration:
    """Tests for promote_migration function."""

    def test_promote_migration_success(self):
        """Should promote v2 to v1 and drop migration columns."""
        table = MagicMock()
        table.name = "messages"

        # Mock schema with vector_v2
        table.schema = pa.schema(
            [
                pa.field("id", pa.utf8()),
                pa.field("content", pa.utf8()),
                pa.field("vector", pa.list_(pa.float32(), 384)),
                pa.field("vector_v2", pa.list_(pa.float32(), 768)),
                pa.field("embedding_model_v2", pa.utf8()),
            ]
        )

        # Mock arrow table data
        mock_arrow_table = MagicMock()
        mock_v2_column = MagicMock()
        table.to_arrow.return_value = mock_arrow_table
        mock_arrow_table.column.return_value = mock_v2_column

        # Mock drop and append operations
        mock_after_drop_vector = MagicMock()
        mock_after_append = MagicMock()
        mock_final = MagicMock()

        mock_arrow_table.drop.side_effect = [
            mock_after_drop_vector,  # After dropping 'vector'
            mock_final,  # After dropping migration columns
        ]
        mock_after_drop_vector.append_column.return_value = mock_after_append
        mock_after_append.drop.return_value = mock_final

        # Mock db_client
        with patch("src.app.db.migration.db_client") as db_client_mock:
            mock_db = MagicMock()
            db_client_mock.connect.return_value = mock_db

            result = promote_migration(table)

            # Should return True
            assert result is True

            # Verify operations
            table.to_arrow.assert_called_once()
            mock_arrow_table.column.assert_called_with("vector_v2")
            mock_after_drop_vector.append_column.assert_called_with("vector", mock_v2_column)

            # Verify database overwrite
            mock_db.create_table.assert_called_once_with("messages", mock_final, mode="overwrite")

    def test_promote_migration_no_v2_column(self):
        """Should skip promotion if no vector_v2 column exists."""
        table = MagicMock()
        table.schema = pa.schema(
            [
                pa.field("id", pa.utf8()),
                pa.field("vector", pa.list_(pa.float32(), 384)),
            ]
        )

        result = promote_migration(table)

        # Should return False and not call to_arrow
        assert result is False
        table.to_arrow.assert_not_called()


class TestIsMigrationIncomplete:
    """Tests for is_migration_incomplete function."""

    def test_incomplete_when_v2_exists_with_nulls(self):
        """Should return True when v2 column exists with NULL rows."""
        table = MagicMock()
        table.schema = pa.schema(
            [
                pa.field("id", pa.utf8()),
                pa.field("vector_v2", pa.list_(pa.float32(), 768)),
            ]
        )

        with patch("src.app.db.migration.get_migration_status") as status_mock:
            status_mock.return_value = {"remaining": 10}

            result = is_migration_incomplete(table)

            assert result is True

    def test_not_incomplete_when_no_v2(self):
        """Should return False when no v2 column exists."""
        table = MagicMock()
        table.schema = pa.schema(
            [
                pa.field("id", pa.utf8()),
                pa.field("vector", pa.list_(pa.float32(), 384)),
            ]
        )

        result = is_migration_incomplete(table)

        assert result is False

    def test_not_incomplete_when_all_migrated(self):
        """Should return False when all rows are migrated."""
        table = MagicMock()
        table.schema = pa.schema(
            [
                pa.field("id", pa.utf8()),
                pa.field("vector_v2", pa.list_(pa.float32(), 768)),
            ]
        )

        with patch("src.app.db.migration.get_migration_status") as status_mock:
            status_mock.return_value = {"remaining": 0}

            result = is_migration_incomplete(table)

            assert result is False


class TestAutoResumeMigration:
    """Tests for auto_resume_migration function."""

    def test_auto_resume_skips_when_no_migration(self):
        """Should skip when no incomplete migration exists."""
        table = MagicMock()

        with patch("src.app.db.migration.is_migration_incomplete") as incomplete_mock:
            incomplete_mock.return_value = False

            auto_resume_migration(table)

            # Should not attempt to load config or resume
            incomplete_mock.assert_called_once_with(table)

    def test_auto_resume_runs_migration(self):
        """Should run migration batches when incomplete migration exists."""
        table = MagicMock()

        with patch("src.app.db.migration.is_migration_incomplete") as incomplete_mock:
            with patch("src.app.db.migration.config_manager") as config_mock:
                with patch("src.app.db.migration.create_embedding_provider") as provider_mock:
                    with patch("src.app.db.migration.get_migration_status") as status_mock:
                        with patch("src.app.db.migration.reembed_batch") as batch_mock:
                            # Setup mocks
                            incomplete_mock.return_value = True
                            mock_config = MagicMock()
                            mock_config.embedding.model_dump.return_value = {"provider": "fastembed"}
                            config_mock.config = mock_config

                            mock_provider = MagicMock()
                            mock_provider.get_model_name.return_value = "bge-small"
                            mock_provider.get_dimensions.return_value = 384
                            provider_mock.return_value = mock_provider

                            status_mock.return_value = {
                                "total": 100,
                                "migrated": 50,
                                "remaining": 50,
                                "percent_complete": 50.0,
                            }

                            # Simulate two batches then complete
                            batch_mock.side_effect = [
                                {"processed": 50, "remaining": 50, "status": "progress"},
                                {"processed": 50, "remaining": 0, "status": "complete"},
                            ]

                            # Run auto-resume
                            auto_resume_migration(table, batch_size=50, delay_seconds=0)

                            # Should have called reembed_batch twice
                            assert batch_mock.call_count == 2
