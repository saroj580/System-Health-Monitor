"""
views/routes.py
FastAPI router: declares all HTTP REST endpoints.
Note: WebSocket route is registered directly on the app in main.py
because APIRouter does not support @router.websocket().
"""

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from app.core.config import APP_NAME, APP_VERSION, HOST, PORT, AVAILABLE_TASKS
from app.core.database import get_db
from app.models.schemas import (
    AppInfo,
    SystemStats,
    TaskDefinition,
    TaskResult,
    TaskLogEntry,
    LicenseActivateRequest,
    TrialActivateRequest,
    LicenseStatusResponse,
)
from app.models.db_models import insert_task_log, fetch_task_logs, fetch_snapshots
from app.controllers.stats_controller import get_system_stats
from app.controllers.task_controller import execute_task
from app.controllers.license_controller import (
    LicenseError,
    verify_token,
    save_license,
    load_license,
    is_license_valid,
    start_trial,
    is_trial_available,
    calculate_days_left,
)

logger = logging.getLogger(__name__)
router = APIRouter()


#  License guard dependency 

def require_valid_license() -> dict[str, Any]:
    """
    FastAPI dependency injected into all operational routes.
    Raises HTTP 403 if no valid, unexpired license exists in the DB.
    Returns the active license record (including licensee_email).
    """
    with get_db() as db:
        valid, reason = is_license_valid(db)
        if not valid:
            raise HTTPException(
                status_code=403,
                detail=f"Unlicensed: {reason}",
            )
        row = load_license(db)
        return dict(row) if row else {}


#  Health / Info 

@router.get("/api/info", response_model=AppInfo, tags=["Meta"])
def get_info() -> AppInfo:
    """Return application metadata — used by the UI header."""
    return AppInfo(name=APP_NAME, version=APP_VERSION, host=HOST, port=PORT)


#  License & Trial Endpoints 

@router.get(
    "/api/license/status",
    response_model=LicenseStatusResponse,
    tags=["License"],
)
def get_license_status() -> LicenseStatusResponse:
    """
    Check whether a valid license or active trial is stored in the local DB.
    Called by the React UI on startup to decide whether to show
    the Activation screen or the Dashboard.
    """
    with get_db() as db:
        valid, reason = is_license_valid(db)
        row = load_license(db)
        trial_available = is_trial_available(db)

    if row:
        is_trial = bool(row.get("is_trial", 0))
        days_left = calculate_days_left(row.get("expires_at")) if is_trial else None
        return LicenseStatusResponse(
            is_valid=valid,
            message="License active." if valid else reason,
            is_trial=is_trial,
            trial_available=trial_available,
            days_left=days_left,
            licensee_name=row.get("licensee_name"),
            licensee_email=row.get("licensee_email"),
            expires_at=row.get("expires_at"),
        )

    return LicenseStatusResponse(
        is_valid=False,
        message=reason,
        is_trial=False,
        trial_available=trial_available,
    )


@router.post(
    "/api/license/trial",
    response_model=LicenseStatusResponse,
    tags=["License"],
)
def activate_trial(body: TrialActivateRequest) -> LicenseStatusResponse:
    """
    Model 2: Start an in-app 7-day free trial.
    Requires no developer interaction; stores a 7-day expiration locally.
    Enforces that trial can only be used once per installation.
    """
    with get_db() as db:
        try:
            row = start_trial(db, body.name, body.email)
        except LicenseError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

    days_left = calculate_days_left(row.get("expires_at"))
    logger.info("7-day free trial started for: %s <%s>", body.name, body.email)

    return LicenseStatusResponse(
        is_valid=True,
        message="7-day free trial started successfully.",
        is_trial=True,
        trial_available=False,
        days_left=days_left,
        licensee_name=row.get("licensee_name"),
        licensee_email=row.get("licensee_email"),
        expires_at=row.get("expires_at"),
    )


@router.post(
    "/api/license/activate",
    response_model=LicenseStatusResponse,
    tags=["License"],
)
def activate_license(body: LicenseActivateRequest) -> LicenseStatusResponse:
    """
    Model 1: Accept a developer-signed JWT license key from the user.
    Verifies the RSA signature, checks expiry, and saves to the DB.
    Upgrades from trial to full license immediately.
    """
    try:
        payload = verify_token(body.token)
    except LicenseError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    with get_db() as db:
        save_license(db, body.token, payload)
        row = load_license(db)

    logger.info(
        "Full license activated for: %s <%s>",
        payload.get("name", ""),
        payload.get("sub", ""),
    )
    return LicenseStatusResponse(
        is_valid=True,
        message="Full license activated successfully.",
        is_trial=False,
        trial_available=False,
        licensee_name=row["licensee_name"] if row else None,
        licensee_email=row["licensee_email"] if row else None,
        expires_at=row["expires_at"] if row else None,
    )


#  System Stats  (license-guarded) 

@router.get(
    "/api/stats",
    response_model=SystemStats,
    tags=["Stats"],
    dependencies=[Depends(require_valid_license)],
)
def get_stats() -> SystemStats:
    """Return a single live hardware telemetry snapshot."""
    return get_system_stats()


@router.get(
    "/api/stats/history",
    tags=["Stats"],
    dependencies=[Depends(require_valid_license)],
)
def get_stats_history(limit: int = 60) -> list[dict[str, Any]]:
    """Return up to `limit` historical snapshots for trend charts."""
    with get_db() as db:
        return fetch_snapshots(db, limit=min(limit, 500))


#  Tasks  (license-guarded) 

@router.get(
    "/api/tasks",
    response_model=list[TaskDefinition],
    tags=["Tasks"],
    dependencies=[Depends(require_valid_license)],
)
def list_tasks() -> list[TaskDefinition]:
    """Return all available automation tasks."""
    return [TaskDefinition(**t) for t in AVAILABLE_TASKS]


@router.post(
    "/api/tasks/{task_id}",
    response_model=TaskResult,
    tags=["Tasks"],
)
def run_task(
    task_id: str,
    license_info: dict[str, Any] = Depends(require_valid_license),
) -> TaskResult:
    """
    Execute the named task synchronously and persist the result to the audit log
    associated with the active licensed user.
    Returns 404 if the task_id is not registered.
    """
    try:
        result = execute_task(task_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found.")
    except Exception as exc:
        logger.exception("Unexpected error running task '%s'", task_id)
        raise HTTPException(status_code=500, detail=str(exc))

    user_email = license_info.get("licensee_email", "")
    with get_db() as db:
        insert_task_log(db, result, user_email=user_email)

    return result


#  Activity Log  (license-guarded & user-isolated) 

@router.get(
    "/api/logs",
    response_model=list[TaskLogEntry],
    tags=["Logs"],
)
def get_logs(
    limit: int = 100,
    license_info: dict[str, Any] = Depends(require_valid_license),
) -> list[TaskLogEntry]:
    """
    Return the most recent task execution logs belonging to the active licensed user,
    newest first.
    """
    user_email = license_info.get("licensee_email", "")
    with get_db() as db:
        return fetch_task_logs(db, user_email=user_email, limit=min(limit, 500))


#  WebSocket handler 
# Registered on app directly in main.py (APIRouter does not support @router.websocket)

async def websocket_stats(ws: WebSocket) -> None:
    """
    Push a SystemStats JSON payload every second.
    Closes with 4003 (policy violation) if no valid license is found.
    """
    await ws.accept()

    # License check on connection
    with get_db() as db:
        valid, reason = is_license_valid(db)
    if not valid:
        await ws.close(code=4003, reason=reason)
        return

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
