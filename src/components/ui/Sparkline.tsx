import type { WeightPoint } from '@/hooks/useBodyweight';
import { CHART } from '@/lib/chartColors';

/** Tiny 7-day trend: rolling-average line plus daily dots. Plain SVG so Today doesn't load the chart library. */
export function Sparkline({ data, width = 112, height = 48 }: { data: WeightPoint[]; width?: number; height?: number }) {
  const values = data.flatMap((d) => [d.weight, d.avg7]).filter((v): v is number => v !== null);
  if (!values.length) return <div style={{ width, height }} />;
  const pad = 4;
  const lo = Math.min(...values) - 0.3;
  const hi = Math.max(...values) + 0.3;
  const x = (i: number) => pad + (i * (width - pad * 2)) / Math.max(1, data.length - 1);
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo || 1)) * (height - pad * 2);
  const line = data
    .map((d, i) => (d.avg7 === null ? null : `${x(i).toFixed(1)},${y(d.avg7).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {line && <polyline points={line} fill="none" stroke={CHART.weightAvg} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {data.map((d, i) =>
        d.weight === null ? null : <circle key={d.date} cx={x(i)} cy={y(d.weight)} r={2.5} fill={CHART.weightDaily} />,
      )}
    </svg>
  );
}
