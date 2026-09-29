"""
views/routes.py
FastAPI router: declares all HTTP and WebSocket endpoints.
Pure presentation layer — no business logic lives here.
"""

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.core.config import APP_NAME, APP_VERSION, HOST, PORT, AVAILABLE_TASKS
from app.core.database import get_db
from app.models.schemas import (
    AppInfo,
    SystemStats,
    TaskDefinition,
    TaskResult,
    TaskLogEntry,
)
from app.models.db_models import insert_task_log, fetch_task_logs, fetch_snapshots
from app.controllers.stats_controller import get_system_stats
from app.controllers.task_controller import execute_task

logger = logging.getLogger(__name__)
router = APIRouter()


# Health / Info

@router.get("/api/info", response_model=AppInfo, tags=["Meta"])
def get_info() -> AppInfo:
    """Return application metadata — used by the UI header."""
    return AppInfo(name=APP_NAME, version=APP_VERSION, host=HOST, port=PORT)


# System Stats

@router.get("/api/stats", response_model=SystemStats, tags=["Stats"])
def get_stats() -> SystemStats:
    """Return a single live hardware telemetry snapshot."""
    return get_system_stats()


@router.get("/api/stats/history", tags=["Stats"])
def get_stats_history(limit: int = 60) -> list[dict[str, Any]]:
    """Return up to `limit` historical snapshots for trend charts."""
    with get_db() as db:
        return fetch_snapshots(db, limit=min(limit, 500))


#Tasks

@router.get("/api/tasks", response_model=list[TaskDefinition], tags=["Tasks"])
def list_tasks() -> list[TaskDefinition]:
    """Return all available automation tasks."""
    return [TaskDefinition(**t) for t in AVAILABLE_TASKS]


@router.post("/api/tasks/{task_id}", response_model=TaskResult, tags=["Tasks"])
def run_task(task_id: str) -> TaskResult:
    """
    Execute the named task synchronously and persist the result to the audit log.
    Returns 404 if the task_id is not registered.
    """
    try:
        result = execute_task(task_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    except Exception as exc:
        logger.exception("Unexpected error running task '%s'", task_id)
        raise HTTPException(status_code=500, detail=str(exc))

    with get_db() as db:
        insert_task_log(db, result)

    return result


#  Activity Log

@router.get("/api/logs", response_model=list[TaskLogEntry], tags=["Logs"])
def get_logs(limit: int = 100) -> list[TaskLogEntry]:
    """Return the most recent task execution logs, newest first."""
    with get_db() as db:
        return fetch_task_logs(db, limit=min(limit, 500))


# WebSocket — Live Stats Stream 

@router.websocket("/ws/stats")
async def websocket_stats(ws: WebSocket) -> None:
    """
    Push a SystemStats JSON payload every second.
    The client keeps this connection open for the lifetime of the dashboard.
    """
    await ws.accept()
    logger.info("WebSocket client connected: %s", ws.client)
    try:
        while True:
            stats = get_system_stats()
            await ws.send_text(stats.model_dump_json())
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected: %s", ws.client)
    except Exception as exc:
        logger.warning("WebSocket error: %s", exc)
        await ws.close()
