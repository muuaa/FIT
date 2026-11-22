import { cn } from '@/lib/cn';

export function Toggle({
  checked,
  onChange,
  accent = 'var(--color-fuel)',
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  accent?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', !checked && 'bg-surface-3')}
      style={checked ? { background: accent } : undefined}
    >
      <span
        className={cn(
          'absolute start-0 top-0.5 size-6 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px] rtl:-translate-x-[22px]' : 'translate-x-0.5 rtl:-translate-x-0.5',
        )}
      />
    </button>
  );
}
