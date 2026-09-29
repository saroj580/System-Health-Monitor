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

            -- Audit log: one row per task execution (isolated by user_email)
            CREATE TABLE IF NOT EXISTS task_log (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id     TEXT    NOT NULL,
                task_label  TEXT    NOT NULL,
                status      TEXT    NOT NULL CHECK (status IN ('success', 'error')),
                message     TEXT,
                duration_ms INTEGER,
                user_email  TEXT    NOT NULL DEFAULT '',
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

            -- License: single-row table (id=1 always via UPSERT)
            -- Stores the validated JWT token (or local trial) and its metadata.
            CREATE TABLE IF NOT EXISTS license (
                id              INTEGER PRIMARY KEY CHECK (id = 1),
                token           TEXT    NOT NULL,
                licensee_name   TEXT    NOT NULL DEFAULT '',
                licensee_email  TEXT    NOT NULL DEFAULT '',
                expires_at      TEXT    NOT NULL,
                is_trial        INTEGER NOT NULL DEFAULT 0,
                trial_used      INTEGER NOT NULL DEFAULT 0,
                activated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            """
        )

        # Migration: ensure user_email column exists on task_log if table was already created
        task_cols = [row[1] for row in conn.execute("PRAGMA table_info(task_log)").fetchall()]
        if "user_email" not in task_cols:
            conn.execute("ALTER TABLE task_log ADD COLUMN user_email TEXT NOT NULL DEFAULT ''")
            logger.info("Migrated task_log table: added user_email column.")

        # Migration: ensure is_trial & trial_used columns exist on license table
        lic_cols = [row[1] for row in conn.execute("PRAGMA table_info(license)").fetchall()]
        if "is_trial" not in lic_cols:
            conn.execute("ALTER TABLE license ADD COLUMN is_trial INTEGER NOT NULL DEFAULT 0")
            logger.info("Migrated license table: added is_trial column.")
        if "trial_used" not in lic_cols:
            conn.execute("ALTER TABLE license ADD COLUMN trial_used INTEGER NOT NULL DEFAULT 0")
            logger.info("Migrated license table: added trial_used column.")
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
