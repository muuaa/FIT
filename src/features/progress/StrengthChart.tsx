import { Dumbbell, TrendingUp } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, Legend } from '@/components/ui/ChartTooltip';
import { Empty, Spinner } from '@/components/ui/States';
import { useExerciseProgress, useExercises } from '@/hooks/useWorkouts';
import { CHART } from '@/lib/chartColors';
import { shortDate } from '@/lib/date';
import { round1 } from '@/lib/format';
import { dayLabel, DAY_TYPES } from '@/lib/split';

export function StrengthChart() {
  const { data: exercises = [] } = useExercises();
  const [selectedId, setSelectedId] = useState<string>('');
  const selected = exercises.find((e) => e.id === selectedId) ?? exercises[0];
  const { data: points = [], isLoading } = useExerciseProgress(selected);

  const grouped = useMemo(
    () => DAY_TYPES.map((d) => ({ d, items: exercises.filter((e) => e.day_type === d) })).filter((g) => g.items.length),
    [exercises],
  );

  if (!exercises.length)
    return (
      <Empty icon={Dumbbell} title={t('No exercises yet')}>
        {t('Add exercises in Train to start tracking strength.')}
      </Empty>
    );

  const first = points[0];
  const last = points[points.length - 1];
  const gain = first && last && points.length > 1 ? round1(last.e1rm - first.e1rm) : null;

  return (
    <div>
      <select
        aria-label={t('Exercise')}
        value={selected?.id ?? ''}
        onChange={(e) => setSelectedId(e.target.value)}
        className="mb-3 h-11 w-full rounded-2xl border border-line bg-surface-2 px-3 text-ink outline-none"
      >
        {grouped.map((g) => (
          <optgroup key={g.d} label={dayLabel(g.d)}>
            {g.items.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {isLoading ? (
        <Spinner />
      ) : points.length === 0 ? (
        <Empty icon={TrendingUp} title={t('No sets logged for this exercise yet')} />
      ) : (
        <>
          <div className="mb-2 flex items-baseline gap-3">
            <div className="tabular text-2xl font-bold">
              {round1(last.e1rm)}
              <span className="text-sm font-medium text-ink-3"> {t('kg est. 1RM')}</span>
            </div>
            {gain !== null && (
              <span className="tabular text-sm font-semibold text-ink-2">
                {gain >= 0 ? '+' : ''}
                {t('{gain} kg since {date}', { gain, date: shortDate(first.date) })}
              </span>
            )}
          </div>
          <Legend
            items={[
              { label: t('Estimated 1RM'), color: CHART.e1rm, kind: 'line' },
              { label: t('Top set weight'), color: CHART.topWeight, kind: 'line' },
            ]}
          />
          <div className="-ms-2 mt-2 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  width={36}
                  tick={{ fill: CHART.axis, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  domain={['dataMin - 5', 'dataMax + 5']}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }} />
                <Line
                  name={t('Est. 1RM')}
                  dataKey="e1rm"
                  stroke={CHART.e1rm}
                  strokeWidth={2}
                  dot={{ r: 4, fill: CHART.e1rm, stroke: 'var(--color-surface)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                <Line
                  name={t('Top weight')}
                  dataKey="topWeight"
                  stroke={CHART.topWeight}
                  strokeWidth={2}
                  dot={{ r: 4, fill: CHART.topWeight, stroke: 'var(--color-surface)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
