import { Check, Scale } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Sparkline } from '@/components/ui/Sparkline';
import { Stepper } from '@/components/ui/Stepper';
import { buildWeightSeries, useBodyweight, useLogBodyweight } from '@/hooks/useBodyweight';
import { addDays, todayISO } from '@/lib/date';
import { num, round1 } from '@/lib/format';
import { toast } from '@/stores/toastStore';

/** Today-screen morning weigh-in with a 7-day sparkline. */
export function BodyweightQuick() {
  const today = todayISO();
  const { data: logs = [] } = useBodyweight(30);
  const log = useLogBodyweight();
  const todays = logs.find((l) => l.date === today);
  const latest = logs[logs.length - 1];
  const [value, setValue] = useState('');

  useEffect(() => {
    const seed = todays ?? latest;
    if (seed && value === '') setValue(String(round1(seed.weight_kg)));
    // seed once data arrives
  }, [todays, latest]); // eslint-disable-line react-hooks/exhaustive-deps

  const series = useMemo(() => buildWeightSeries(logs, addDays(today, -6), today), [logs, today]);
  const avg = series[series.length - 1]?.avg7;
  const prevAvg = useMemo(() => buildWeightSeries(logs, addDays(today, -7), addDays(today, -7))[0]?.avg7, [logs, today]);
  const delta = avg !== null && avg !== undefined && prevAvg ? round1(avg - prevAvg) : null;
  const n = num(value);

  return (
    <div>
      <div className="mb-3 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="tabular text-2xl font-bold">
            {todays ? (
              <>
                {round1(todays.weight_kg)}
                <span className="text-sm font-medium text-ink-3"> kg today</span>
              </>
            ) : (
              <span className="text-base font-semibold text-ink-2">Not logged yet today</span>
            )}
          </div>
          <div className="tabular text-xs text-ink-3">
            7-day avg {avg ? `${round1(avg)} kg` : '—'}
            {delta !== null && (
              <span className="text-ink-2">
                {' '}
                · {delta > 0 ? '+' : ''}
                {delta} kg vs last week
              </span>
            )}
          </div>
        </div>
        <div className="h-12 w-28 shrink-0" aria-label="7-day bodyweight trend" role="img">
          <Sparkline data={series} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <Stepper label="Morning weight · kg" value={value} onChange={setValue} step={0.1} decimals={1} fallback={70} />
        <button
          type="button"
          aria-label="Save weight"
          disabled={n === null || n < 20 || n > 400 || log.isPending}
          onClick={() =>
            n !== null &&
            log.mutate(
              { date: today, weight_kg: round1(n) },
              { onSuccess: () => toast.success(`Logged ${round1(n)} kg`) },
            )
          }
          className="grid h-12 w-14 shrink-0 place-items-center rounded-2xl bg-weight text-bg transition active:scale-90 disabled:opacity-40"
        >
          {todays ? <Check size={22} strokeWidth={3} /> : <Scale size={20} />}
        </button>
      </div>
    </div>
  );
}
