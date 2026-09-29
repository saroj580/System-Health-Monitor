"""
models/db_models.py
Raw SQL query helpers for the two database tables.
Keeps all SQL in one place; called by the routes layer.
"""

import sqlite3
from typing import Any

from app.models.schemas import TaskResult, TaskLogEntry


# task_log table 

def insert_task_log(conn: sqlite3.Connection, result: TaskResult) -> int:
    """Insert a task execution record. Returns the new row id."""
    cur = conn.execute(
        """
        INSERT INTO task_log (task_id, task_label, status, message, duration_ms)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            result.task_id,
            result.task_label,
            result.status,
            result.message,
            result.duration_ms,
        ),
    )
    return cur.lastrowid  # type: ignore[return-value]


def fetch_task_logs(conn: sqlite3.Connection, limit: int = 100) -> list[TaskLogEntry]:
    """Return the most recent `limit` task log entries, newest first."""
    rows = conn.execute(
        """
        SELECT id, task_id, task_label, status, message, duration_ms, created_at
        FROM task_log
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()

    return [TaskLogEntry(**dict(row)) for row in rows]


#  system_snapshot table 

def insert_snapshot(conn: sqlite3.Connection, stats: dict[str, Any]) -> None:
    """Persist a periodic hardware snapshot for historical trend charts."""
    conn.execute(
        """
        INSERT INTO system_snapshot
            (cpu_percent, ram_percent, disk_percent, net_sent_mb, net_recv_mb)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            stats["cpu_percent"],
            stats["ram_percent"],
            stats["disk_percent"],
            stats["net_sent_mb"],
            stats["net_recv_mb"],
        ),
    )


def fetch_snapshots(conn: sqlite3.Connection, limit: int = 60) -> list[dict[str, Any]]:
    """Return the most recent `limit` snapshots for trend charts."""
    rows = conn.execute(
        """
        SELECT cpu_percent, ram_percent, disk_percent,
               net_sent_mb, net_recv_mb, created_at
        FROM system_snapshot
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in reversed(rows)]  # chronological order
