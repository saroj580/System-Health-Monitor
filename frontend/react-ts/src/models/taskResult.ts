// models/taskResult.ts
// TypeScript interfaces that mirror backend/app/models/schemas.py task schemas.

export interface TaskDefinition {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export interface TaskResult {
  task_id: string;
  task_label: string;
  status: 'success' | 'error';
  message: string;
  duration_ms: number;
}

export interface TaskLogEntry {
  id: number;
  task_id: string;
  task_label: string;
  status: 'success' | 'error';
  message: string | null;
  duration_ms: number | null;
  user_email?: string | null;
  created_at: string; // ISO-8601 UTC
}

// Possible UI states for a running task card
export type TaskRunState = 'idle' | 'running' | 'success' | 'error';
