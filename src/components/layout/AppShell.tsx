import { ChevronLeft, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNow } from '@/hooks/useNow';
import { formatClock } from '@/lib/format';
import { t } from '@/lib/i18n';
import { dayLabel } from '@/lib/split';
import { useRestStore, useWorkoutStore } from '@/stores/workoutStore';
import { BottomNav } from './BottomNav';
import { RestTimerBar } from './RestTimerBar';

export function WorkoutClock({ className = '' }: { className?: string }) {
  const active = useWorkoutStore((s) => s.active);
  const now = useNow(Boolean(active), 1000);
  if (!active) return null;
  return <span className={`tabular ${className}`}>{formatClock((now - active.startedAt) / 1000)}</span>;
}

export function PageHeader({
  title,
  subtitle,
  right,
  back,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Path for a back button (module pages inside a tab). */
  back?: string;
}) {
  const active = useWorkoutStore((s) => s.active);
  const navigate = useNavigate();
  return (
    <header className="pt-safe sticky top-0 z-30 -mx-4 mb-4 border-b border-line/40 bg-bg/85 px-4 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2">
        {back && (
          <Link to={back} aria-label={t('Back')} className="-ms-2 grid size-10 place-items-center rounded-xl text-ink-2 active:bg-surface-2">
            <ChevronLeft size={24} className="rtl:-scale-x-100" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="-mt-0.5 truncate text-xs text-ink-3">{subtitle}</p>}
        </div>
        {active && (
          <button
            type="button"
            onClick={() => navigate('/train')}
            className="flex h-9 items-center gap-2 rounded-full border border-lift/30 bg-lift/10 px-3 text-sm font-semibold text-lift active:scale-95"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-lift opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-lift" />
            </span>
            {dayLabel(active.dayType)}
            <WorkoutClock />
          </button>
        )}
        {right}
        <Link
          to="/settings"
          aria-label={t('Settings')}
          className="grid size-10 place-items-center rounded-xl text-ink-2 active:bg-surface-2"
        >
          <Settings size={20} />
        </Link>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const resting = useRestStore((s) => s.endsAt !== null);
  return (
    <div className="min-h-full">
      <main
        className="mx-auto max-w-lg px-4"
        style={{
          paddingBottom: `calc(${resting ? '9.5rem' : '5.5rem'} + env(safe-area-inset-bottom))`,
        }}
      >
        {children}
      </main>
      <RestTimerBar />
      <BottomNav />
    </div>
  );
}
