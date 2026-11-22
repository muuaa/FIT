import { cn } from '@/lib/cn';

/** 1–5 picker with emoji faces (or custom symbols). Tap the selected value again to clear. */
export function Rating({
  label,
  value,
  onChange,
  symbols = ['😫', '😕', '😐', '🙂', '😄'],
  accent = 'var(--color-mood)',
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  symbols?: string[];
  accent?: string;
  lowLabel?: string;
  highLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium uppercase tracking-wider text-ink-3">{label}</span>
        {(lowLabel || highLabel) && (
          <span className="text-[11px] text-ink-3">
            {lowLabel} → {highLabel}
          </span>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {symbols.map((s, i) => {
          const v = i + 1;
          const on = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${label} ${v}`}
              onClick={() => onChange(on ? null : v)}
              className={cn(
                'grid h-12 place-items-center rounded-2xl border text-2xl transition active:scale-90',
                on ? 'border-transparent' : 'border-line bg-surface-2 grayscale-[60%]',
              )}
              style={on ? { background: `color-mix(in oklab, ${accent} 28%, transparent)`, boxShadow: `inset 0 0 0 2px ${accent}` } : undefined}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
