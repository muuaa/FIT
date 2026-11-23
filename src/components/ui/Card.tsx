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
    <section className={cn('glass animate-page rounded-[28px] p-4', className)}>
      {(title || action) && (
        <header className="mb-3 flex min-h-8 items-center gap-2.5">
          {Icon && (
            <span
              className="grid size-8 shrink-0 place-items-center rounded-[11px]"
              style={{
                background: `linear-gradient(145deg, color-mix(in oklab, ${accent} 30%, transparent), color-mix(in oklab, ${accent} 12%, transparent))`,
                color: accent,
                boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.08)`,
              }}
            >
              <Icon size={16} strokeWidth={2.3} />
            </span>
          )}
          {title && <h2 className="flex-1 text-[15px] font-semibold tracking-tight text-ink">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
