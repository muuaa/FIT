import { ArrowLeftRight, ChevronLeft, Eye, Loader2, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { usePartnerStore, viewMe, viewPartner } from '@/lib/partner';
import { toast } from '@/stores/toastStore';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNow } from '@/hooks/useNow';
import { formatClock } from '@/lib/format';
import { t } from '@/lib/i18n';
import { dayLabel } from '@/lib/split';
import { useActiveWorkout, useRestStore } from '@/stores/workoutStore';
import { BottomNav, SideNav } from './BottomNav';
import { QuickAdd } from './QuickAdd';
import { FocusWatcher } from '@/features/plan/Focus';
import { RestTimerBar } from './RestTimerBar';

export function WorkoutClock({ className = '' }: { className?: string }) {
  const active = useActiveWorkout();
  const now = useNow(Boolean(active), 1000);
  if (!active) return null;
  return <span className={`tabular ${className}`}>{formatClock((now - active.startedAt) / 1000)}</span>;
}

function useScrolled(threshold = 28): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return scrolled;
}

/**
 * iOS-style header: a large title in the page, and a compact frosted bar that fades in once you
 * scroll. Sub-pages get a back button instead of the large title treatment.
 */
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
  const scrolled = useScrolled();
  const compact = Boolean(back) || scrolled;
  return (
    <>
      <header
        className={cn(
          'pt-safe sticky top-0 z-30 -mx-4 px-4 transition-[background,border-color,backdrop-filter] duration-300 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8',
          compact ? 'border-b border-white/[0.06] bg-bg/70 backdrop-blur-2xl' : 'border-b border-transparent',
        )}
      >
        <div className="flex h-14 items-center gap-2">
          {back && (
            <button
              type="button"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(back))}
              aria-label={t('Back')}
              className="press -ms-2 grid size-10 place-items-center rounded-full text-ink-2"
            >
              <ChevronLeft size={26} className="rtl:-scale-x-100" />
            </button>
          )}
          <div className={cn('min-w-0 flex-1 transition-all duration-300', compact ? 'opacity-100' : 'translate-y-1 opacity-0')}>
            <div className="truncate text-[17px] font-semibold tracking-tight">{title}</div>
          </div>
          {active && (
            <button
              type="button"
              onClick={() => navigate('/train')}
              className="press flex h-9 items-center gap-2 rounded-full border border-lift/30 bg-lift/12 px-3 text-sm font-semibold text-lift"
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
          <Link to="/settings" aria-label={t('Settings')} className="press grid size-10 place-items-center rounded-full text-ink-2">
            <Settings size={21} />
          </Link>
        </div>
      </header>
      {!back && (
        <div className="animate-page mb-5 mt-1">
          {subtitle && <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-ink-3">{subtitle}</p>}
          <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em]">{title}</h1>
        </div>
      )}
      {back && <div className="mb-3" />}
    </>
  );
}

/** Me / partner switch. Shows the other person's data, read-only. */
function PersonSwitch() {
  const { partner, viewing, loading } = usePartnerStore();
  if (!partner) return null;
  const initial = partner.name.slice(0, 1).toUpperCase();
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
        viewing ? 'border-us/50 bg-us/15 text-us' : 'border-white/[0.08] bg-white/[0.05] text-ink-2',
      )}
    >
      <span className={cn('grid size-7 place-items-center rounded-full text-[13px] font-bold', viewing ? 'bg-us text-bg' : 'bg-us/25 text-us')}>
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
    <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2 lg:bottom-4 lg:ps-64">
      <div className="mx-auto flex max-w-lg items-center gap-2 glass-strong rounded-2xl border-life/40 py-2 ps-4 pe-2">
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
    <div className="min-h-full lg:ps-64">
      <main
        className="mx-auto max-w-lg px-4 md:max-w-2xl md:px-6 lg:max-w-3xl lg:px-8"
        style={{
          paddingBottom: `calc(${resting || viewing ? '11rem' : '7.5rem'} + env(safe-area-inset-bottom))`,
        }}
      >
        {children}
      </main>
      {viewing ? <ViewingBanner /> : <RestTimerBar />}
      {!viewing && <QuickAdd />}
      <FocusWatcher />
      <BottomNav />
      <SideNav />
    </div>
  );
}
