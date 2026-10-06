"""
core/config.py
App-wide settings. Works in both dev (source) and PyInstaller frozen (.exe) modes.
"""

import sys
from pathlib import Path


def _get_base_dir() -> Path:
    """
    Return the directory that contains persistent data (DB, logs).
    - In dev:    backend/
    - In .exe:   same folder as the compiled executable
    """
    if getattr(sys, "frozen", False):
        # Running as PyInstaller bundle
        return Path(sys.executable).parent
    # Running from source: two levels up from this file → backend/
    return Path(__file__).resolve().parent.parent.parent


BASE_DIR: Path = _get_base_dir()

#  Serve 
HOST: str = "127.0.0.1"
PORT: int = 8003

# Application metadata 
APP_NAME: str = "System Monitor & Task Automator"
APP_VERSION: str = "1.0.0-PreAlpha"

#  Database 
DB_PATH: Path = BASE_DIR / "system_monitor.db"

#  WebSocket stream interval
WS_INTERVAL_SECONDS: float = 1.0   # push a stats snapshot every second

# Automation task definitions
# Each task has an id, a display label, and a description shown in the UI.
AVAILABLE_TASKS: list[dict] = [
    {
        "id": "clean_temp",
        "label": "Clean Temp Files",
        "description": "Delete files from %TEMP% to free disk space.",
        "icon": "🧹",
    },
    {
        "id": "backup_documents",
        "label": "Backup Documents",
        "description": "Zip the user's Documents folder to the Desktop.",
        "icon": "💾",
    },
    {
        "id": "flush_dns",
        "label": "Flush DNS Cache",
        "description": "Run ipconfig /flushdns to clear the DNS resolver cache.",
        "icon": "🌐",
    },
    {
        "id": "kill_high_cpu",
        "label": "Kill High-CPU Processes",
        "description": "Terminate non-system processes using > 80 % CPU.",
        "icon": "🔪",
    },
]
