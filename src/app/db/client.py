import os
from typing import Optional

import lancedb

from src.app.core.config import settings
from src.app.db.intelligence_migrations import run_migrations
from src.app.schemas.message import Message


class DBClient:
    _instance: Optional["DBClient"] = None
    _db: lancedb.DBConnection | None = None
    _tables: dict[str, lancedb.table.Table] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._tables = {}
        return cls._instance

    def connect(self) -> lancedb.DBConnection:
        """
        Connects to LanceDB. Creates the directory if it doesn't exist.
        """
        if self._db is None:
            # Ensure the directory exists
            os.makedirs(os.path.dirname(settings.DB_PATH), exist_ok=True)
            self._db = lancedb.connect(settings.DB_PATH)
        return self._db

    def init_db(self):
        """
        Initializes the database:
        - Creates the 'messages' table if it doesn't exist.
        - Configures FTS and Vector indices.
        - Runs intelligence layer migrations.
        """
        db = self.connect()
        
        # Run intelligence layer migrations
        try:
            run_migrations(db)
        except Exception as e:
            print(f"Warning: Intelligence layer migration failed: {e}")
        
        table_name = "messages"

        if table_name not in db.table_names():
            # Create the table using the Pydantic schema
            table = db.create_table(table_name, schema=Message)
            self._tables[table_name] = table

            # Creating indices on empty table works in recent LanceDB versions.
            try:
                table.create_fts_index("content")
                print(f"Created FTS index on 'content' field for new table '{table_name}'")
            except Exception as e:
                print(f"Warning: Failed to create FTS index on new table: {e}")
                print("  FTS index will be created when data is present")
        else:
            # If table exists, open it and cache the handle
            table = self.get_table(table_name)

            # Add embedding_model column if missing (schema evolution from Phase 19)
            schema_fields = {field.name for field in table.schema}
            if "embedding_model" not in schema_fields:
                try:
                    table.add_columns({"embedding_model": "'BAAI/bge-small-en-v1.5'"})
                    print(f"Added 'embedding_model' column to existing table '{table_name}'")
                except Exception as e:
                    print(f"Warning: Failed to add 'embedding_model' column: {e}")

            # Ensure FTS index exists for existing tables
            try:
                # Check existing indices
                indices = table.list_indices()
                has_fts_index = any(
                    idx.get("index_type") == "FTS" and "content" in str(idx.get("columns", [])) for idx in indices
                )

                if not has_fts_index:
                    print(f"FTS index missing on existing table '{table_name}', creating...")
                    table.create_fts_index("content", replace=True)
                    print("Created FTS index on 'content' field for existing table")
                else:
                    print("FTS index already exists on 'content' field")
            except Exception as e:
                print(f"Warning: Failed to verify/create FTS index on existing table: {e}")
                print("  Hybrid search may fall back to vector-only mode")

    def get_vector_dim(self, table_name: str = "messages") -> int:
        """Return the vector dimension from the table schema (cached)."""
        cache_key = f"_vdim_{table_name}"
        if not hasattr(self, cache_key) or getattr(self, cache_key) is None:
            table = self.get_table(table_name)
            for field in table.schema:
                if field.name == "vector" and hasattr(field.type, "list_size"):
                    setattr(self, cache_key, field.type.list_size)
                    return field.type.list_size
            setattr(self, cache_key, 384)  # fallback
        return getattr(self, cache_key)

    def get_table(self, table_name: str = "messages") -> lancedb.table.Table:
        if table_name not in self._tables:
            db = self.connect()
            self._tables[table_name] = db.open_table(table_name)
        return self._tables[table_name]

    def close(self):
        """Close all cached table handles and the database connection."""
        self._tables.clear()
        self._db = None


# Global instance
db_client = DBClient()


def get_db() -> lancedb.DBConnection:
    """Dependency injection helper"""
    return db_client.connect()


def init_db():
    """Public helper to initialize DB"""
    db_client.init_db()
