import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function ProgressBar({
  value,
  max,
  accent,
  className,
}: {
  value: number;
  max: number;
  accent: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-surface-3', className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: accent }} />
    </div>
  );
}

export function Ring({
  value,
  max,
  accent,
  size = 112,
  stroke = 10,
  children,
}: {
  value: number;
  max: number;
  accent: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
