// controllers/useTaskRunner.ts
// Custom hook that:
//   1. Loads the list of available tasks on mount
//   2. Exposes a `run(taskId)` function that fires POST /api/tasks/{id}
//   3. Tracks per-task run state so each TaskCard can show its own spinner/badge
//   4. Appends the result to a local log (mirrors the DB log without a fetch round-trip)

import { useState, useEffect, useCallback } from 'react';
import type { TaskDefinition, TaskResult, TaskLogEntry, TaskRunState } from '../models/taskResult';
import { fetchTasks, runTask, fetchLogs } from '../services/apiService';

export interface UseTaskRunnerResult {
  tasks: TaskDefinition[];
  // Per-task run state map: taskId → current state
  runStates: Record<string, TaskRunState>;
  // Per-task last result map: taskId → last TaskResult
  lastResults: Record<string, TaskResult | null>;
  // Recent audit log (newest first, kept in sync after each execution)
  logs: TaskLogEntry[];
  // Trigger a task — resolves when complete
  run: (taskId: string) => Promise<void>;
  isLoadingTasks: boolean;
}

export function useTaskRunner(): UseTaskRunnerResult {
  const [tasks, setTasks] = useState<TaskDefinition[]>([]);
  const [runStates, setRunStates] = useState<Record<string, TaskRunState>>({});
  const [lastResults, setLastResults] = useState<Record<string, TaskResult | null>>({});
  const [logs, setLogs] = useState<TaskLogEntry[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  // Load task list and recent audit log on mount
  useEffect(() => {
    fetchTasks()
      .then((defs) => {
        setTasks(defs);
        // Initialise run states to 'idle' for each task
        setRunStates(Object.fromEntries(defs.map((t) => [t.id, 'idle'])));
        setLastResults(Object.fromEntries(defs.map((t) => [t.id, null])));
      })
      .catch(console.error)
      .finally(() => setIsLoadingTasks(false));

    fetchLogs(50)
      .then(setLogs)
      .catch(console.error);
  }, []);

  const run = useCallback(async (taskId: string) => {
    // Mark as running
    setRunStates((prev) => ({ ...prev, [taskId]: 'running' }));

    try {
      const result = await runTask(taskId);

      // Update state
      setRunStates((prev) => ({ ...prev, [taskId]: result.status }));
      setLastResults((prev) => ({ ...prev, [taskId]: result }));

      // Prepend synthetic log entry so the table updates instantly (no extra fetch)
      const entry: TaskLogEntry = {
        id: Date.now(),             // temporary client-side id
        task_id: result.task_id,
        task_label: result.task_label,
        status: result.status,
        message: result.message,
        duration_ms: result.duration_ms,
        created_at: new Date().toISOString(),
      };
      setLogs((prev) => [entry, ...prev].slice(0, 100));

    } catch (err) {
      setRunStates((prev) => ({ ...prev, [taskId]: 'error' }));
      setLastResults((prev) => ({
        ...prev,
        [taskId]: {
          task_id: taskId,
          task_label: taskId,
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
          duration_ms: 0,
        },
      }));
    } finally {
      // Auto-reset card state to idle after 4 seconds
      setTimeout(() => {
        setRunStates((prev) => ({ ...prev, [taskId]: 'idle' }));
      }, 4000);
    }
  }, []);

  return { tasks, runStates, lastResults, logs, run, isLoadingTasks };
}
