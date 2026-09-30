// views/components/ActivityLogTable.tsx
// Displays the task execution audit log. Clicking any row opens the forensic detail inspector modal.

import React, { useState } from 'react';
import type { TaskLogEntry } from '../../models/taskResult';
import { LogDetailModal } from './LogDetailModal';

interface ActivityLogTableProps {
  logs: TaskLogEntry[];
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const COLUMNS = [
  { key: 'status',   label: 'Status',   width: 'w-[120px]', align: 'text-left' },
  { key: 'task',     label: 'Task',     width: 'w-[200px]', align: 'text-left' },
  { key: 'result',   label: 'Result',   width: 'w-auto',    align: 'text-left' },
  { key: 'duration', label: 'Duration', width: 'w-[100px]', align: 'text-left' },
  { key: 'time',     label: 'Time',     width: 'w-[130px]', align: 'text-right' },
  { key: 'inspect',  label: '',         width: 'w-[40px]',  align: 'text-center' },
];

export const ActivityLogTable: React.FC<ActivityLogTableProps> = ({ logs }) => {
  const [selectedLog, setSelectedLog] = useState<TaskLogEntry | null>(null);

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2.5 py-12 px-6 text-slate-400 text-[0.82rem]">
        <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 opacity-30" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>No tasks have been run yet.</span>
      </div>
    );
  }

  return (
    <>
      <div className="w-full overflow-x-auto overflow-y-auto max-h-[320px]" role="region" aria-label="Task activity log">
        <table className="w-full border-separate border-spacing-0 text-[0.78rem]" id="activity-log-table">
          <thead className="bg-[#0b0f17]">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  scope="col"
                  className={`sticky top-0 z-10 px-4 py-2.5 ${col.width} ${col.align} text-[0.67rem] font-semibold tracking-[0.08em] uppercase text-slate-400 bg-[#0b0f17] border-b border-white/[.10] whitespace-nowrap`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[.05]">
            {logs.map((entry) => (
              <tr
                key={entry.id}
                onClick={() => setSelectedLog(entry)}
                className="group cursor-pointer transition-colors duration-[180ms] hover:bg-white/[.05]"
                title="Click to view detailed execution log"
              >
                <td className="px-4 py-3 align-top whitespace-nowrap">
                  <span className={`log-badge log-badge--${entry.status}`}>
                    {entry.status === 'success' ? '✓' : '✗'} {entry.status}
                  </span>
                </td>
                <td className="px-4 py-3 align-top font-medium text-slate-100 whitespace-nowrap">
                  {entry.task_label}
                </td>
                <td className="px-4 py-3 align-top text-slate-300 text-[0.76rem] leading-relaxed break-words">
                  {entry.message ?? '—'}
                </td>
                <td className="px-4 py-3 align-top font-mono text-[0.72rem] text-slate-400 whitespace-nowrap">
                  {entry.duration_ms != null ? `${entry.duration_ms} ms` : '—'}
                </td>
                <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-[0.74rem] text-slate-200">{formatTime(entry.created_at)}</span>
                    <span className="text-[0.65rem] text-slate-500 font-mono">{formatDate(entry.created_at)}</span>
                  </div>
                </td>
                <td className="px-2 py-3 align-middle text-center text-slate-500 group-hover:text-cpu transition-colors">
                  <svg className="w-4 h-4 opacity-50 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Forensic Inspection Modal */}
      <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </>
  );
};
