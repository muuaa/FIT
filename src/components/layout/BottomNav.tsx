import { Dumbbell, House, LineChart, Utensils } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

const TABS = [
  { to: '/', label: 'Today', icon: House, accent: 'var(--color-ink)' },
  { to: '/train', label: 'Train', icon: Dumbbell, accent: 'var(--color-lift)' },
  { to: '/fuel', label: 'Fuel', icon: Utensils, accent: 'var(--color-fuel)' },
  { to: '/progress', label: 'Progress', icon: LineChart, accent: 'var(--color-weight)' },
];

export function BottomNav() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg/90 backdrop-blur-xl">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {TABS.map(({ to, label, icon: Icon, accent }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-ink' : 'text-ink-3',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors')}
                    style={isActive ? { background: `color-mix(in oklab, ${accent} 18%, transparent)`, color: accent } : undefined}
                  >
                    <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
