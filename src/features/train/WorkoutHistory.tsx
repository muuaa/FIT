import { CalendarClock } from 'lucide-react';
import { Empty, Spinner } from '@/components/ui/States';
import { useWorkoutHistory } from '@/hooks/useWorkouts';
import { relativeDay } from '@/lib/date';
import { formatClock } from '@/lib/format';
import { DAY_LABEL } from '@/lib/split';

export function WorkoutHistory({ limit = 15 }: { limit?: number }) {
  const { data = [], isLoading } = useWorkoutHistory(limit);
  if (isLoading) return <Spinner />;
  if (!data.length) return <Empty icon={CalendarClock} title="No workouts logged yet" />;
  return (
    <ul className="divide-y divide-line/60">
      {data.map((w) => (
        <li key={w.id} className="flex items-center gap-3 py-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lift/12 text-xs font-bold text-lift">
            {DAY_LABEL[w.day_type].slice(0, 3).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{relativeDay(w.date)}</div>
            <div className="tabular text-xs text-ink-3">
              {w.exerciseCount} exercises · {w.setCount} sets · {w.volumeKg.toLocaleString()} kg
            </div>
          </div>
          <span className="tabular text-sm text-ink-2">{formatClock(w.duration_seconds ?? 0)}</span>
        </li>
      ))}
    </ul>
  );
}
