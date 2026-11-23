import { ArrowLeftRight, ChevronLeft, Eye, Loader2, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePartnerStore, viewMe, viewPartner } from '@/lib/partner';
import { toast } from '@/stores/toastStore';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNow } from '@/hooks/useNow';
import { formatClock } from '@/lib/format';
import { t } from '@/lib/i18n';
import { dayLabel } from '@/lib/split';
import { useActiveWorkout, useRestStore } from '@/stores/workoutStore';
import { BottomNav } from './BottomNav';
import { RestTimerBar } from './RestTimerBar';

export function WorkoutClock({ className = '' }: { className?: string }) {
  const active = useActiveWorkout();
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
  const active = useActiveWorkout();
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
        <PersonSwitch />
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

/** Me / partner switch. Shows the other person's data, read-only. */
function PersonSwitch() {
  const { partner, viewing, loading } = usePartnerStore();
  if (!partner) return null;
  const initial = (viewing ? partner.name : t('Me')).slice(0, 1).toUpperCase();
  return (
    <button
      type="button"
      disabled={loading}
      aria-label={viewing ? t('Back to my data') : t('View {name}', { name: partner.name })}
      onClick={() => {
        if (viewing) viewMe();
        else void viewPartner().catch((e) => toast.error(e instanceof Error ? e.message : t('Could not load')));
      }}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-full border ps-1 pe-2.5 text-xs font-semibold transition active:scale-95',
        viewing ? 'border-life/50 bg-life/15 text-life' : 'border-line bg-surface-2 text-ink-2',
      )}
    >
      <span className={cn('grid size-7 place-items-center rounded-full text-[13px] font-bold', viewing ? 'bg-life text-bg' : 'bg-surface-3 text-ink')}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : initial}
      </span>
      <ArrowLeftRight size={13} />
    </button>
  );
}

function ViewingBanner() {
  const { partner, viewing } = usePartnerStore();
  if (!viewing || !partner) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2">
      <div className="mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-life/40 bg-surface-2/95 py-2 ps-4 pe-2 shadow-2xl backdrop-blur">
        <Eye size={16} className="shrink-0 text-life" />
        <span className="min-w-0 flex-1 truncate text-sm">
          {t("{name}'s data", { name: partner.name })} <span className="text-ink-3">· {t('view only')}</span>
        </span>
        <button type="button" onClick={viewMe} className="h-9 shrink-0 rounded-xl bg-life px-3 text-sm font-semibold text-bg active:scale-95">
          {t('Back to me')}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const viewing = usePartnerStore((s) => s.viewing);
  const resting = useRestStore((s) => s.endsAt !== null) && !viewing;
  return (
    <div className="min-h-full">
      <main
        className="mx-auto max-w-lg px-4"
        style={{
          paddingBottom: `calc(${resting || viewing ? '9.5rem' : '5.5rem'} + env(safe-area-inset-bottom))`,
        }}
      >
        {children}
      </main>
      {viewing ? <ViewingBanner /> : <RestTimerBar />}
      <BottomNav />
    </div>
  );
}
