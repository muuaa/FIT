import { Archive, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { Empty } from '@/components/ui/States';
import { WeekdayPicker } from '@/components/ui/WeekdayPicker';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { tick } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { addMonths, monthLabel, toISODate, weekdayNarrow } from '@/lib/date';
import { t, tn } from '@/lib/i18n';
import { bestStreak, HABIT_EMOJI, habitDueOn, habitStreak } from '@/lib/life';
import { uid } from '@/lib/localDb';
import type { Habit } from '@/types/db';

const ACCENT = 'var(--color-habit)';

function useHabits() {
  const { data: habits = [] } = useTable('habits');
  const { data: logs = [] } = useTable('habit_logs');
  const doneBy = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of logs) {
      if (!m.has(l.habit_id)) m.set(l.habit_id, new Set());
      m.get(l.habit_id)!.add(l.date);
    }
    return m;
  }, [logs]);
  const active = useMemo(() => habits.filter((h) => !h.archived).sort((a, b) => a.position - b.position), [habits]);
  return { habits, active, doneBy };
}

function useToggleHabit() {
  const logs = useTableActions('habit_logs');
  return (h: Habit, date: string, done: boolean) => {
    tick();
    if (done) logs.remove(`${h.id}|${date}`);
    else logs.put({ habit_id: h.id, date });
  };
}

/** Today's due habits as big tap targets. Used on Today, the Life hub and the Habits page. */
export function HabitsToday({ onAdd }: { onAdd?: () => void }) {
  const today = useToday();
  const { active, doneBy } = useHabits();
  const toggle = useToggleHabit();
  const due = active.filter((h) => habitDueOn(h, today));
  if (!active.length)
    return (
      <button type="button" className="block w-full" onClick={onAdd}>
        <Empty icon={Flame} title={t('No habits yet')}>
          {t('Add the small things you want to do every day and build streaks.')}
        </Empty>
      </button>
    );
  if (!due.length) return <p className="text-sm text-ink-3">{t('No habits due today. Enjoy the day off.')}</p>;
  const doneCount = due.filter((h) => doneBy.get(h.id)?.has(today)).length;
  return (
    <div>
      <div className="mb-2 text-xs text-ink-3">{t('{done} of {total} done', { done: doneCount, total: due.length })}</div>
      <ul className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        {due.map((h) => {
          const set = doneBy.get(h.id) ?? new Set<string>();
          const done = set.has(today);
          const streak = habitStreak(h, set, today);
          return (
            <li key={h.id}>
              <button
                type="button"
                aria-pressed={done}
                onClick={() => toggle(h, today, done)}
                className={cn(
                  'flex min-h-14 w-full items-center gap-2.5 rounded-2xl border px-3 py-2 text-start transition active:scale-[0.97]',
                  done ? 'border-habit/40 bg-habit/12' : 'border-line bg-surface-2',
                )}
              >
                <span className="text-xl">{h.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn('line-clamp-2 block text-sm font-medium leading-tight', done && 'text-ink-2')}>{h.name}</span>
                  {streak > 0 && (
                    <span className="tabular flex items-center gap-0.5 text-[11px] text-mood">
                      <Flame size={11} /> {tn(streak, '{n} day', '{n} days')}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full border-2',
                    done ? 'border-habit bg-habit text-bg' : 'border-ink-3',
                  )}
                >
                  {done && <Check size={14} strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HabitSheet({ habit, open, onClose }: { habit: Habit | null; open: boolean; onClose: () => void }) {
  const actions = useTableActions('habits');
  const { habits } = useHabits();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎯');
  const [days, setDays] = useState<number[]>([]);
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = open ? (habit?.id ?? 'new') : null;
  if (key !== seeded) {
    setSeeded(key);
    if (open) {
      setName(habit?.name ?? '');
      setEmoji(habit?.emoji ?? '🎯');
      setDays(habit?.days ?? []);
    }
  }
  const save = () => {
    if (!name.trim()) return;
    if (habit) actions.patch(habit.id, { name: name.trim(), emoji, days });
    else
      actions.insert({
        id: uid(),
        name: name.trim(),
        emoji,
        days,
        position: habits.reduce((m, h) => Math.max(m, h.position), -1) + 1,
        archived: false,
        created_at: new Date().toISOString(),
      });
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={habit ? t('Edit habit') : t('New habit')}
      footer={
        <Button variant="primary" accent={ACCENT} size="lg" block disabled={!name.trim()} onClick={save}>
          {habit ? t('Save') : t('Add habit')}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label={t('Habit')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Read 10 pages')} maxLength={60} />
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Icon')}</span>
          <div className="grid grid-cols-10 gap-1">
            {HABIT_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={emoji === e}
                onClick={() => setEmoji(e)}
                className={cn('grid h-9 place-items-center rounded-xl text-lg', emoji === e ? 'bg-habit/25 ring-2 ring-habit' : 'bg-surface-2')}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <WeekdayPicker value={days} onChange={setDays} accent={ACCENT} />
      </div>
    </Sheet>
  );
}

function MonthGrid({ habit, done }: { habit: Habit; done: Set<string> }) {
  const today = useToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const lead = (first.getDay() + 1) % 7; // weeks start Saturday
  const toggle = useToggleHabit();
  const count = [...done].filter((d) => d.startsWith(month)).length;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <IconButton label={t('Previous month')} onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft size={18} className="rtl:-scale-x-100" />
        </IconButton>
        <div className="text-center">
          <div className="text-sm font-semibold">{monthLabel(month)}</div>
          <div className="tabular text-xs text-ink-3">{tn(count, '{n} day done', '{n} days done')}</div>
        </div>
        <IconButton label={t('Next month')} disabled={month >= today.slice(0, 7)} onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight size={18} className="rtl:-scale-x-100" />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {[6, 0, 1, 2, 3, 4, 5].map((wd) => (
          <div key={wd} className="text-[10px] font-medium text-ink-3">
            {weekdayNarrow(wd)}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`l${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = toISODate(new Date(y, m - 1, i + 1));
          const isDone = done.has(d);
          const due = habitDueOn(habit, d);
          const future = d > today;
          return (
            <button
              key={d}
              type="button"
              disabled={future}
              aria-label={`${d} ${isDone ? t('done') : ''}`}
              onClick={() => toggle(habit, d, isDone)}
              className={cn(
                'tabular grid aspect-square place-items-center rounded-lg text-xs font-medium',
                isDone ? 'bg-habit text-bg' : due && !future ? 'bg-surface-3 text-ink-2' : 'bg-surface-2 text-ink-3/60',
                d === today && 'ring-2 ring-ink/60',
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11px] text-ink-3">{t('Tap a past day to fix it.')}</p>
    </div>
  );
}

function HabitDetail({ habit, onClose, onEdit }: { habit: Habit | null; onClose: () => void; onEdit: () => void }) {
  const today = useToday();
  const { doneBy } = useHabits();
  const actions = useTableActions('habits');
  const logs = useTableActions('habit_logs');
  const [confirm, setConfirm] = useState(false);
  const done = (habit && doneBy.get(habit.id)) || new Set<string>();
  return (
    <Sheet
      open={habit !== null}
      onClose={() => {
        setConfirm(false);
        onClose();
      }}
      title={habit ? `${habit.emoji} ${habit.name}` : ''}
      footer={
        habit &&
        (confirm ? (
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirm(false)}>
              {t('Keep')}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                actions.remove(habit.id);
                logs.removeWhere((l) => l.habit_id === habit.id);
                setConfirm(false);
                onClose();
              }}
            >
              {t('Delete with history')}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onEdit}>
              <Pencil size={16} /> {t('Edit')}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                actions.patch(habit.id, { archived: !habit.archived });
                onClose();
              }}
            >
              <Archive size={16} /> {habit.archived ? t('Restore') : t('Archive')}
            </Button>
            <IconButton label={t('Delete')} onClick={() => setConfirm(true)} className="bg-danger/12 text-danger">
              <Trash2 size={16} />
            </IconButton>
          </div>
        ))
      }
    >
      {habit && (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-3 text-center">
            <div>
              <div className="tabular text-xl font-bold text-mood">{habitStreak(habit, done, today)}</div>
              <div className="text-[11px] text-ink-3">{t('Current streak')}</div>
            </div>
            <div>
              <div className="tabular text-xl font-bold">{bestStreak(habit, done, today)}</div>
              <div className="text-[11px] text-ink-3">{t('Best streak')}</div>
            </div>
            <div>
              <div className="tabular text-xl font-bold">{done.size}</div>
              <div className="text-[11px] text-ink-3">{t('Total')}</div>
            </div>
          </div>
          <MonthGrid habit={habit} done={done} />
        </>
      )}
    </Sheet>
  );
}

export function HabitsPage() {
  const today = useToday();
  const { habits, active, doneBy } = useHabits();
  const [sheet, setSheet] = useState<{ habit: Habit | null } | null>(null);
  const [detail, setDetail] = useState<Habit | null>(null);
  const archived = habits.filter((h) => h.archived);
  const habitsActions = useTableActions('habits');

  // Last 7 days strip for each habit.
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return toISODate(d);
  });

  return (
    <>
      <PageHeader
        title={t('Habits')}
        back="/life"
        right={
          <IconButton label={t('New habit')} onClick={() => setSheet({ habit: null })}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <div className="space-y-3">
        <Card title={t('Today')} icon={Flame} accent={ACCENT}>
          <HabitsToday onAdd={() => setSheet({ habit: null })} />
        </Card>

        {active.length > 0 && (
          <Card title={t('All habits')} icon={Check} accent={ACCENT}>
            <ul className="-mx-1 space-y-1">
              {active.map((h, i) => {
                const set = doneBy.get(h.id) ?? new Set<string>();
                return (
                  <li key={h.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDetail(h)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-2 text-start active:bg-surface-2"
                    >
                      <span className="text-lg">{h.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{h.name}</span>
                        <span className="tabular flex items-center gap-1 text-[11px] text-ink-3">
                          <Flame size={11} className="text-mood" /> {habitStreak(h, set, today)} ·{' '}
                          {h.days.length ? h.days.map((d) => weekdayNarrow(d)).join(' ') : t('Every day')}
                        </span>
                      </span>
                      <span className="flex gap-0.5" aria-hidden>
                        {week.map((d) => (
                          <span
                            key={d}
                            className={cn(
                              'size-3 rounded-[4px]',
                              set.has(d) ? 'bg-habit' : habitDueOn(h, d) ? 'bg-surface-3' : 'bg-surface-2',
                            )}
                          />
                        ))}
                      </span>
                    </button>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label={t('Move up')}
                        disabled={i === 0}
                        className="grid h-6 w-8 place-items-center text-ink-3 disabled:opacity-20"
                        onClick={() => {
                          const prev = active[i - 1];
                          habitsActions.patch(h.id, { position: prev.position });
                          habitsActions.patch(prev.id, { position: h.position });
                        }}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={t('Move down')}
                        disabled={i === active.length - 1}
                        className="grid h-6 w-8 place-items-center text-ink-3 disabled:opacity-20"
                        onClick={() => {
                          const next = active[i + 1];
                          habitsActions.patch(h.id, { position: next.position });
                          habitsActions.patch(next.id, { position: h.position });
                        }}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[11px] text-ink-3">{t('Tap a habit for its calendar, streaks and settings.')}</p>
          </Card>
        )}

        <Button block variant="secondary" onClick={() => setSheet({ habit: null })}>
          <Plus size={16} /> {t('New habit')}
        </Button>

        {archived.length > 0 && (
          <details className="rounded-3xl border border-line/70 bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium text-ink-2">{t('Archived ({n})', { n: archived.length })}</summary>
            <ul className="mt-2 space-y-1">
              {archived.map((h) => (
                <li key={h.id}>
                  <button type="button" onClick={() => setDetail(h)} className="w-full py-1.5 text-start text-sm text-ink-2">
                    {h.emoji} {h.name}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <HabitSheet open={sheet !== null} habit={sheet?.habit ?? null} onClose={() => setSheet(null)} />
      <HabitDetail
        habit={detail ? (habits.find((h) => h.id === detail.id) ?? null) : null}
        onClose={() => setDetail(null)}
        onEdit={() => {
          setSheet({ habit: detail });
          setDetail(null);
        }}
      />
    </>
  );
}

/** Small summary for the Life hub tile. */
export function useHabitsSummary(): string {
  const today = useToday();
  const { active, doneBy } = useHabits();
  const due = active.filter((h) => habitDueOn(h, today));
  if (!due.length) return active.length ? t('Nothing due') : t('Set up');
  return `${due.filter((h) => doneBy.get(h.id)?.has(today)).length}/${due.length}`;
}
