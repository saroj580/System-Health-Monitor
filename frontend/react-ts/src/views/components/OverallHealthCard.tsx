// views/components/OverallHealthCard.tsx
// Displays the overall system health index (0 - 100%) and dynamic performance insights.

import React from 'react';

interface OverallHealthCardProps {
  healthPercent?: number;
  healthStatus?: string;
  healthInsight?: string;
  cpuPercent?: number;
  ramPercent?: number;
  diskPercent?: number;
}

export const OverallHealthCard: React.FC<OverallHealthCardProps> = ({
  healthPercent = 100,
  healthStatus = 'Optimal',
  healthInsight = 'All subsystems operating at peak efficiency.',
  cpuPercent = 0,
  ramPercent = 0,
  diskPercent = 0,
}) => {
  // Determine color scheme based on health
  const getTheme = (score: number) => {
    if (score >= 85) {
      return {
        text: 'text-emerald-400',
        stroke: '#10b981',
        bgPill: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        glow: 'rgba(16, 185, 129, 0.15)',
        border: 'border-emerald-500/20',
      };
    }
    if (score >= 70) {
      return {
        text: 'text-cpu',
        stroke: '#00d4ff',
        bgPill: 'bg-cpu/10 border-cpu/30 text-cpu',
        glow: 'rgba(0, 212, 255, 0.15)',
        border: 'border-cpu/20',
      };
    }
    if (score >= 50) {
      return {
        text: 'text-amber-400',
        stroke: '#f59e0b',
        bgPill: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        glow: 'rgba(245, 158, 11, 0.15)',
        border: 'border-amber-500/20',
      };
    }
    return {
      text: 'text-rose-400',
      stroke: '#f43f5e',
      bgPill: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
      glow: 'rgba(244, 63, 94, 0.15)',
      border: 'border-rose-500/20',
    };
  };

  const theme = getTheme(healthPercent);

  // SVG Circular Gauge calculations
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthPercent / 100) * circumference;

  return (
    <div
      className={`glass relative overflow-hidden p-6 mb-7 border ${theme.border} transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.35)]`}
      style={{
        boxShadow: `0 0 32px ${theme.glow}`,
      }}
    >
      {/* Background ambient gradient glow */}
      <div
        className="absolute -right-16 -top-16 w-56 h-56 rounded-full blur-[80px] pointer-events-none opacity-20"
        style={{ backgroundColor: theme.stroke }}
      />

      <div className="flex items-center justify-between gap-6 max-[768px]:flex-col max-[768px]:items-start">
        {/* Left: Overall Score Gauge + Title */}
        <div className="flex items-center gap-6">
          <div className="relative flex items-center justify-center w-24 h-24 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background circle track */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-white/[.08]"
                strokeWidth="8"
                fill="none"
              />
              {/* Animated Health Progress Arc */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke={theme.stroke}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                style={{
                  transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: `drop-shadow(0 0 6px ${theme.stroke})`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className={`font-mono text-[1.4rem] font-bold leading-none ${theme.text}`}>
                {Math.round(healthPercent)}
                <span className="text-[0.75rem] font-sans font-medium text-slate-400">%</span>
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[1.1rem] font-bold text-slate-100 tracking-tight">
                System Health Score
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[0.68rem] font-bold uppercase tracking-wider border ${theme.bgPill}`}>
                ● {healthStatus}
              </span>
            </div>
            <p className="text-[0.78rem] text-slate-300 max-w-[480px] leading-relaxed">
              {healthInsight}
            </p>
          </div>
        </div>

        {/* Right: Subsystem Stress Indicators */}
        <div className="flex items-center gap-4 max-[480px]:w-full max-[480px]:justify-between">
          <div className="flex flex-col items-center p-2.5 px-3.5 rounded-lg bg-black/40 border border-white/[.06]">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">CPU Load</span>
            <span className="font-mono text-[0.82rem] font-medium text-cpu">{cpuPercent.toFixed(0)}%</span>
          </div>

          <div className="flex flex-col items-center p-2.5 px-3.5 rounded-lg bg-black/40 border border-white/[.06]">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">RAM Load</span>
            <span className="font-mono text-[0.82rem] font-medium text-ram">{ramPercent.toFixed(0)}%</span>
          </div>

          <div className="flex flex-col items-center p-2.5 px-3.5 rounded-lg bg-black/40 border border-white/[.06]">
            <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Disk Usage</span>
            <span className="font-mono text-[0.82rem] font-medium text-disk">{diskPercent.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
