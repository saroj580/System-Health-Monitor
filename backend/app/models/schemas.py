"""
models/schemas.py
Pydantic v2 schemas — the data contracts between backend layers and the API surface.
"""

from pydantic import BaseModel, Field
from typing import Optional


# System Stats 

class DiskInfo(BaseModel):
    """Per-partition disk usage."""
    device: str
    mountpoint: str
    total_gb: float = Field(..., description="Total size in GiB")
    used_gb: float
    free_gb: float
    percent: float


class NetworkInfo(BaseModel):
    """Cumulative network I/O since boot (converted to MiB)."""
    sent_mb: float = Field(..., description="Total bytes sent in MiB")
    recv_mb: float = Field(..., description="Total bytes received in MiB")
    sent_rate_kbps: float = Field(0.0, description="Current send rate in KB/s")
    recv_rate_kbps: float = Field(0.0, description="Current receive rate in KB/s")


class CpuCoreInfo(BaseModel):
    """Per-logical-core utilization."""
    core: int
    percent: float


class SystemStats(BaseModel):
    """
    Full hardware telemetry snapshot.
    Sent via both the REST endpoint and the WebSocket stream.
    """
    cpu_percent: float = Field(..., ge=0, le=100)
    cpu_cores: list[CpuCoreInfo]
    cpu_freq_mhz: Optional[float] = None
    cpu_temp_celsius: Optional[float] = Field(None, description="None if sensor unavailable")

    ram_total_gb: float
    ram_used_gb: float
    ram_percent: float = Field(..., ge=0, le=100)

    disks: list[DiskInfo]
    network: NetworkInfo

    uptime_seconds: int
    timestamp: str = Field(..., description="ISO-8601 UTC timestamp")


# Task Definitions & Results

class TaskDefinition(BaseModel):
    """Describes an available automation task (used in GET /api/tasks)."""
    id: str
    label: str
    description: str
    icon: str


class TaskRunRequest(BaseModel):
    """Optional payload for POST /api/tasks/{task_id}."""
    params: dict = Field(default_factory=dict, description="Optional task parameters")


class TaskResult(BaseModel):
    """Returned after a task execution."""
    task_id: str
    task_label: str
    status: str = Field(..., pattern="^(success|error)$")
    message: str
    duration_ms: int


# Audit Log

class TaskLogEntry(BaseModel):
    """A single row from the task_log table."""
    id: int
    task_id: str
    task_label: str
    status: str
    message: Optional[str]
    duration_ms: Optional[int]
    user_email: Optional[str] = None
    created_at: str


# App Info

class AppInfo(BaseModel):
    """Returned by GET /api/info."""
    name: str
    version: str
    host: str
    port: int


# License Verification & Trial Mode

class LicenseActivateRequest(BaseModel):
    """Payload for POST /api/license/activate (Model 1: RSA License Key)."""
    token: str = Field(..., description="The JWT license key provided by the developer.")


class TrialActivateRequest(BaseModel):
    """Payload for POST /api/license/trial (Model 2: In-app 7-day free trial)."""
    name: str = Field(..., min_length=1, max_length=100, description="User's display name")
    email: str = Field(..., min_length=3, max_length=100, description="User's email address")


class LicenseStatusResponse(BaseModel):
    """Returned by GET /api/license/status, POST /api/license/activate, and POST /api/license/trial."""
    is_valid: bool
    message: str
    is_trial: bool = False
    trial_available: bool = True
    days_left: Optional[int] = None
    licensee_name: Optional[str] = None
    licensee_email: Optional[str] = None
    expires_at: Optional[str] = None
