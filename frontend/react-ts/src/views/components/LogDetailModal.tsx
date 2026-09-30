// views/components/LogDetailModal.tsx
// Forensic inspection modal displayed when user clicks on any row in ActivityLogTable.

import React, { useEffect, useState } from 'react';
import type { TaskLogEntry } from '../../models/taskResult';

interface LogDetailModalProps {
  log: TaskLogEntry | null;
  onClose: () => void;
}

export const LogDetailModal: React.FC<LogDetailModalProps> = ({ log, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!log) return null;

  const isSuccess = log.status === 'success';
  const details = log.details || {};
  const actions: string[] = Array.isArray(details.actions) ? details.actions : [];

  const handleCopy = () => {
    const payload = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-task-title"
    >
      <div
        className="relative w-full max-w-xl glass border border-white/[.12] rounded-xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-white/[.08] bg-white/[.02]">
          <div className="flex items-center gap-3.5">
            <div
              className={`flex items-center justify-center w-11 h-11 rounded-lg border flex-shrink-0 ${
                isSuccess
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
              }`}
            >
              {isSuccess ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 id="modal-task-title" className="text-[1.05rem] font-bold text-slate-100 tracking-tight">
                  {log.task_label}
                </h3>
                <span className={`log-badge log-badge--${log.status}`}>
                  {isSuccess ? '✓ SUCCESS' : '✗ FAILED'}
                </span>
              </div>
              <p className="text-[0.72rem] text-slate-500 font-mono mt-0.5">
                Task ID: {log.task_id} · Run ID: #{log.id}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[.08] transition-colors"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto flex flex-col gap-5 text-[0.8rem]">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-black/40 border border-white/[.06]">
            <div>
              <span className="text-[0.68rem] uppercase font-semibold text-slate-500 tracking-wider">Execution Time</span>
              <p className="text-slate-200 font-mono text-[0.75rem] mt-0.5">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-[0.68rem] uppercase font-semibold text-slate-500 tracking-wider">Duration</span>
              <p className="text-slate-200 font-mono text-[0.75rem] mt-0.5">
                {log.duration_ms != null ? `${log.duration_ms} ms` : '—'}
              </p>
            </div>
            <div className="col-span-2">
              <span className="text-[0.68rem] uppercase font-semibold text-slate-500 tracking-wider">Executed By</span>
              <p className="text-slate-300 font-mono text-[0.75rem] mt-0.5">
                {log.user_email ? log.user_email : 'Local System User'}
              </p>
            </div>
          </div>

          {/* Primary Summary Message */}
          <div>
            <h4 className="text-[0.72rem] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Result Message
            </h4>
            <div className="p-3 rounded-lg bg-white/[.03] border border-white/[.08] text-slate-200 leading-relaxed font-mono text-[0.75rem]">
              {log.message || 'No additional message provided.'}
            </div>
          </div>

          {/* Detailed Actions Performed */}
          {actions.length > 0 && (
            <div>
              <h4 className="text-[0.72rem] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Detailed System Actions
              </h4>
              <ul className="flex flex-col gap-2 p-3 rounded-lg bg-white/[.02] border border-white/[.07]">
                {actions.map((act, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-300 text-[0.76rem]">
                    <span className="text-cpu mt-0.5 font-bold">›</span>
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Technical Diagnostics */}
          <div>
            <h4 className="text-[0.72rem] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Diagnostic Parameters
            </h4>
            <div className="rounded-lg bg-black/50 border border-white/[.08] p-3 text-[0.72rem] font-mono text-slate-300 overflow-x-auto">
              <dl className="grid grid-cols-3 gap-2">
                {Object.entries(details)
                  .filter(([key]) => key !== 'actions')
                  .map(([key, value]) => (
                    <React.Fragment key={key}>
                      <dt className="text-slate-500 font-semibold">{key}:</dt>
                      <dd className="col-span-2 text-slate-200 break-all">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </dd>
                    </React.Fragment>
                  ))}
              </dl>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 px-6 border-t border-white/[.08] bg-white/[.02]">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.74rem] font-medium text-slate-300 bg-white/[.06] hover:bg-white/[.12] border border-white/[.10] transition-colors"
          >
            {copied ? (
              <>
                <span className="text-emerald-400">✓ Copied JSON</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
                <span>Copy Audit Record</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[0.78rem] font-semibold text-slate-100 bg-cpu/[.15] hover:bg-cpu/25 border border-cpu/30 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
