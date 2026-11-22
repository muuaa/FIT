import { useId } from 'react';
import { t } from '@/lib/i18n';

/**
 * Minutes + seconds entry. Two numeric boxes instead of one "m:ss" text field, because the
 * numeric keypad on iOS has no ":" key.
 */
export function DurationField({
  label,
  minutes,
  seconds,
  onChange,
  hint,
  autoFocus,
}: {
  label: string;
  minutes: string;
  seconds: string;
  onChange: (minutes: string, seconds: string) => void;
  hint?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const box =
    'flex h-12 min-w-0 flex-1 items-center rounded-2xl border border-line bg-surface-2 px-3.5 focus-within:border-ink-3';
  const input = 'tabular h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3';
  const digits = (v: string) => v.replace(/[^\d]/g, '').slice(0, 4);
  return (
    <div role="group" aria-labelledby={`${id}-l`}>
      <span id={`${id}-l`} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <label className={box}>
          <input
            aria-label={`${label} minutes`}
            inputMode="numeric"
            pattern="[0-9]*"
            value={minutes}
            placeholder="0"
            autoFocus={autoFocus}
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange(digits(e.target.value), seconds)}
            className={input}
          />
          <span className="ms-2 text-sm text-ink-3">{t('min')}</span>
        </label>
        <label className={box}>
          <input
            aria-label={`${label} seconds`}
            inputMode="numeric"
            pattern="[0-9]*"
            value={seconds}
            placeholder="00"
            onFocus={(e) => e.target.select()}
            onChange={(e) => onChange(minutes, digits(e.target.value).slice(0, 2))}
            className={input}
          />
          <span className="ms-2 text-sm text-ink-3">{t('sec')}</span>
        </label>
      </div>
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </div>
  );
}

/** Total seconds from the two boxes, or null if empty / invalid (seconds must be 0–59). */
export function durationSeconds(minutes: string, seconds: string): number | null {
  if (!minutes && !seconds) return null;
  const m = minutes ? Number(minutes) : 0;
  const s = seconds ? Number(seconds) : 0;
  if (!Number.isFinite(m) || !Number.isFinite(s) || s > 59) return null;
  return m * 60 + s;
}
