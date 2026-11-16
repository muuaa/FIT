import { Loader2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-ink-3 ${className}`} size={20} />;
}

export function Empty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-6 text-center">
      <Icon size={22} className="text-ink-3" />
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {children && <div className="text-xs text-ink-3">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
      <div className="tabular truncate text-lg font-semibold">{value}</div>
      {sub && <div className="truncate text-xs text-ink-3">{sub}</div>}
    </div>
  );
}
