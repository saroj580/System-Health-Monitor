// views/DashboardView.tsx
// Main dashboard layout — assembles all components using live data from hooks.

import React from 'react';
import type { UseSystemStatsResult } from '../controllers/useSystemStats';
import type { UseTaskRunnerResult } from '../controllers/useTaskRunner';
import { StatGauge } from './components/StatGauge';
import { TaskCard } from './components/TaskCard';
import { ActivityLogTable } from './components/ActivityLogTable';
import { formatUptime } from '../models/systemStats';

import type { LicenseStatus } from '../models/licenseStatus';

interface DashboardViewProps {
  statsData: UseSystemStatsResult;
  taskData: UseTaskRunnerResult;
  licenseInfo?: LicenseStatus | null;
}

// Connection status pill
const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <div className={`status-pill status-pill--${status}`} role="status" aria-live="polite">
    <span
      className={`w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 ${status === 'connected' ? 'animate-pulse-dot' : status === 'connecting' ? 'animate-pulse-fast' : ''
        }`}
      aria-hidden="true"
    />
    <span>{status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Disconnected'}</span>
  </div>
);

// Section wrapper
const Section: React.FC<{ title: string; children: React.ReactNode; id?: string }> = ({ title, children, id }) => (
  <section className="mb-7" id={id} aria-labelledby={id ? `${id}-heading` : undefined}>
    <h2 className="section-title" id={id ? `${id}-heading` : undefined}>{title}</h2>
    {children}
  </section>
);

// Skeleton gauge
const GaugeSkeleton: React.FC = () => (
  <div className="glass flex flex-col items-center p-5 gap-2.5">
    <div className="skeleton w-28 h-28 rounded-full" />
    <div className="skeleton w-16 h-2.5 mt-2" />
  </div>
);

export const DashboardView: React.FC<DashboardViewProps> = ({ statsData, taskData, licenseInfo }) => {
  const { stats, status } = statsData;
  const { tasks, runStates, lastResults, logs, run, isLoadingTasks } = taskData;

  const primaryDisk = stats?.disks?.[0];

  return (
    <div className="flex flex-col min-h-screen max-w-[1280px] mx-auto px-6 pb-8">

      {/*  Header  */}
      <header className="flex items-center justify-between py-5 pb-6 border-b border-white/[.07] mb-7">
        <div className="flex items-center gap-3">
          {/* Logo icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-cpu/[.08] border border-cpu/20 flex-shrink-0" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="#00d4ff" strokeWidth="1.5" />
              <path d="M8 21h8M12 17v4" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M7 10.5C7 9.1 8.1 8 9.5 8S12 9.1 12 10.5 10.9 13 9.5 13 7 11.9 7 10.5z" fill="#00d4ff" opacity=".7" />
              <path d="M13 10h4M13 12h3" stroke="#00d4ff" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
            </svg>
          </div>
          <div>
            <h1 className="text-[1.15rem] font-bold text-slate-100 tracking-tight leading-tight">System Monitor</h1>
            <p className="text-[0.72rem] text-slate-500 mt-px">Real-time telemetry &amp; automation</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {licenseInfo?.licensee_name && (
            licenseInfo.is_trial ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[0.72rem] font-medium shadow-[0_0_12px_rgba(245,158,11,0.12)]"
                title={`Trial expires: ${licenseInfo.expires_at ? new Date(licenseInfo.expires_at).toLocaleDateString() : '7 days'}`}
              >
                <span>⚡ Free Trial ({licenseInfo.days_left != null ? `${licenseInfo.days_left}d left` : '7d left'})</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[0.72rem] font-medium"
                title={licenseInfo.expires_at ? `Expires: ${new Date(licenseInfo.expires_at).toLocaleDateString()}` : 'Perpetual License'}
              >
                <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>{licenseInfo.licensee_name}</span>
              </div>
            )
          )}
          {stats && (
            <span className="text-[0.75rem] text-slate-500 font-mono" title="System uptime">
              ⏱ {formatUptime(stats.uptime_seconds)}
            </span>
          )}
          <StatusPill status={status} />
        </div>
      </header>

      {/*  Stat Gauges  */}
      <Section title="System Health" id="system-health">
        <div className="grid grid-cols-4 gap-3.5 max-[900px]:grid-cols-2 max-[480px]:grid-cols-2">
          {!stats ? (
            [0, 1, 2, 3].map(i => <GaugeSkeleton key={i} />)
          ) : (
            <>
              <StatGauge label="CPU" value={stats.cpu_percent} unit="%" accent="cpu"
                subLabel={stats.cpu_freq_mhz ? `${(stats.cpu_freq_mhz / 1000).toFixed(2)} GHz` : undefined} />
              <StatGauge label="RAM" value={stats.ram_percent} unit="%" accent="ram"
                subLabel={`${stats.ram_used_gb.toFixed(1)} / ${stats.ram_total_gb.toFixed(0)} GB`} />
              <StatGauge label="Disk" value={primaryDisk?.percent ?? null} unit="%" accent="disk"
                subLabel={primaryDisk ? `${primaryDisk.used_gb.toFixed(0)} / ${primaryDisk.total_gb.toFixed(0)} GB` : undefined} />
              <StatGauge label="Net ↑" value={stats.network.sent_rate_kbps} unit="KB/s" accent="net"
                subLabel={`↓ ${stats.network.recv_rate_kbps.toFixed(0)} KB/s`} isPercentage={false} />
            </>
          )}
        </div>
      </Section>

      {/*  CPU Core Detail Bar  */}
      {stats && stats.cpu_cores.length > 0 && (
        <div className="glass flex items-flex-end gap-3 px-5 py-4 mb-7 overflow-x-auto" aria-label="CPU core utilization">
          <span className="text-[0.72rem] font-semibold tracking-[0.1em] uppercase text-slate-500 whitespace-nowrap self-start pt-0.5">
            CPU Cores
          </span>
          <div className="flex items-end gap-1.5 flex-1 h-12">
            {stats.cpu_cores.map((core) => (
              <div key={core.core} className="flex flex-col items-center gap-0.5 flex-1 min-w-[18px] h-full justify-end"
                title={`Core ${core.core}: ${core.percent}%`}>
                <div className="core-bar-fill" style={{ height: `${core.percent}%` }} />
                <span className="text-[0.58rem] font-mono text-slate-600">{core.core}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/*  Automation Tasks  */}
      <Section title="Automation Tasks" id="automation-tasks">
        {isLoadingTasks ? (
          <div className="grid grid-cols-4 gap-3.5 max-[900px]:grid-cols-2 max-[480px]:grid-cols-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="glass flex flex-col gap-2 p-5 min-h-[160px]">
                <div className="skeleton w-10 h-10 rounded-lg" />
                <div className="skeleton w-3/5 h-3.5 mt-3" />
                <div className="skeleton w-[90%] h-2.5 mt-1.5" />
                <div className="skeleton w-full h-9 mt-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3.5 max-[900px]:grid-cols-2 max-[480px]:grid-cols-1">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                state={runStates[task.id] ?? 'idle'}
                lastResult={lastResults[task.id] ?? null}
                onRun={run}
              />
            ))}
          </div>
        )}
      </Section>

      {/*  Activity Log  */}
      <Section title="Activity Log" id="activity-log">
        <div className="glass overflow-hidden p-0">
          <ActivityLogTable logs={logs} />
        </div>
      </Section>

      {/*  Footer  */}
      <footer className="flex items-center justify-between pt-5 border-t border-white/[.07] mt-auto text-[0.7rem] text-slate-600">
        <span>System Monitor &amp; Task Automator</span>
        <span>v1.0.0-PreAlpha</span>
      </footer>
    </div>
  );
};
