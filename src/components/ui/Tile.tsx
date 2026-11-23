import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Square-ish module tile with an icon, a name and a live value. */
export function Tile({ to, icon: Icon, label, value, accent }: { to: string; icon: LucideIcon; label: string; value: string; accent: string }) {
  return (
    <Link to={to} className="glass press animate-page flex flex-col gap-3 rounded-[24px] p-3.5">
      <span
        className="grid size-10 place-items-center rounded-[14px]"
        style={{
          background: `linear-gradient(145deg, color-mix(in oklab, ${accent} 34%, transparent), color-mix(in oklab, ${accent} 10%, transparent))`,
          color: accent,
          boxShadow: `0 8px 20px -12px ${accent}`,
        }}
      >
        <Icon size={19} strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-semibold">{label}</span>
        <span className="tabular block truncate text-xs text-ink-3">{value}</span>
      </span>
    </Link>
  );
}
