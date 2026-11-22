/** Lightweight bar chart (plain SVG) for daily values with an optional goal line. */
export function Bars({
  data,
  goal,
  color,
  height = 120,
  format = (v: number) => String(v),
  label,
}: {
  data: { label: string; value: number | null; highlight?: boolean }[];
  goal?: number;
  color: string;
  height?: number;
  format?: (v: number) => string;
  label: string;
}) {
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value ?? 0), 1) * 1.1;
  const top = 16;
  const h = height - top - 18;
  return (
    <figure aria-label={label} className="w-full">
      <div className="relative" style={{ height }}>
        {goal ? (
          <div
            className="absolute inset-x-0 border-t border-dashed border-ink-3/60"
            style={{ top: top + h - (goal / max) * h }}
            aria-hidden
          />
        ) : null}
        <div className="absolute inset-x-0 flex items-end gap-1.5" style={{ top, height: h }}>
          {data.map((d, i) => (
            <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              {d.value !== null && d.value > 0 && (
                <div className="tabular mb-0.5 truncate text-center text-[10px] text-ink-3">{format(d.value)}</div>
              )}
              <div
                className="w-full rounded-md transition-[height] duration-500"
                style={{
                  height: `${d.value ? Math.max(4, (d.value / max) * 100) : 0}%`,
                  background: color,
                  opacity: d.highlight ? 1 : 0.65,
                }}
                title={d.value !== null ? format(d.value) : ''}
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex gap-1.5">
          {data.map((d, i) => (
            <div key={i} className={`flex-1 truncate text-center text-[10px] ${d.highlight ? 'font-semibold text-ink' : 'text-ink-3'}`}>
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
