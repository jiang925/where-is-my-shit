"""Database migrations for Intelligence Layer (Phase 2).

This module handles schema migrations for the new knowledge extraction,
conversation threading, and saved search features.
"""

import json
import os
from datetime import UTC, datetime
from pathlib import Path

import lancedb

from src.app.core.config import settings
from src.app.schemas.knowledge import KnowledgeItem
from src.app.schemas.saved_search import SavedSearch
from src.app.schemas.thread import ConversationThread, ThreadConversation

MIGRATION_VERSION_FILE = Path(settings.DB_PATH).parent / "migration_version.json"


def get_current_version() -> int:
    """Get current database schema version."""
    if not MIGRATION_VERSION_FILE.exists():
        return 0
    try:
        with open(MIGRATION_VERSION_FILE) as f:
            data = json.load(f)
            return data.get("version", 0)
    except Exception:
        return 0


def set_version(version: int) -> None:
    """Set database schema version."""
    MIGRATION_VERSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(MIGRATION_VERSION_FILE, "w") as f:
        json.dump({
            "version": version,
            "migrated_at": datetime.now(UTC).isoformat()
        }, f)


def backup_database(db_path: str) -> str:
    """Create a backup of the database before migration."""
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    backup_path = f"{db_path}.backup.{timestamp}"
    
    if os.path.exists(db_path):
        import shutil
        shutil.copytree(db_path, backup_path, dirs_exist_ok=True)
        print(f"Database backed up to: {backup_path}")
    
    return backup_path


def migrate_v1_intelligence_layer(db: lancedb.DBConnection) -> None:
    """Migration v1: Create intelligence layer tables.
    
    Creates:
    - knowledge_items table
    - conversation_threads table
    - thread_conversations table
    - saved_searches table
    """
    print("Running migration v1: Intelligence Layer tables...")
    
    # Create knowledge_items table
    if "knowledge_items" not in db.table_names():
        table = db.create_table("knowledge_items", schema=KnowledgeItem)
        print("Created 'knowledge_items' table")
        
        # Create FTS index on content
        try:
            table.create_fts_index("content")
            print("Created FTS index on 'knowledge_items.content'")
        except Exception as e:
            print(f"Warning: Failed to create FTS index: {e}")
    else:
        print("'knowledge_items' table already exists")
    
    # Create conversation_threads table
    if "conversation_threads" not in db.table_names():
        table = db.create_table("conversation_threads", schema=ConversationThread)
        print("Created 'conversation_threads' table")
    else:
        print("'conversation_threads' table already exists")
    
    # Create thread_conversations table
    if "thread_conversations" not in db.table_names():
        table = db.create_table("thread_conversations", schema=ThreadConversation)
        print("Created 'thread_conversations' table")
    else:
        print("'thread_conversations' table already exists")
    
    # Create saved_searches table
    if "saved_searches" not in db.table_names():
        table = db.create_table("saved_searches", schema=SavedSearch)
        print("Created 'saved_searches' table")
    else:
        print("'saved_searches' table already exists")
    
    print("Migration v1 complete!")


def run_migrations(db: lancedb.DBConnection | None = None) -> None:
    """Run all pending migrations."""
    current_version = get_current_version()
    print(f"Current database version: {current_version}")
    
    if db is None:
        db = lancedb.connect(settings.DB_PATH)
    
    # Backup before any migrations
    if current_version < 1:
        backup_database(settings.DB_PATH)
    
    # Run migrations in order
    if current_version < 1:
        migrate_v1_intelligence_layer(db)
        set_version(1)
    
    print(f"Database migrated to version {get_current_version()}")


def rollback_v1_intelligence_layer(db: lancedb.DBConnection) -> None:
    """Rollback v1 migration - drop intelligence layer tables."""
    print("Rolling back v1: Dropping Intelligence Layer tables...")
    
    tables_to_drop = [
        "knowledge_items",
        "conversation_threads",
        "thread_conversations",
        "saved_searches"
    ]
    
    for table_name in tables_to_drop:
        if table_name in db.table_names():
            db.drop_table(table_name)
            print(f"Dropped '{table_name}' table")
    
    set_version(0)
    print("Rollback complete!")
