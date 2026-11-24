import { BedDouble, Moon, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Bars } from '@/components/ui/Bars';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Rating } from '@/components/ui/Rating';
import { Sheet } from '@/components/ui/Sheet';
import { Empty, Stat } from '@/components/ui/States';
import { useProfile } from '@/hooks/useProfile';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { addDays, relativeDay, weekdayNarrow, parseISODate } from '@/lib/date';
import { t } from '@/lib/i18n';
import { hm, sleepMinutes } from '@/lib/life';
import type { SleepLog } from '@/types/db';
import { toast } from '@/stores/toastStore';
import { OtherSleep } from '@/features/us/OtherPerson';

const ACCENT = 'var(--color-sleep)';
const MOONS = ['😩', '😪', '😐', '🙂', '😴'];

export function SleepSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const today = useToday();
  const { data: logs = [] } = useTable('sleep_logs');
  const actions = useTableActions('sleep_logs');
  const existing = logs.find((l) => l.date === date);
  const last = [...logs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const [bed, setBed] = useState('23:00');
  const [wake, setWake] = useState('07:00');
  const [quality, setQuality] = useState<number | null>(null);
  const [nap, setNap] = useState('');
  const [note, setNote] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = open ? date : null;
  if (key !== seeded) {
    setSeeded(key);
    if (open) {
      const src = existing ?? last;
      setBed(src?.bed ?? '23:00');
      setWake(src?.wake ?? '07:00');
      setQuality(existing?.quality ?? null);
      setNap(existing?.nap_min ? String(existing.nap_min) : '');
      setNote(existing?.note ?? '');
    }
  }
  const mins = sleepMinutes(bed, wake);
  const save = () => {
    actions.put({ date, bed, wake, quality: quality ?? 0, nap_min: Math.max(0, Math.round(Number(nap) || 0)), note: note.trim() });
    toast.success(t('Sleep saved · {h}', { h: hm(mins) }));
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={date === today ? t('Last night') : t('Night before {day}', { day: relativeDay(date) })}
      footer={
        <Button variant="primary" accent={ACCENT} size="lg" block onClick={save} disabled={!bed || !wake}>
          <Moon size={18} /> {t('Save · {h}', { h: hm(mins) })}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('Went to bed')} type="time" value={bed} onChange={(e) => setBed(e.target.value)} />
          <Field label={t('Woke up')} type="time" value={wake} onChange={(e) => setWake(e.target.value)} />
        </div>
        <Rating label={t('How did you sleep?')} value={quality} onChange={setQuality} symbols={MOONS} accent={ACCENT} />
        <Field label={t('Nap')} inputMode="numeric" value={nap} onChange={(e) => setNap(e.target.value.replace(/\D/g, ''))} suffix={t('min')} placeholder="0" />
        <Field label={t('Note')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional, e.g. woke up at 3am')} />
      </div>
    </Sheet>
  );
}

export function SleepToday() {
  const today = useToday();
  const { data: logs = [] } = useTable('sleep_logs');
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const last = logs.find((l) => l.date === today);
  const target = (profile?.sleep_target_h ?? 8) * 60;
  return (
    <>
      {last ? (
        <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 text-start">
          <div className="min-w-0 flex-1">
            <div className="tabular text-2xl font-bold">{hm(sleepMinutes(last.bed, last.wake))}</div>
            <div className="tabular text-xs text-ink-3">
              {last.bed} → {last.wake}
              {last.nap_min ? ` · ${t('nap {n} min', { n: last.nap_min })}` : ''}
            </div>
          </div>
          {last.quality > 0 && <span className="text-3xl">{MOONS[last.quality - 1]}</span>}
          <span className={`tabular text-xs font-semibold ${sleepMinutes(last.bed, last.wake) >= target ? 'text-fuel' : 'text-ink-3'}`}>
            {Math.round((sleepMinutes(last.bed, last.wake) / target) * 100)}%
          </span>
        </button>
      ) : (
        <Button block variant="secondary" onClick={() => setOpen(true)}>
          <BedDouble size={16} /> {t('How did you sleep last night?')}
        </Button>
      )}
      <SleepSheet open={open} onClose={() => setOpen(false)} date={today} />
    </>
  );
}

export function SleepPage() {
  const today = useToday();
  const { data: logs = [] } = useTable('sleep_logs');
  const { data: profile } = useProfile();
  const actions = useTableActions('sleep_logs');
  const [edit, setEdit] = useState<string | null>(null);
  const byDate = useMemo(() => new Map(logs.map((l) => [l.date, l])), [logs]);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const weekMins = week.map((d) => (byDate.get(d) ? sleepMinutes(byDate.get(d)!.bed, byDate.get(d)!.wake) : null));
  const logged = weekMins.filter((m): m is number => m !== null);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : null;
  const target = (profile?.sleep_target_h ?? 8) * 60;
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const qualities = week.map((d) => byDate.get(d)?.quality ?? 0).filter(Boolean);

  return (
    <>
      <PageHeader title={t('Sleep')} back="/health" />
      <div className="space-y-3">
        <Card title={t('Last night')} icon={Moon} accent={ACCENT}>
          <SleepToday />
        </Card>
        <OtherSleep date={today} />
        <Card title={t('This week')} icon={BedDouble} accent={ACCENT}>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <Stat label={t('Average')} value={avg !== null ? hm(avg) : '—'} />
            <Stat label={t('Goal')} value={hm(target)} />
            <Stat label={t('Quality')} value={qualities.length ? MOONS[Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length) - 1] : '—'} />
          </div>
          <Bars
            label={t('Hours slept, last 7 nights')}
            color={ACCENT}
            goal={target / 60}
            data={week.map((d, i) => ({
              label: weekdayNarrow(parseISODate(d).getDay()),
              value: weekMins[i] !== null ? Math.round((weekMins[i]! / 60) * 10) / 10 : null,
              highlight: d === today,
            }))}
            format={(v) => `${v}`}
          />
          <p className="mt-1 text-center text-[11px] text-ink-3">{t('Hours per night · dashed line is your goal')}</p>
        </Card>
        <Card title={t('History')} icon={Moon} accent={ACCENT}>
          {sorted.length === 0 ? (
            <Empty icon={Moon} title={t('No nights logged yet')} />
          ) : (
            <ul className="divide-y divide-line/60">
              {sorted.slice(0, 30).map((l: SleepLog) => (
                <li key={l.date} className="flex items-center gap-2 py-2">
                  <button type="button" onClick={() => setEdit(l.date)} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                    <span className="w-6 text-lg">{l.quality ? MOONS[l.quality - 1] : '·'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{relativeDay(l.date)}</span>
                      <span className="tabular block truncate text-xs text-ink-3">
                        {l.bed} → {l.wake}
                        {l.note ? ` · ${l.note}` : ''}
                      </span>
                    </span>
                    <span className="tabular text-sm font-semibold">{hm(sleepMinutes(l.bed, l.wake))}</span>
                  </button>
                  <IconButton label={t('Delete')} onClick={() => actions.remove(l.date, t('Night deleted'))} className="size-9">
                    <Trash2 size={14} />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <Button block variant="ghost" className="mt-2" onClick={() => setEdit(addDays(today, -1))}>
            {t('Log an earlier night')}
          </Button>
        </Card>
      </div>
      <SleepSheet open={edit !== null} date={edit ?? today} onClose={() => setEdit(null)} />
    </>
  );
}

export function useSleepSummary(): string {
  const today = useToday();
  const { data: logs = [] } = useTable('sleep_logs');
  const l = logs.find((x) => x.date === today);
  return l ? hm(sleepMinutes(l.bed, l.wake)) : t('Log');
}
