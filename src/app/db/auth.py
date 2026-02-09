import sqlite3
import time
from pathlib import Path

import structlog

from src.app.core.config import settings

logger = structlog.get_logger()


class AuthDB:
    def __init__(self):
        self.db_path = Path(settings.AUTH_DB_PATH)
        self._ensure_db_dir()

    def _ensure_db_dir(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

    def _get_conn(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self.db_path))

    def initialize(self):
        """Create auth tables if they don't exist."""
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS system_auth (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    password_hash TEXT,
                    token_valid_after REAL,
                    jwt_secret TEXT
                )
            """)
            conn.commit()

    def get_auth_data(self) -> tuple[str, float, str] | None:
        """Return (password_hash, token_valid_after, jwt_secret)."""
        with self._get_conn() as conn:
            cursor = conn.execute("SELECT password_hash, token_valid_after, jwt_secret FROM system_auth WHERE id = 1")
            return cursor.fetchone()

    def update_password(self, password_hash: str, valid_after: float = None):
        """Update system password and invalidate old tokens."""
        if valid_after is None:
            valid_after = time.time()

        with self._get_conn() as conn:
            # Upsert logic for single row
            conn.execute(
                """
                INSERT INTO system_auth (id, password_hash, token_valid_after)
                VALUES (1, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    password_hash = excluded.password_hash,
                    token_valid_after = excluded.token_valid_after
            """,
                (password_hash, valid_after),
            )
            conn.commit()

    def set_secret(self, secret: str):
        """Store the persistent JWT secret."""
        with self._get_conn() as conn:
            conn.execute(
                """
                INSERT INTO system_auth (id, jwt_secret)
                VALUES (1, ?)
                ON CONFLICT(id) DO UPDATE SET
                    jwt_secret = excluded.jwt_secret
            """,
                (secret,),
            )
            conn.commit()
