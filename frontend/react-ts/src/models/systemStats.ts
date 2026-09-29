// models/systemStats.ts
// TypeScript interfaces that mirror backend/app/models/schemas.py SystemStats.
// Keep in sync with the Pydantic model whenever the backend schema changes.

export interface CpuCoreInfo {
  core: number;
  percent: number;
}

export interface DiskInfo {
  device: string;
  mountpoint: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
}

export interface NetworkInfo {
  sent_mb: number;
  recv_mb: number;
  sent_rate_kbps: number;
  recv_rate_kbps: number;
}

export interface SystemStats {
  cpu_percent: number;
  cpu_cores: CpuCoreInfo[];
  cpu_freq_mhz: number | null;
  cpu_temp_celsius: number | null;

  ram_total_gb: number;
  ram_used_gb: number;
  ram_percent: number;

  disks: DiskInfo[];
  network: NetworkInfo;

  uptime_seconds: number;
  timestamp: string; // ISO-8601 UTC
}

export interface AppInfo {
  name: string;
  version: string;
  host: string;
  port: number;
}

/** Formats uptime_seconds into a human-readable string, e.g. "3d 4h 12m" */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}
