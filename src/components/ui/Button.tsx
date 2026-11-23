import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Accent color for the primary variant. */
  accent?: string;
  block?: boolean;
  children: ReactNode;
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-full gap-1.5',
  md: 'h-11 px-4 text-[15px] rounded-2xl gap-2',
  lg: 'h-14 px-5 text-[16px] rounded-[20px] gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  accent = 'var(--color-ink)',
  block,
  className,
  style,
  children,
  ...rest
}: ButtonProps) {
  const variantClass: Record<Variant, string> = {
    primary: 'font-semibold text-bg shadow-[0_8px_24px_-10px_var(--btn-glow),inset_0_1px_0_rgb(255_255_255/0.35)]',
    secondary: 'bg-white/[0.06] text-ink border border-white/[0.07] active:bg-white/[0.1]',
    ghost: 'text-ink-2 active:bg-surface-2',
    danger: 'bg-danger/12 text-danger border border-danger/25 active:bg-danger/20',
  };
  return (
    <button
      type="button"
      className={cn(
        'press inline-flex select-none items-center justify-center font-medium disabled:opacity-40',
        sizes[size],
        variantClass[variant],
        block && 'w-full',
        className,
      )}
      style={
        variant === 'primary'
          ? ({
              background: `linear-gradient(180deg, color-mix(in oklab, ${accent} 92%, white), ${accent})`,
              '--btn-glow': `color-mix(in oklab, ${accent} 70%, transparent)`,
              ...style,
            } as React.CSSProperties)
          : style
      }
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-xl text-ink-2 transition active:scale-95 active:bg-surface-2 disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
