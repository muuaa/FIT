import { Minus, Plus } from 'lucide-react';

interface StepperProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
  min?: number;
  decimals?: number;
  suffix?: string;
  inputMode?: 'decimal' | 'numeric';
}

/** Compact numeric input with large −/+ buttons for one-thumb adjustments. */
export function Stepper({ label, value, onChange, step, min = 0, decimals = 0, suffix, inputMode = 'decimal' }: StepperProps) {
  const bump = (dir: 1 | -1) => {
    const cur = Number(value.replace(',', '.'));
    const base = Number.isFinite(cur) ? cur : 0;
    const next = Math.max(min, Math.round((base + dir * step) * 10 ** decimals) / 10 ** decimals);
    onChange(String(next));
  };
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-center text-[10px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
      <div className="flex h-12 items-center rounded-2xl border border-line bg-surface-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => bump(-1)}
          className="grid h-full w-10 shrink-0 place-items-center text-ink-2 active:scale-90"
        >
          <Minus size={16} />
        </button>
        <input
          aria-label={label}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="tabular h-full w-full min-w-0 bg-transparent text-center text-lg font-semibold outline-none"
        />
        {suffix && <span className="-ml-1 mr-1 text-xs text-ink-3">{suffix}</span>}
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => bump(1)}
          className="grid h-full w-10 shrink-0 place-items-center text-ink-2 active:scale-90"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
