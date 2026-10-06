// services/apiService.ts
// Typed REST client for every HTTP endpoint exposed by the FastAPI backend.

import type { AppInfo, SystemStats } from '../models/systemStats';
import type { TaskDefinition, TaskResult, TaskLogEntry } from '../models/taskResult';

const BASE_URL = 'http://127.0.0.1:8003';

// Generic fetch wrapper with typed response
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

// App metadata
export const fetchAppInfo = (): Promise<AppInfo> =>
  request<AppInfo>('/api/info');

// Single hardware snapshot (used on initial mount before WS connects)
export const fetchStats = (): Promise<SystemStats> =>
  request<SystemStats>('/api/stats');

// Historical snapshots for trend charts (last N minutes)
export const fetchStatsHistory = (limit = 60): Promise<Record<string, number>[]> =>
  request<Record<string, number>[]>(`/api/stats/history?limit=${limit}`);

// All available automation tasks
export const fetchTasks = (): Promise<TaskDefinition[]> =>
  request<TaskDefinition[]>('/api/tasks');

// Execute a task by id — returns the result immediately (runs synchronously)
export const runTask = (taskId: string): Promise<TaskResult> =>
  request<TaskResult>(`/api/tasks/${taskId}`, { method: 'POST' });

// Audit log entries, newest first
export const fetchLogs = (limit = 100): Promise<TaskLogEntry[]> =>
  request<TaskLogEntry[]>(`/api/logs?limit=${limit}`);
