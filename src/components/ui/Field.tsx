import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  suffix?: ReactNode;
  hint?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, suffix, hint, className, id, ...rest },
  ref,
) {
  const inputId = id ?? `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <label htmlFor={inputId} className={cn('block', className)}>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{label}</span>
      <span className="flex h-12 items-center rounded-2xl border border-line bg-surface-2 px-3.5 focus-within:border-ink-3">
        <input
          ref={ref}
          id={inputId}
          className="tabular h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
          {...rest}
        />
        {suffix && <span className="ml-2 text-sm text-ink-3">{suffix}</span>}
      </span>
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
});
