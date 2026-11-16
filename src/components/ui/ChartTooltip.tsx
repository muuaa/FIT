import { shortDate } from '@/lib/date';

interface Item {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  dataKey?: string | number;
}

/** Dark tooltip for Recharts. Text stays in ink tokens; the swatch carries series identity. */
export function ChartTooltip({
  active,
  payload,
  label,
  unit = 'kg',
}: {
  active?: boolean;
  payload?: Item[];
  label?: string | number;
  unit?: string;
}) {
  const rows = (payload ?? []).filter((p) => p.value !== null && p.value !== undefined);
  if (!active || !rows.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold text-ink">{typeof label === 'string' ? shortDate(label) : label}</div>
      {rows.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="tabular font-semibold text-ink">
            {String(p.value)} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; kind: 'line' | 'dot' }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.kind === 'line' ? (
            <span className="h-0.5 w-4 rounded-full" style={{ background: i.color }} />
          ) : (
            <span className="size-2 rounded-full" style={{ background: i.color }} />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}
