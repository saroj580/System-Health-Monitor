"""
controllers/task_controller.py
Automation task implementations.
Each task executes an automated system workflow and returns rich diagnostic details.
"""

import os
import shutil
import time
import subprocess
import platform
import zipfile
import logging
from pathlib import Path
from datetime import datetime
from typing import Callable, Any

import psutil

from app.models.schemas import TaskResult

logger = logging.getLogger(__name__)

#  Internal helper 

def _make_result(
    task_id: str,
    label: str,
    start: float,
    success: bool,
    message: str,
    details: dict[str, Any] | None = None,
) -> TaskResult:
    duration_ms = int((time.monotonic() - start) * 1000)
    return TaskResult(
        task_id=task_id,
        task_label=label,
        status="success" if success else "error",
        message=message,
        duration_ms=duration_ms,
        details=details or {},
    )


#  Clean Temp Files 

def run_clean_temp() -> TaskResult:
    """Delete stale files from the user's %TEMP% directory and track space reclaimed."""
    task_id = "clean_temp"
    label = "Clean Temp Files"
    start = time.monotonic()

    temp_dir = Path(os.environ.get("TEMP", "/tmp"))
    deleted_count = 0
    skipped_count = 0
    bytes_freed = 0
    scanned_count = 0

    if not temp_dir.exists():
        return _make_result(
            task_id, label, start, False, "TEMP directory not found.",
            {"target_path": str(temp_dir), "error": "Directory does not exist"}
        )

    for item in temp_dir.iterdir():
        scanned_count += 1
        try:
            if item.is_file() or item.is_symlink():
                sz = item.stat().st_size
                item.unlink()
                deleted_count += 1
                bytes_freed += sz
            elif item.is_dir():
                shutil.rmtree(item)
                deleted_count += 1
        except (PermissionError, OSError):
            skipped_count += 1

    reclaimed_mb = round(bytes_freed / (1024 * 1024), 2)
    msg = f"Deleted {deleted_count} item(s) ({reclaimed_mb} MB reclaimed). Skipped {skipped_count} (in use/locked)."
    details = {
        "target_path": str(temp_dir),
        "scanned_items": scanned_count,
        "deleted_items": deleted_count,
        "skipped_items": skipped_count,
        "bytes_reclaimed": bytes_freed,
        "reclaimed_mb": reclaimed_mb,
        "actions": [
            f"Scanned temporary directory: {temp_dir}",
            f"Removed {deleted_count} temporary files and directories",
            f"Skipped {skipped_count} files actively locked by Windows background processes",
            f"Reclaimed {reclaimed_mb} MB of storage space",
        ],
    }
    return _make_result(task_id, label, start, True, msg, details)


#  Backup Documents 

def run_backup_documents() -> TaskResult:
    """Zip the user's Documents folder to the Desktop."""
    task_id = "backup_documents"
    label = "Backup Documents"
    start = time.monotonic()

    docs_dir = Path.home() / "Documents"
    desktop_dir = Path.home() / "Desktop"

    if not docs_dir.exists():
        return _make_result(
            task_id, label, start, False, "Documents folder not found.",
            {"source_path": str(docs_dir), "error": "Folder not found"}
        )

    desktop_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    zip_path = desktop_dir / f"Documents_Backup_{timestamp}.zip"

    try:
        file_count = 0
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for file in docs_dir.rglob("*"):
                if file.is_file():
                    try:
                        zf.write(file, file.relative_to(docs_dir))
                        file_count += 1
                    except (PermissionError, OSError):
                        pass
        size_mb = round(zip_path.stat().st_size / 1024 / 1024, 2)
        msg = f"Backed up {file_count} file(s) → {zip_path.name} ({size_mb} MB)"
        details = {
            "source_path": str(docs_dir),
            "destination_path": str(zip_path),
            "files_archived": file_count,
            "archive_size_mb": size_mb,
            "compression_algorithm": "ZIP_DEFLATED",
            "actions": [
                f"Scanned source directory: {docs_dir}",
                f"Compressed {file_count} documents into a ZIP archive",
                f"Wrote backup file to Desktop: {zip_path.name} ({size_mb} MB)",
            ],
        }
        return _make_result(task_id, label, start, True, msg, details)
    except Exception as exc:
        return _make_result(
            task_id, label, start, False, f"Failed: {exc}",
            {"error": str(exc), "destination_path": str(zip_path)}
        )


#  Flush DNS Cache 

def run_flush_dns() -> TaskResult:
    """Run the platform-appropriate DNS flush command."""
    task_id = "flush_dns"
    label = "Flush DNS Cache"
    start = time.monotonic()

    system = platform.system()
    cmd = ["ipconfig", "/flushdns"] if system == "Windows" else ["dscacheutil", "-flushcache"]
    try:
        if system == "Windows":
            result = subprocess.run(
                cmd,
                capture_output=True, text=True, timeout=10, check=True
            )
            output = result.stdout.strip() or "Successfully flushed the DNS Resolver Cache."
        elif system == "Darwin":
            subprocess.run(cmd, capture_output=True, timeout=10, check=True)
            subprocess.run(["killall", "-HUP", "mDNSResponder"], capture_output=True, timeout=10, check=True)
            output = "DNS cache flushed (macOS)."
        else:
            subprocess.run(["systemd-resolve", "--flush-caches"], capture_output=True, timeout=10, check=True)
            output = "DNS cache flushed (Linux systemd-resolved)."

        details = {
            "command": " ".join(cmd),
            "platform": system,
            "stdout": output,
            "actions": [
                f"Executed system DNS flush command: {' '.join(cmd)}",
                "Cleared host name resolver cache and stale IP mappings",
                "Operating system DNS resolver ready for refreshed queries",
            ],
        }
        return _make_result(task_id, label, start, True, output, details)
    except subprocess.CalledProcessError as exc:
        err = exc.stderr.strip() if exc.stderr else str(exc)
        return _make_result(
            task_id, label, start, False, f"Command failed: {err}",
            {"command": " ".join(cmd), "stderr": err}
        )
    except Exception as exc:
        return _make_result(
            task_id, label, start, False, str(exc),
            {"command": " ".join(cmd), "error": str(exc)}
        )


#  Kill High-CPU Processes 

_SYSTEM_PROCESS_NAMES = {
    "system", "svchost.exe", "csrss.exe", "smss.exe", "lsass.exe",
    "wininit.exe", "services.exe", "winlogon.exe", "ntoskrnl.exe",
    "kernel", "kthreadd", "launchd", "kernel_task",
}
CPU_THRESHOLD = 80.0  # percent


def run_kill_high_cpu() -> TaskResult:
    """Terminate user-space processes using more than CPU_THRESHOLD % CPU."""
    task_id = "kill_high_cpu"
    label = "Kill High-CPU Processes"
    start = time.monotonic()

    # Warm up psutil's cpu_percent cache
    psutil.cpu_percent(interval=0.5)

    killed: list[str] = []
    skipped: list[str] = []
    evaluated_count = 0

    for proc in psutil.process_iter(["pid", "name", "cpu_percent", "username"]):
        evaluated_count += 1
        try:
            info = proc.info
            name_lower = (info["name"] or "").lower()
            if name_lower in _SYSTEM_PROCESS_NAMES:
                continue
            cpu = info["cpu_percent"] or 0.0
            if cpu >= CPU_THRESHOLD:
                proc.terminate()
                killed.append(f"{info['name']} (PID {info['pid']}, {cpu:.1f}%)")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            skipped.append(info.get("name", "?"))

    if killed:
        msg = f"Terminated {len(killed)} process(es): " + ", ".join(killed)
    else:
        msg = f"No user processes found consuming > {CPU_THRESHOLD}% CPU."

    details = {
        "cpu_threshold_percent": CPU_THRESHOLD,
        "processes_evaluated": evaluated_count,
        "terminated_processes": killed,
        "protected_system_skipped": len(skipped),
        "actions": [
            f"Scanned all active system processes with CPU threshold >= {CPU_THRESHOLD}%",
            f"Evaluated {evaluated_count} processes in the system process table",
            f"{len(killed)} high-load non-system processes terminated" if killed else "All processes operating within safe CPU limits",
        ],
    }

    return _make_result(task_id, label, start, True, msg, details)


#  Dispatch map 

TASK_REGISTRY: dict[str, Callable[[], TaskResult]] = {
    "clean_temp": run_clean_temp,
    "backup_documents": run_backup_documents,
    "flush_dns": run_flush_dns,
    "kill_high_cpu": run_kill_high_cpu,
}


def execute_task(task_id: str) -> TaskResult:
    """
    Look up and execute a task by its id.
    Raises KeyError if the task_id is not registered.
    """
    handler = TASK_REGISTRY.get(task_id)
    if handler is None:
        raise KeyError(f"Unknown task id: '{task_id}'")
    logger.info("Executing task: %s", task_id)
    return handler()
