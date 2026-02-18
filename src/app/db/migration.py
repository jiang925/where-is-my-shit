"""
Database schema evolution and re-embedding utilities.

This module provides tools for migrating existing embeddings when switching
embedding models. It uses a second vector column (vector_v2) approach to
enable zero-downtime migration.
"""

import time
from typing import Any

import pyarrow as pa
import structlog

from src.app.core.config import config_manager
from src.app.db.client import db_client
from src.app.services.embedding_provider import create_embedding_provider

logger = structlog.get_logger()


def get_migration_status(table) -> dict[str, Any]:
    """
    Check migration status for the table.

    Args:
        table: LanceDB table instance

    Returns:
        Dictionary with:
        - has_v2: bool - Whether vector_v2 column exists
        - total: int - Total rows in table
        - migrated: int - Rows with vector_v2 populated
        - remaining: int - Rows without vector_v2
        - percent_complete: float - Migration progress (0-100)
    """
    schema = table.schema
    has_v2 = "vector_v2" in schema.names

    # Count total rows
    total = table.count_rows()

    if not has_v2 or total == 0:
        return {
            "has_v2": has_v2,
            "total": total,
            "migrated": 0,
            "remaining": total if has_v2 else 0,
            "percent_complete": 0.0,
        }

    # Count rows where vector_v2 is NOT NULL
    # LanceDB uses PyArrow compute for filtering
    # We'll query and count results
    try:
        # Query rows where vector_v2 IS NULL
        remaining_results = table.search().where("vector_v2 IS NULL", prefilter=True).limit(total).to_list()
        remaining = len(remaining_results)
        migrated = total - remaining
    except Exception as e:
        logger.warning(f"Could not query null vector_v2 rows: {e}")
        # Fallback: assume none migrated
        remaining = total
        migrated = 0

    percent_complete = (migrated / total * 100) if total > 0 else 0.0

    return {
        "has_v2": has_v2,
        "total": total,
        "migrated": migrated,
        "remaining": remaining,
        "percent_complete": percent_complete,
    }


def add_vector_v2_column(table, dimensions: int) -> None:
    """
    Add vector_v2 and embedding_model_v2 columns to the table.

    This operation is idempotent - it will skip if columns already exist.

    Args:
        table: LanceDB table instance
        dimensions: Dimensionality of the new vector column
    """
    schema = table.schema

    # Check if columns already exist
    if "vector_v2" in schema.names and "embedding_model_v2" in schema.names:
        logger.info("vector_v2 and embedding_model_v2 columns already exist, skipping")
        return

    # Define new columns using PyArrow schema
    new_fields = []

    if "vector_v2" not in schema.names:
        # Fixed-size list of floats (vector)
        vector_field = pa.field("vector_v2", pa.list_(pa.float32(), dimensions))
        new_fields.append(vector_field)

    if "embedding_model_v2" not in schema.names:
        # String field for model name
        model_field = pa.field("embedding_model_v2", pa.utf8())
        new_fields.append(model_field)

    if not new_fields:
        logger.info("All migration columns already exist")
        return

    # Add columns (they will be initialized with NULL)
    logger.info(f"Adding migration columns: {[f.name for f in new_fields]}")
    table.add_columns(new_fields)
    logger.info("Migration columns added successfully")


def is_migration_incomplete(table) -> bool:
    """
    Check if there is an incomplete migration in progress.

    Args:
        table: LanceDB table instance

    Returns:
        True if vector_v2 column exists and has unmigrated rows, False otherwise
    """
    schema = table.schema
    if "vector_v2" not in schema.names:
        return False

    status = get_migration_status(table)
    return status["remaining"] > 0


def promote_migration(table) -> bool:
    """
    Promote migration: copy vector_v2 to vector, drop migration columns.

    This function completes the migration by:
    1. Replacing the 'vector' column with data from 'vector_v2'
    2. Dropping the migration columns (vector_v2, embedding_model_v2)

    This makes the v2 column reusable for future migrations.

    Args:
        table: LanceDB table instance

    Returns:
        True if promotion was performed, False if no v2 column exists
    """
    schema = table.schema
    if "vector_v2" not in schema.names:
        logger.info("promote_migration_skipped", reason="no_v2_column")
        return False

    logger.info("migration_promotion_starting")

    try:
        # Read entire table to PyArrow
        arrow_table = table.to_arrow()

        # Get vector_v2 data
        v2_data = arrow_table.column("vector_v2")

        # Drop old vector column
        arrow_table = arrow_table.drop("vector")

        # Add v2 data as 'vector' column
        arrow_table = arrow_table.append_column("vector", v2_data)

        # Drop migration columns
        arrow_table = arrow_table.drop(["vector_v2", "embedding_model_v2"])

        # Overwrite table atomically
        # Get database connection to recreate table
        db = db_client.connect()
        table_name = table.name
        db.create_table(table_name, arrow_table, mode="overwrite")

        logger.info("migration_promotion_complete", table=table_name)
        return True

    except Exception as e:
        logger.error("migration_promotion_failed", error=str(e), exc_info=True)
        raise


def reembed_batch(table, provider, batch_size: int = 100, model_name: str | None = None) -> dict[str, Any]:
    """
    Re-embed a batch of documents that haven't been migrated yet.

    Args:
        table: LanceDB table instance
        provider: EmbeddingProvider instance
        batch_size: Number of documents to process in this batch
        model_name: Model name to record (defaults to provider.get_model_name())

    Returns:
        Dictionary with:
        - processed: int - Number of rows processed in this batch
        - remaining: int - Estimated remaining rows
        - status: str - "progress" or "complete"
    """
    if model_name is None:
        model_name = provider.get_model_name()

    # Query rows where vector_v2 IS NULL or embedding_model_v2 IS NULL
    try:
        # Note: LanceDB search().where() requires a vector search first in some versions
        # Alternative: Use to_pandas() and filter, but that loads everything
        # Let's try direct SQL-style where clause with limit
        unmigrated = (
            table.search()
            .where("vector_v2 IS NULL OR embedding_model_v2 IS NULL", prefilter=True)
            .limit(batch_size)
            .to_list()
        )
    except Exception as e:
        logger.error(f"Failed to query unmigrated rows: {e}")
        # Fallback: try without prefilter
        try:
            all_rows = table.to_pandas()
            unmigrated_df = all_rows[all_rows["vector_v2"].isna()]
            unmigrated = unmigrated_df.head(batch_size).to_dict("records")
        except Exception as e2:
            logger.error(f"Fallback query also failed: {e2}")
            return {"processed": 0, "remaining": 0, "status": "error"}

    if not unmigrated:
        return {"processed": 0, "remaining": 0, "status": "complete"}

    # Extract content and IDs
    contents = [row["content"] for row in unmigrated]
    row_ids = [row["id"] for row in unmigrated]

    # Generate new embeddings
    try:
        embeddings = provider.embed(contents)
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        return {"processed": 0, "remaining": len(unmigrated), "status": "error"}

    # Update rows with new embeddings
    # LanceDB doesn't have direct row update by ID in Python API easily
    # We need to use merge or delete+insert
    # Simplest approach: update using merge with matching on 'id'
    updates = []
    for row_id, embedding in zip(row_ids, embeddings):
        updates.append(
            {
                "id": row_id,
                "vector_v2": embedding,
                "embedding_model_v2": model_name,
            }
        )

    try:
        # Merge updates into table
        # LanceDB merge: matches on schema's unique key (we use 'id')
        table.merge(updates, "id")
        processed = len(updates)
        logger.info(f"Successfully re-embedded {processed} documents")
    except Exception as e:
        logger.error(f"Failed to update rows with new embeddings: {e}")
        return {"processed": 0, "remaining": len(unmigrated), "status": "error"}

    # Check remaining count
    status_info = get_migration_status(table)
    remaining = status_info["remaining"]

    # Auto-promote if migration is complete
    if remaining == 0:
        logger.info("migration_complete_auto_promoting")
        try:
            promote_migration(table)
            logger.info("auto_promotion_successful")
        except Exception as e:
            logger.error("auto_promotion_failed", error=str(e))
            # Don't fail the batch - migration data is still valid

    return {
        "processed": processed,
        "remaining": remaining,
        "status": "complete" if remaining == 0 else "progress",
    }


def run_full_migration(batch_size: int = 100, delay_seconds: float = 0.5) -> None:
    """
    Run the full re-embedding migration process.

    This function:
    1. Loads configuration and creates embedding provider
    2. Opens the messages table
    3. Adds vector_v2 column if needed
    4. Processes documents in batches until all are migrated
    5. Prints progress to stdout

    Args:
        batch_size: Documents to process per batch
        delay_seconds: Delay between batches to avoid overwhelming CPU/GPU
    """
    print("Starting re-embedding migration...")

    # Load config and create provider
    config = config_manager.config
    embedding_config = config.embedding.model_dump()
    provider = create_embedding_provider(embedding_config)

    print(f"Using provider: {embedding_config['provider']}")
    print(f"Model: {provider.get_model_name()}")
    print(f"Dimensions: {provider.get_dimensions()}")

    # Open table
    table = db_client.get_table("messages")

    # Add vector_v2 column if needed
    dimensions = provider.get_dimensions()
    add_vector_v2_column(table, dimensions)

    # Check initial status
    status = get_migration_status(table)
    print("\nMigration status:")
    print(f"  Total documents: {status['total']}")
    print(f"  Already migrated: {status['migrated']}")
    print(f"  Remaining: {status['remaining']}")
    print(f"  Progress: {status['percent_complete']:.1f}%\n")

    if status["remaining"] == 0:
        print("Migration already complete!")
        return

    # Process in batches
    total_processed = 0
    iteration = 0

    while True:
        iteration += 1
        print(f"Processing batch {iteration} (up to {batch_size} documents)...")

        result = reembed_batch(table, provider, batch_size=batch_size)

        if result["status"] == "error":
            print("Error occurred during re-embedding. Check logs.")
            break

        processed = result["processed"]
        remaining = result["remaining"]
        total_processed += processed

        print(f"  Processed: {processed} documents")
        print(f"  Remaining: {remaining} documents")

        if result["status"] == "complete":
            print(f"\nMigration complete! Total processed: {total_processed}")
            break

        # Delay before next batch
        if delay_seconds > 0 and remaining > 0:
            time.sleep(delay_seconds)

    # Final status
    final_status = get_migration_status(table)
    print("\nFinal migration status:")
    print(f"  Total: {final_status['total']}")
    print(f"  Migrated: {final_status['migrated']}")
    print(f"  Progress: {final_status['percent_complete']:.1f}%")


def auto_resume_migration(table, batch_size: int = 100, delay_seconds: float = 0.5) -> None:
    """
    Auto-resume incomplete migration on server startup.

    This function checks if there's an incomplete migration and resumes it
    in the background. It's designed to be called in a background thread
    during server startup.

    Args:
        table: LanceDB table instance
        batch_size: Documents to process per batch (default 100)
        delay_seconds: Delay between batches (default 0.5s)
    """
    # Check if migration is incomplete
    if not is_migration_incomplete(table):
        logger.info("auto_resume_migration_skipped", reason="no_incomplete_migration")
        return

    logger.info("migration_auto_resume_starting")

    try:
        # Load config and create provider
        config = config_manager.config
        embedding_config = config.embedding.model_dump()
        provider = create_embedding_provider(embedding_config)

        logger.info(
            "auto_resume_migration_config",
            provider=embedding_config["provider"],
            model=provider.get_model_name(),
            dimensions=provider.get_dimensions(),
        )

        # Get initial status
        status = get_migration_status(table)
        logger.info(
            "auto_resume_migration_status",
            total=status["total"],
            migrated=status["migrated"],
            remaining=status["remaining"],
            percent_complete=status["percent_complete"],
        )

        # Process in batches until complete
        total_processed = 0
        iteration = 0

        while True:
            iteration += 1
            logger.debug("auto_resume_batch_starting", iteration=iteration, batch_size=batch_size)

            result = reembed_batch(table, provider, batch_size=batch_size)

            if result["status"] == "error":
                logger.error("auto_resume_migration_error", iteration=iteration)
                break

            processed = result["processed"]
            remaining = result["remaining"]
            total_processed += processed

            logger.info(
                "auto_resume_batch_complete",
                iteration=iteration,
                processed=processed,
                remaining=remaining,
                total_processed=total_processed,
            )

            if result["status"] == "complete":
                logger.info("auto_resume_migration_complete", total_processed=total_processed)
                break

            # Delay before next batch
            if delay_seconds > 0 and remaining > 0:
                time.sleep(delay_seconds)

    except Exception as e:
        logger.error("auto_resume_migration_failed", error=str(e), exc_info=True)
