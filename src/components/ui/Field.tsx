import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
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
  const auto = useId();
  const inputId = id ?? `f${auto}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className={cn('block', className)}>
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">
        {label}
      </label>
      <div className="flex h-12 items-center rounded-2xl border border-line bg-surface-2 px-3.5 focus-within:border-ink-3">
        <input
          ref={ref}
          id={inputId}
          aria-describedby={hintId}
          className="tabular h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
          {...rest}
        />
        {suffix && <span className="ms-2 text-sm text-ink-3">{suffix}</span>}
      </div>
      {hint && (
        <span id={hintId} className="mt-1 block text-xs text-ink-3">
          {hint}
        </span>
      )}
    </div>
  );
});
