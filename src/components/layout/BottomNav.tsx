import { CalendarCheck, HeartHandshake, House, Leaf, Sparkles, type LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { tick } from '@/lib/alerts';
import { t } from '@/lib/i18n';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  accent: string;
  /** Other paths that belong to this tab (sub-pages). */
  also?: string[];
}

export const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: House, accent: 'var(--color-accent)' },
  { to: '/plan', label: 'Plan', icon: CalendarCheck, accent: 'var(--color-todo)', also: ['/life/todos'] },
  {
    to: '/health',
    label: 'Health',
    icon: Leaf,
    accent: 'var(--color-health)',
    also: ['/train', '/fuel', '/progress', '/life/sleep', '/life/body', '/life/mood'],
  },
  { to: '/us', label: 'Us', icon: HeartHandshake, accent: 'var(--color-us)', also: ['/life/lists'] },
  { to: '/life', label: 'Life', icon: Sparkles, accent: 'var(--color-life)' },
];

/** The tab a path belongs to (most specific match wins). */
export function tabFor(path: string): string {
  let best = '/';
  let len = 0;
  for (const tab of TABS) {
    for (const p of [tab.to, ...(tab.also ?? [])]) {
      if (p !== '/' && (path === p || path.startsWith(p + '/')) && p.length > len) {
        best = tab.to;
        len = p.length;
      }
    }
  }
  return best;
}

/** Floating frosted tab bar. */
export function BottomNav() {
  const { pathname } = useLocation();
  const current = tabFor(pathname);
  return (
    <nav className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3">
      <ul className="glass-strong pointer-events-auto mx-auto mb-2 grid h-[66px] max-w-lg grid-cols-5 rounded-[26px] px-1">
        {TABS.map(({ to, label, icon: Icon, accent }) => {
          const active = current === to;
          return (
            <li key={to}>
              <NavLink
                to={to}
                onClick={() => tick()}
                aria-label={t(label)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'press flex h-full flex-col items-center justify-center gap-1 text-[10.5px] font-semibold tracking-wide transition-colors',
                  active ? 'text-ink' : 'text-ink-3',
                )}
              >
                <span
                  className="grid h-8 w-14 place-items-center rounded-full transition-all duration-300"
                  style={
                    active
                      ? { background: `color-mix(in oklab, ${accent} 20%, transparent)`, color: accent, boxShadow: `0 0 22px -6px ${accent}` }
                      : undefined
                  }
                >
                  <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                </span>
                {t(label)}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
