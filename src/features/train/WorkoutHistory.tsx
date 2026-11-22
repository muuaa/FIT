import { CalendarClock, ChevronRight, Trash2 } from 'lucide-react';
import { t , tn} from '@/lib/i18n';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Empty, Spinner, Stat } from '@/components/ui/States';
import { useDeleteWorkout, useSessionDetail, useWorkoutHistory, type HistoryItem } from '@/hooks/useWorkouts';
import { relativeDay } from '@/lib/date';
import { formatClock, round1 } from '@/lib/format';
import { dayLabel } from '@/lib/split';

function WorkoutDetailSheet({ item, onClose }: { item: HistoryItem | null; onClose: () => void }) {
  const { data: groups = [], isLoading } = useSessionDetail(item?.id ?? null);
  const del = useDeleteWorkout();
  const [confirm, setConfirm] = useState(false);
  const close = () => {
    setConfirm(false);
    onClose();
  };
  return (
    <Sheet
      open={item !== null}
      onClose={close}
      title={item ? `${dayLabel(item.day_type)} · ${relativeDay(item.date)}` : ''}
      footer={
        confirm ? (
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirm(false)}>
              Keep
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => item && del.mutate(item.id, { onSuccess: close })}
            >
              {t('Delete workout')}
            </Button>
          </div>
        ) : (
          <Button variant="ghost" block className="text-danger" onClick={() => setConfirm(true)}>
            <Trash2 size={16} /> {t('Delete this workout')}
          </Button>
        )
      }
    >
      {item && (
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-3">
          <Stat label={t('Time')} value={formatClock(item.duration_seconds ?? 0)} />
          <Stat label={t('Sets')} value={item.setCount} />
          <Stat label={t('Volume')} value={`${item.volumeKg.toLocaleString()}`} sub="kg" />
        </div>
      )}
      {isLoading ? (
        <Spinner />
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.name}>
              <div className="mb-1.5 text-sm font-semibold">{g.name}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.sets.map((s) => (
                  <span key={s.id} className="tabular rounded-lg bg-lift/10 px-2.5 py-1 text-sm">
                    {round1(s.weight_kg)}
                    <span className="text-ink-3"> kg</span> × {s.reps}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

export function WorkoutHistory({ limit = 15 }: { limit?: number }) {
  const { data = [], isLoading } = useWorkoutHistory(limit);
  const [open, setOpen] = useState<HistoryItem | null>(null);
  if (isLoading) return <Spinner />;
  if (!data.length)
    return (
      <Empty icon={CalendarClock} title={t('No workouts logged yet')}>
        {t('Finished workouts show up here. Tap one to see every set.')}
      </Empty>
    );
  return (
    <>
      <ul className="-mx-2 divide-y divide-line/60">
        {data.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => setOpen(w)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-start active:bg-surface-2"
            >
              <span className="grid h-10 w-14 shrink-0 place-items-center rounded-xl bg-lift/12 text-xs font-bold text-lift">
                {dayLabel(w.day_type)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{relativeDay(w.date)}</div>
                <div className="tabular truncate text-xs text-ink-3">
                  {tn(w.exerciseCount, '{n} exercise', '{n} exercises')} · {tn(w.setCount, '{n} set', '{n} sets')} · {w.volumeKg.toLocaleString()} kg
                </div>
              </div>
              <span className="tabular text-sm text-ink-2">{formatClock(w.duration_seconds ?? 0)}</span>
              <ChevronRight size={16} className="shrink-0 text-ink-3 rtl:-scale-x-100" />
            </button>
          </li>
        ))}
      </ul>
      <WorkoutDetailSheet item={open} onClose={() => setOpen(null)} />
    </>
  );
}
