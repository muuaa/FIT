import { useToday } from '@/hooks/useToday';
import { Activity, Scale, Trash2, TrendingUp } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Empty, Spinner, Stat } from '@/components/ui/States';
import { CardioList } from '@/features/cardio/CardioList';
import { CardioSheet } from '@/features/cardio/CardioSheet';
import { buildWeightSeries, useBodyweight, useDeleteBodyweight } from '@/hooks/useBodyweight';
import { addDays, relativeDay, todayISO } from '@/lib/date';
import { round1 } from '@/lib/format';
import { BodyweightChart } from './BodyweightChart';
import { BodyweightQuick } from './BodyweightQuick';
import { StrengthChart } from './StrengthChart';
import { OtherBody } from '@/features/us/OtherPerson';

function BodyweightSection() {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [showAll, setShowAll] = useState(false);
  const { data: logs = [], isLoading } = useBodyweight(120);
  const del = useDeleteBodyweight();
  const today = todayISO();
  const series = useMemo(() => buildWeightSeries(logs, addDays(today, -(range - 1)), today), [logs, range, today]);

  const avgNow = buildWeightSeries(logs, today, today)[0]?.avg7 ?? null;
  const avgWeekAgo = buildWeightSeries(logs, addDays(today, -7), addDays(today, -7))[0]?.avg7 ?? null;
  const weekly = avgNow !== null && avgWeekAgo !== null ? round1(avgNow - avgWeekAgo) : null;
  const latest = logs[logs.length - 1];
  const recent = [...logs].reverse();

  return (
    <Card title={t('Bodyweight')} icon={Scale} accent="var(--color-weight)">
      <BodyweightQuick />
      <div className="my-4 h-px bg-line/60" />
      {isLoading ? (
        <Spinner />
      ) : logs.length === 0 ? (
        <Empty icon={Scale} title={t('Log your first morning weigh-in above')} />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <Stat label={t('Latest')} value={latest ? `${round1(latest.weight_kg)}` : '—'} sub={latest ? relativeDay(latest.date) : undefined} />
            <Stat label={t('7-day avg')} value={avgNow !== null ? `${round1(avgNow)}` : '—'} sub="kg" />
            <Stat
              label={t('Weekly Δ')}
              value={weekly !== null ? `${weekly > 0 ? '+' : ''}${weekly}` : '—'}
              sub={t('kg / week')}
            />
          </div>
          <Segmented<7 | 30 | 90>
            size="sm"
            className="mb-3"
            value={range}
            onChange={setRange}
            accent="var(--color-weight)"
            options={[
              { value: 7, label: t('7 days') },
              { value: 30, label: t('30 days') },
              { value: 90, label: t('90 days') },
            ]}
          />
          <BodyweightChart data={series} />
          <details className="mt-3" open={showAll} onToggle={(e) => setShowAll((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-sm font-medium text-ink-2">{t('All entries (table)')}</summary>
            <ul className="mt-2 divide-y divide-line/60">
              {recent.map((l) => (
                <li key={l.date} className="flex items-center py-1.5 text-sm">
                  <span className="flex-1 text-ink-2">{relativeDay(l.date)}</span>
                  <span className="tabular font-semibold">{round1(l.weight_kg)} kg</span>
                  <IconButton label={t('Delete {name}', { name: relativeDay(l.date) })} onClick={() => del.mutate(l.date)} className="-me-2 ms-1 size-9">
                    <Trash2 size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </Card>
  );
}

export function ProgressPage() {
  const [cardioOpen, setCardioOpen] = useState(false);
  const today = useToday();
  return (
    <>
      <PageHeader title={t('Progress')} subtitle={t('Bodyweight · Strength · Cardio')} back="/health" />
      <div className="space-y-3">
        <BodyweightSection />
        <OtherBody date={today} />
        <Card title={t('Strength')} icon={TrendingUp} accent="var(--color-lift)">
          <StrengthChart />
        </Card>
        <Card
          title={t('Cardio')}
          icon={Activity}
          accent="var(--color-cardio)"
          action={
            <Button size="sm" variant="primary" accent="var(--color-cardio)" onClick={() => setCardioOpen(true)}>
              {t('Log')}
            </Button>
          }
        >
          <CardioList />
        </Card>
      </div>
      <CardioSheet open={cardioOpen} onClose={() => setCardioOpen(false)} />
    </>
  );
}
