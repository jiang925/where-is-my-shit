import lancedb
import pytest
from src.app.db.client import DBClient

def test_db_connection(db_client):
    """Test that we can connect to the database."""
    conn = db_client.connect()
    assert isinstance(conn, lancedb.DBConnection)

def test_init_db_creates_table(db_client):
    """Test that init_db creates the messages table."""
    # Ensure clean state
    conn = db_client.connect()
    assert "messages" not in conn.table_names()

    # Initialize
    db_client.init_db()

    # Check table exists
    assert "messages" in conn.table_names()

    # Check table schema or properties if possible
    tbl = conn.open_table("messages")
    assert tbl is not None

def test_singleton_pattern(db_client):
    """Test that DBClient is a singleton."""
    client1 = DBClient()
    client2 = DBClient()
    assert client1 is client2
