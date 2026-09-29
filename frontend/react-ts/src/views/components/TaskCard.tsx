// views/components/TaskCard.tsx
// One-click automation card: shows icon, label, description,
// and a button that transitions through idle → running → success/error states.

import React from 'react';
import type { TaskDefinition, TaskResult, TaskRunState } from '../../models/taskResult';

interface TaskCardProps {
  task: TaskDefinition;
  state: TaskRunState;
  lastResult: TaskResult | null;
  onRun: (taskId: string) => void;
}

const StateIcon: React.FC<{ state: TaskRunState }> = ({ state }) => {
  if (state === 'running') {
    return (
      <svg className="w-3.5 h-3.5 flex-shrink-0 animate-spin-ring text-cpu" viewBox="0 0 24 24" fill="none" aria-label="Running">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray="40" strokeDashoffset="20" />
      </svg>
    );
  }
  if (state === 'success') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-green-400" aria-label="Success">
        <path d="M5 12l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === 'error') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" aria-label="Error">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true">
      <path d="M8 5.14v14.72a1 1 0 001.51.86l11-7.36a1 1 0 000-1.72l-11-7.36A1 1 0 008 5.14z" />
    </svg>
  );
};

// State-based border/shadow overrides
const cardStateClass: Record<TaskRunState, string> = {
  idle:    '',
  running: 'border-cpu/30',
  success: 'border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.08)]',
  error:   'border-rose-500/30  shadow-[0_0_20px_rgba(244,63,94,0.08)]',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, state, lastResult, onRun }) => {
  const isRunning = state === 'running';

  return (
    <div
      className={`glass flex flex-col gap-3 p-5 animate-fade-in transition-shadow duration-[180ms] hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)] ${cardStateClass[state]}`}
      style={{ animationDelay: '0.05s' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[1.6rem] leading-none" aria-hidden="true">{task.icon}</span>
        <span className={`badge badge--${state}`}>
          {state === 'idle' ? 'Ready' : state === 'running' ? 'Running…' : state}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1">
        <h3 className="text-[0.95rem] font-semibold text-slate-100 mb-1">{task.label}</h3>
        <p className="text-[0.78rem] text-slate-400 leading-relaxed">{task.description}</p>
      </div>

      {/* Inline result message */}
      {lastResult && state !== 'idle' && state !== 'running' && (
        <p className={`text-[0.72rem] leading-snug px-2.5 py-2 rounded font-mono break-words ${
          lastResult.status === 'success'
            ? 'bg-green-500/10 text-green-400'
            : 'bg-rose-500/10 text-rose-400'
        }`}>
          {lastResult.message}
        </p>
      )}

      {/* Run button */}
      <button
        id={`run-task-${task.id}`}
        className="flex items-center justify-center gap-1.5 w-full px-4 py-2 rounded border border-white/[.14] bg-white/[.04] text-slate-200 font-sans text-[0.8rem] font-medium cursor-pointer transition-all duration-[180ms] hover:not-disabled:bg-cpu/10 hover:not-disabled:border-cpu/40 hover:not-disabled:text-cpu disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => onRun(task.id)}
        disabled={isRunning}
        aria-label={`Run ${task.label}`}
        aria-busy={isRunning}
      >
        <StateIcon state={state} />
        <span>{isRunning ? 'Running…' : 'Run Task'}</span>
      </button>
    </div>
  );
};
