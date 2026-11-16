import { cn } from '@/lib/cn';

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  accent?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  accent = 'var(--color-ink)',
  className,
  size = 'md',
}: SegmentedProps<T>) {
  return (
    <div className={cn('flex rounded-2xl bg-surface-2 p-1', className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex-1 rounded-xl font-semibold transition-colors',
              size === 'sm' ? 'h-8 text-xs' : 'h-10 text-sm',
              active ? 'text-bg' : 'text-ink-2',
            )}
            style={active ? { background: accent } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
