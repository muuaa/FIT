import { Minus, Plus, Timer, X } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useEffect, useRef } from 'react';
import { restFinishedAlert } from '@/lib/alerts';
import { formatClock } from '@/lib/format';
import { useNow } from '@/hooks/useNow';
import { toast } from '@/stores/toastStore';
import { useRestStore } from '@/stores/workoutStore';

/** Global floating rest countdown. Always mounted so the alert fires on any tab. */
export function RestTimerBar() {
  const { endsAt, duration, extend, stop } = useRestStore();
  const now = useNow(endsAt !== null, 200);
  const firedFor = useRef<number | null>(null);

  const remaining = endsAt ? Math.max(0, (endsAt - now) / 1000) : 0;

  useEffect(() => {
    if (endsAt && now >= endsAt && firedFor.current !== endsAt) {
      firedFor.current = endsAt;
      // Only alert if the rest just ended. If the app was closed or in the background for a while,
      // reopening it should quietly clear the old timer rather than beep at you.
      if (now - endsAt < 15_000) {
        restFinishedAlert();
        toast.info(t('Rest over. Next set!'));
      }
      stop();
    }
  }, [endsAt, now, stop]);

  if (!endsAt) return null;
  const pct = duration > 0 ? (remaining / duration) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3 pb-2">
      <div className="animate-fade relative mx-auto flex max-w-lg items-center gap-2 overflow-hidden rounded-2xl border border-lift/30 bg-surface-2/95 py-2 ps-4 pe-2 shadow-2xl backdrop-blur">
        <div
          className="absolute inset-y-0 start-0 bg-lift/12 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
        <Timer size={18} className="relative text-lift" />
        <div className="relative flex-1">
          <div className="text-[11px] uppercase tracking-wider text-ink-3">{t('Rest')}</div>
          <div className="tabular text-xl font-bold leading-none text-lift">{formatClock(Math.ceil(remaining))}</div>
        </div>
        <button
          type="button"
          aria-label={t('Subtract 15 seconds')}
          onClick={() => extend(-15)}
          className="relative grid h-10 w-12 place-items-center rounded-xl bg-surface-3 text-xs font-semibold active:scale-95"
        >
          <span className="flex items-center"><Minus size={12} />15</span>
        </button>
        <button
          type="button"
          aria-label={t('Add 15 seconds')}
          onClick={() => extend(15)}
          className="relative grid h-10 w-12 place-items-center rounded-xl bg-surface-3 text-xs font-semibold active:scale-95"
        >
          <span className="flex items-center"><Plus size={12} />15</span>
        </button>
        <button
          type="button"
          aria-label={t('Skip rest')}
          onClick={stop}
          className="relative grid size-10 place-items-center rounded-xl text-ink-2 active:scale-95"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
