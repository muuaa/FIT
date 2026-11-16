import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps {
  title?: string;
  icon?: LucideIcon;
  /** CSS color (e.g. var(--color-fuel)) used for the icon chip. */
  accent?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, icon: Icon, accent = 'var(--color-ink-2)', action, className, children }: CardProps) {
  return (
    <section className={cn('rounded-3xl border border-line/70 bg-surface p-4', className)}>
      {(title || action) && (
        <header className="mb-3 flex items-center gap-2.5">
          {Icon && (
            <span
              className="grid size-8 shrink-0 place-items-center rounded-xl"
              style={{ background: `color-mix(in oklab, ${accent} 16%, transparent)`, color: accent }}
            >
              <Icon size={17} strokeWidth={2.25} />
            </span>
          )}
          {title && <h2 className="flex-1 text-[15px] font-semibold tracking-tight">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
