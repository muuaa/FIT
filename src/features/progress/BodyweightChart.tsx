import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip, Legend } from '@/components/ui/ChartTooltip';
import type { WeightPoint } from '@/hooks/useBodyweight';
import { CHART } from '@/lib/chartColors';
import { shortDate } from '@/lib/date';

export function BodyweightChart({ data, height = 220 }: { data: WeightPoint[]; height?: number }) {
  const values = data.flatMap((d) => [d.weight, d.avg7]).filter((v): v is number => v !== null);
  const min = values.length ? Math.floor(Math.min(...values) - 0.5) : 0;
  const max = values.length ? Math.ceil(Math.max(...values) + 0.5) : 1;
  return (
    <div>
      <Legend
        items={[
          { label: 'Daily weigh-in', color: CHART.weightDaily, kind: 'dot' },
          { label: '7-day average', color: CHART.weightAvg, kind: 'line' },
        ]}
      />
      <div className="-ml-2 mt-2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
              domain={[min, max]}
              width={36}
              tick={{ fill: CHART.axis, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }} />
            <Line
              name="7-day avg"
              dataKey="avg7"
              stroke={CHART.weightAvg}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, stroke: 'var(--color-surface)', strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              name="Weigh-in"
              dataKey="weight"
              stroke="none"
              dot={{ r: 4, fill: CHART.weightDaily, stroke: 'var(--color-surface)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: CHART.weightDaily, stroke: 'var(--color-surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
