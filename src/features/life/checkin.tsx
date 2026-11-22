import { Smile, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { DayPicker } from '@/components/ui/DayPicker';
import { IconButton } from '@/components/ui/Button';
import { Rating } from '@/components/ui/Rating';
import { Empty } from '@/components/ui/States';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { addDays, relativeDay, weekdayNarrow, parseISODate } from '@/lib/date';
import { t } from '@/lib/i18n';
import type { CheckIn } from '@/types/db';

export const MOOD = ['😞', '😕', '😐', '🙂', '😄'];
export const ENERGY = ['🪫', '😴', '😐', '⚡', '🚀'];
export const STRESS = ['😌', '🙂', '😐', '😬', '🤯'];

/** Quick three-scale check-in that saves as you tap. */
export function CheckInForm({ date }: { date: string }) {
  const { data: rows = [] } = useTable('checkins');
  const actions = useTableActions('checkins');
  const cur = rows.find((r) => r.date === date);
  const [note, setNote] = useState(cur?.note ?? '');
  useEffect(() => setNote(cur?.note ?? ''), [cur?.note, date]);
  const save = (patch: Partial<CheckIn>) => {
    const next: CheckIn = { date, mood: 0, energy: 0, stress: 0, note: '', ...cur, ...patch };
    if (!next.mood && !next.energy && !next.stress && !next.note) actions.remove(date);
    else actions.put(next);
  };
  return (
    <div className="space-y-3">
      <Rating label={t('Mood')} value={cur?.mood || null} onChange={(v) => save({ mood: v ?? 0 })} symbols={MOOD} accent="var(--color-mood)" />
      <Rating label={t('Energy')} value={cur?.energy || null} onChange={(v) => save({ energy: v ?? 0 })} symbols={ENERGY} accent="var(--color-steps)" />
      <Rating
        label={t('Stress')}
        value={cur?.stress || null}
        onChange={(v) => save({ stress: v ?? 0 })}
        symbols={STRESS}
        accent="var(--color-danger)"
        lowLabel={t('calm')}
        highLabel={t('stressed')}
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== (cur?.note ?? '') && save({ note: note.trim() })}
        placeholder={t("What's on your mind? (optional)")}
        aria-label={t('Note')}
        className="h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-ink outline-none placeholder:text-ink-3 focus:border-ink-3"
      />
    </div>
  );
}

function Trend({ rows, field, symbols, color, label }: { rows: Map<string, CheckIn>; field: 'mood' | 'energy' | 'stress'; symbols: string[]; color: string; label: string }) {
  const today = useToday();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-ink-2">{label}</div>
      <div className="grid grid-cols-14 gap-0.5" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
        {days.map((d) => {
          const v = rows.get(d)?.[field] ?? 0;
          return (
            <div key={d} className="flex flex-col items-center gap-0.5">
              <div
                className="grid aspect-square w-full place-items-center rounded-md text-[11px]"
                style={{ background: v ? `color-mix(in oklab, ${color} ${15 + v * 15}%, transparent)` : 'var(--color-surface-2)' }}
                title={v ? `${d}: ${v}/5` : d}
              >
                {v ? symbols[v - 1] : ''}
              </div>
              <span className={`text-[9px] ${d === today ? 'font-bold text-ink' : 'text-ink-3'}`}>{weekdayNarrow(parseISODate(d).getDay())}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CheckInPage() {
  const today = useToday();
  const [date, setDate] = useState(today);
  const { data: rows = [] } = useTable('checkins');
  const actions = useTableActions('checkins');
  const byDate = useMemo(() => new Map(rows.map((r) => [r.date, r])), [rows]);
  const recent = [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  return (
    <>
      <PageHeader title={t('Mood & energy')} back="/life" />
      <DayPicker date={date} onChange={setDate} />
      <div className="space-y-3">
        <Card title={t('Check-in')} icon={Smile} accent="var(--color-mood)">
          <CheckInForm date={date} />
        </Card>
        <Card title={t('Last 2 weeks')} icon={Smile} accent="var(--color-mood)">
          <div className="space-y-3">
            <Trend rows={byDate} field="mood" symbols={MOOD} color="var(--color-mood)" label={t('Mood')} />
            <Trend rows={byDate} field="energy" symbols={ENERGY} color="var(--color-steps)" label={t('Energy')} />
            <Trend rows={byDate} field="stress" symbols={STRESS} color="var(--color-danger)" label={t('Stress')} />
          </div>
        </Card>
        <Card title={t('Notes')} icon={Smile} accent="var(--color-mood)">
          {recent.filter((r) => r.note).length === 0 ? (
            <Empty icon={Smile} title={t('No notes yet')} />
          ) : (
            <ul className="divide-y divide-line/60">
              {recent
                .filter((r) => r.note)
                .map((r) => (
                  <li key={r.date} className="flex items-start gap-2 py-2">
                    <span className="text-lg">{r.mood ? MOOD[r.mood - 1] : '·'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-ink-3">{relativeDay(r.date)}</div>
                      <div className="text-sm">{r.note}</div>
                    </div>
                    <IconButton label={t('Delete')} className="size-9" onClick={() => actions.remove(r.date, t('Check-in deleted'))}>
                      <Trash2 size={14} />
                    </IconButton>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

export function useCheckInSummary(): string {
  const today = useToday();
  const { data: rows = [] } = useTable('checkins');
  const r = rows.find((x) => x.date === today);
  return r?.mood ? MOOD[r.mood - 1] : t('Check in');
}
