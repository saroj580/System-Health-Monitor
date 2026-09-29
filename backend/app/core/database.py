"""
core/database.py
SQLite connection pool and schema initializer.
Uses Python's built-in sqlite3 — no extra dependencies needed.
"""

import sqlite3
import logging
from contextlib import contextmanager
from typing import Generator

from app.core.config import DB_PATH

logger = logging.getLogger(__name__)


def init_db() -> None:
    """
    Create all tables if they do not exist.
    Called once at application startup from main.py.
    """
    logger.info("Initializing database at: %s", DB_PATH)
    with _get_connection() as conn:
        conn.executescript(
            """
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            -- Audit log: one row per task execution
            CREATE TABLE IF NOT EXISTS task_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id     TEXT    NOT NULL,
                task_label  TEXT    NOT NULL,
                status      TEXT    NOT NULL CHECK (status IN ('success', 'error')),
                message     TEXT,
                duration_ms INTEGER,
                created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );

            -- Historical system snapshots (written every 60 s for trend charts)
            CREATE TABLE IF NOT EXISTS system_snapshot (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                cpu_percent  REAL    NOT NULL,
                ram_percent  REAL    NOT NULL,
                disk_percent REAL    NOT NULL,
                net_sent_mb  REAL    NOT NULL,
                net_recv_mb  REAL    NOT NULL,
                created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            """
        )
    logger.info("Database ready.")


def _get_connection() -> sqlite3.Connection:
    """
    Open a raw connection to the SQLite database.
    Row factory is set so rows behave like dicts.
    """
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """
    Context manager that yields a connection and auto-commits/rolls back.

    Usage:
        with get_db() as db:
            db.execute("SELECT ...")
    """
    conn = _get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
