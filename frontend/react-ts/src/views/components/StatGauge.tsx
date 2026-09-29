// views/components/StatGauge.tsx
// Animated SVG ring gauge for a single metric (CPU, RAM, Disk, Network).

import React, { useId } from 'react';

export type GaugeAccent = 'cpu' | 'ram' | 'disk' | 'net';

interface StatGaugeProps {
  label: string;
  value: number | null;
  unit?: string;
  accent: GaugeAccent;
  subLabel?: string;
  isPercentage?: boolean;
}

const RADIUS = 42;
const STROKE = 5;
const CX = 56;
const CY = 56;
const SIZE = 112;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const StatGauge: React.FC<StatGaugeProps> = ({
  label,
  value,
  unit = '%',
  accent,
  subLabel,
  isPercentage = true,
}) => {
  const gradId = useId();

  const pct = value === null ? 0 : Math.min(Math.max(isPercentage ? value : 0, 0), 100);
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  const displayValue = value === null ? '—' : Number.isInteger(value) ? value.toString() : value.toFixed(1);

  const getStrokeColor = () => {
    if (!isPercentage) return `url(#${gradId})`;
    if (pct >= 90) return '#f43f5e';
    if (pct >= 75) return '#f59e0b';
    return `url(#${gradId})`;
  };

  return (
    <div
      className={`glass gauge--${accent} flex flex-col items-center gap-2.5 px-4 py-5 cursor-default animate-fade-in relative overflow-hidden`}
      role="meter"
      aria-label={`${label}: ${displayValue}${unit}`}
      aria-valuenow={value ?? 0}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Glow blob */}
      <span
        className="gauge-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-20 h-20 rounded-full opacity-50 blur-[28px] pointer-events-none transition-opacity duration-[180ms] group-hover:opacity-90"
        aria-hidden="true"
      />

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
        className="flex-shrink-0 drop-shadow-[0_0_6px_currentColor]"
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="grad-start" />
            <stop offset="100%" className="grad-end" />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />

        {/* Fill */}
        <circle
          cx={CX} cy={CY} r={RADIUS}
          fill="none"
          stroke={getStrokeColor()}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${CX} ${CY})`}
          className="gauge-fill"
          style={{ '--gauge-circumference': `${CIRCUMFERENCE}px` } as React.CSSProperties}
        />

        {/* Center value */}
        <text x={CX} y={CY - 4} textAnchor="middle" className="gauge-value">{displayValue}</text>
        <text x={CX} y={CY + 13} textAnchor="middle" className="gauge-unit">{unit}</text>
      </svg>

      <div className="flex flex-col items-center gap-0.5">
        <span className="gauge-label text-[0.75rem] font-semibold tracking-[0.06em] uppercase">{label}</span>
        {subLabel && (
          <span className="text-[0.68rem] text-slate-500 font-mono">{subLabel}</span>
        )}
      </div>
    </div>
  );
};
