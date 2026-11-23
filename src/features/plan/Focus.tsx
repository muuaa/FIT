import { Coffee, Pause, Play, Target } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Ring } from '@/components/ui/Progress';
import { useNow } from '@/hooks/useNow';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { restFinishedAlert, unlockAudio } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { t } from '@/lib/i18n';
import { isViewingPartner, uid } from '@/lib/localDb';
import { toast } from '@/stores/toastStore';
import { useFocusStore } from '@/stores/focusStore';

/** Always mounted: logs a finished focus session and alerts, on any screen. */
export function FocusWatcher() {
  const { endsAt, startedAt, minutes, mode, label, stop } = useFocusStore();
  const now = useNow(endsAt !== null, 500);
  const sessions = useTableActions('focus_sessions');
  const fired = useRef<number | null>(null);
  useEffect(() => {
    if (!endsAt || now < endsAt || fired.current === endsAt) return;
    fired.current = endsAt;
    const late = now - endsAt > 60_000;
    if (mode === 'focus' && startedAt && !isViewingPartner()) {
      const d = new Date(endsAt);
      sessions.insert({
        id: uid(),
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        minutes,
        label,
        created_at: new Date().toISOString(),
      });
    }
    if (!late) {
      restFinishedAlert();
      toast.success(mode === 'focus' ? t('Focus done: {n} minutes. Take a break!', { n: minutes }) : t('Break over. Ready to focus?'));
    }
    stop();
  }, [now, endsAt, startedAt, minutes, mode, label, stop, sessions]);
  return null;
}

export function FocusCard() {
  const today = useToday();
  const { endsAt, minutes, mode, start, stop } = useFocusStore();
  const now = useNow(endsAt !== null, 250);
  const { data: sessions = [] } = useTable('focus_sessions');
  const todayMin = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.minutes, 0);
  const running = endsAt !== null;
  const left = running ? Math.max(0, (endsAt - now) / 1000) : minutes * 60;
  const accent = mode === 'break' ? 'var(--color-steps)' : 'var(--color-accent)';
  return (
    <Card title={t('Focus')} icon={Target} accent="var(--color-accent)" action={<span className="tabular text-xs text-ink-3">{t('{n} min today', { n: todayMin })}</span>}>
      <div className="flex items-center gap-4">
        <Ring value={running ? minutes * 60 - left : 0} max={minutes * 60} accent={accent} size={104} stroke={9}>
          <div>
            <div className="tabular text-2xl font-bold leading-none">{formatClock(Math.ceil(left))}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">{mode === 'break' ? t('Break') : t('Focus')}</div>
          </div>
        </Ring>
        <div className="min-w-0 flex-1 space-y-2">
          {running ? (
            <Button block variant="secondary" onClick={stop}>
              <Pause size={16} /> {t('Stop')}
            </Button>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                {[25, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      unlockAudio();
                      start(m, 'focus');
                    }}
                    className={cn('press tabular h-10 rounded-xl text-sm font-semibold', 'bg-accent/15 text-accent')}
                  >
                    {m}′
                  </button>
                ))}
              </div>
              <Button
                block
                size="sm"
                variant="ghost"
                onClick={() => {
                  unlockAudio();
                  start(5, 'break');
                }}
              >
                <Coffee size={15} /> {t('5-minute break')}
              </Button>
            </>
          )}
          {!running && (
            <p className="flex items-center gap-1 text-[11px] text-ink-3">
              <Play size={11} /> {t('Tap a length to start. You’ll get a sound when it’s done.')}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
