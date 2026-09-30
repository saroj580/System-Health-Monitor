"""
controllers/stats_controller.py
Reads live hardware telemetry via psutil and returns a SystemStats snapshot.
"""

import time
import datetime
import platform
import psutil
from typing import Any, Optional

from app.models.schemas import SystemStats, DiskInfo, NetworkInfo, CpuCoreInfo

# Network rate tracking (bytes/s)
_prev_net_io: Optional[Any] = None
_prev_net_time: float = time.monotonic()


def _get_network_info() -> NetworkInfo:
    """Calculate cumulative totals and instantaneous KB/s rates."""
    global _prev_net_io, _prev_net_time

    current = psutil.net_io_counters()
    now = time.monotonic()
    elapsed = now - _prev_net_time

    sent_rate = recv_rate = 0.0
    if _prev_net_io is not None and elapsed > 0:
        sent_rate = (current.bytes_sent - _prev_net_io.bytes_sent) / elapsed / 1024
        recv_rate = (current.bytes_recv - _prev_net_io.bytes_recv) / elapsed / 1024

    _prev_net_io = current
    _prev_net_time = now

    return NetworkInfo(
        sent_mb=round(current.bytes_sent / 1024 / 1024, 2),
        recv_mb=round(current.bytes_recv / 1024 / 1024, 2),
        sent_rate_kbps=round(max(sent_rate, 0), 2),
        recv_rate_kbps=round(max(recv_rate, 0), 2),
    )


def _get_disk_info() -> list[DiskInfo]:
    """Return usage for all physical, non-virtual partitions."""
    disks: list[DiskInfo] = []
    for part in psutil.disk_partitions(all=False):
        # Skip pseudo-filesystems (devtmpfs, squashfs, etc.)
        if not part.device:
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
        except PermissionError:
            continue
        disks.append(
            DiskInfo(
                device=part.device,
                mountpoint=part.mountpoint,
                total_gb=round(usage.total / 1024 ** 3, 2),
                used_gb=round(usage.used / 1024 ** 3, 2),
                free_gb=round(usage.free / 1024 ** 3, 2),
                percent=usage.percent,
            )
        )
    return disks


def _get_cpu_temp() -> Optional[float]:
    """
    Attempt to read CPU temperature.
    Returns None if the sensor is unavailable (common on Windows without
    third-party drivers; always available on Linux/macOS).
    """
    try:
        temps = psutil.sensors_temperatures()  # type: ignore[attr-defined]
        if not temps:
            return None
        # Try common sensor keys in priority order
        for key in ("coretemp", "k10temp", "cpu_thermal", "cpu-thermal"):
            if key in temps:
                entries = temps[key]
                if entries:
                    return round(entries[0].current, 1)
    except (AttributeError, NotImplementedError):
        pass
    return None


def calculate_system_health(cpu_pct: float, ram_pct: float, disk_pct: float) -> tuple[float, str, str]:
    """
    Calculate an overall system health score from 0.0 to 100.0%.
    Inverse weighted composite penalty based on CPU (40%), RAM (35%), and Disk (25%).
    """
    stress = (0.40 * cpu_pct) + (0.35 * ram_pct) + (0.25 * disk_pct)
    health = max(0.0, min(100.0, 100.0 - stress))
    health_rounded = round(health, 1)

    if health_rounded >= 85.0:
        status = "Optimal"
        insight = "All subsystems operating at peak efficiency."
    elif health_rounded >= 70.0:
        status = "Good"
        insight = "System running smoothly within normal operating parameters."
    elif health_rounded >= 50.0:
        status = "Moderate"
        if ram_pct > 75.0:
            insight = "High memory load detected. Consider closing idle apps."
        elif cpu_pct > 70.0:
            insight = "Elevated CPU usage detected. Background tasks active."
        else:
            insight = "Moderate system load. Run cleanup tasks to optimize performance."
    else:
        status = "Critical"
        if disk_pct > 90.0:
            insight = "Critical disk capacity warning. Low storage space."
        elif ram_pct > 90.0:
            insight = "Severe RAM exhaustion. Virtual memory paging active."
        else:
            insight = "High system stress. Run automation cleanups immediately."

    return health_rounded, status, insight


def get_system_stats() -> SystemStats:
    """
    Collect a full hardware snapshot and return a validated SystemStats object.
    This is the single source of truth for both the REST endpoint and WS stream.
    """
    # CPU — interval=None gives non-blocking read (uses last cached value)
    cpu_percent = psutil.cpu_percent(interval=None)
    per_core = [
        CpuCoreInfo(core=i, percent=p)
        for i, p in enumerate(psutil.cpu_percent(percpu=True, interval=None))
    ]

    cpu_freq = psutil.cpu_freq()
    cpu_freq_mhz = round(cpu_freq.current, 1) if cpu_freq else None

    # RAM
    vm = psutil.virtual_memory()

    # Disk (pick primary disk percent for DB snapshot convenience)
    disks = _get_disk_info()
    primary_disk_pct = disks[0].percent if disks else 0.0

    # Network
    network = _get_network_info()

    # Uptime
    uptime_seconds = int(time.time() - psutil.boot_time())

    # Overall Health Score (0-100%)
    health_pct, health_status, health_insight = calculate_system_health(
        cpu_percent, vm.percent, primary_disk_pct
    )

    return SystemStats(
        cpu_percent=cpu_percent,
        cpu_cores=per_core,
        cpu_freq_mhz=cpu_freq_mhz,
        cpu_temp_celsius=_get_cpu_temp(),
        ram_total_gb=round(vm.total / 1024 ** 3, 2),
        ram_used_gb=round(vm.used / 1024 ** 3, 2),
        ram_percent=vm.percent,
        disks=disks,
        network=network,
        uptime_seconds=uptime_seconds,
        health_percent=health_pct,
        health_status=health_status,
        health_insight=health_insight,
        timestamp=datetime.datetime.utcnow().isoformat() + "Z",
    )
