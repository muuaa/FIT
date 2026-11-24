import { Award, CalendarRange, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { useHomeSettings } from '@/hooks/useHome';
import { useTable } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/lib/cn';
import { addDays, parseISODate } from '@/lib/date';
import { round1 } from '@/lib/format';
import { locale, t } from '@/lib/i18n';
import { habitDueOn, hm, money, sleepMinutes } from '@/lib/life';

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const range = (end: string, n: number) => Array.from({ length: n }, (_, i) => addDays(end, -i));

function useAll() {
  return {
    habits: useTable('habits').data ?? [],
    habitLogs: useTable('habit_logs').data ?? [],
    sleep: useTable('sleep_logs').data ?? [],
    checkins: useTable('checkins').data ?? [],
    water: useTable('water_days').data ?? [],
    sessions: useTable('workout_sessions').data ?? [],
    expenses: useTable('expenses').data ?? [],
    focus: useTable('focus_sessions').data ?? [],
    todos: useTable('todos').data ?? [],
    journal: useTable('journal').data ?? [],
    weights: useTable('bodyweight_logs').data ?? [],
    goals: useTable('goals').data ?? [],
    steps: useTable('steps_days').data ?? [],
  };
}

type Data = ReturnType<typeof useAll>;

function weekStats(d: Data, days: string[]) {
  const set = new Set(days);
  let due = 0;
  let done = 0;
  const logged = new Set(d.habitLogs.map((l) => `${l.habit_id}|${l.date}`));
  for (const day of days)
    for (const h of d.habits)
      if (habitDueOn(h, day)) {
        due++;
        if (logged.has(`${h.id}|${day}`)) done++;
      }
  return {
    habits: due ? Math.round((done / due) * 100) : null,
    sleep: avg(d.sleep.filter((s) => set.has(s.date)).map((s) => sleepMinutes(s.bed, s.wake))),
    mood: avg(d.checkins.filter((c) => set.has(c.date) && c.mood).map((c) => c.mood)),
    water: avg(d.water.filter((w) => set.has(w.date)).map((w) => w.ml)),
    workouts: d.sessions.filter((s) => set.has(s.date) && s.ended_at).length,
    spent: d.expenses.filter((e) => set.has(e.date)).reduce((a, e) => a + e.amount, 0),
    focus: d.focus.filter((f) => set.has(f.date)).reduce((a, f) => a + f.minutes, 0),
    todos: d.todos.filter((x) => x.done_at && set.has(x.done_at.slice(0, 10))).length,
  };
}

function Row({ label, now, prev, fmt, higherIsBetter = true }: { label: string; now: number | null; prev: number | null; fmt: (v: number) => string; higherIsBetter?: boolean }) {
  const diff = now !== null && prev !== null ? now - prev : null;
  const good = diff !== null && diff !== 0 && (diff > 0) === higherIsBetter;
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex-1 text-sm text-ink-2">{label}</span>
      <span className="tabular text-[15px] font-semibold">{now !== null ? fmt(now) : '—'}</span>
      <span className={cn('flex w-16 items-center justify-end gap-0.5 text-xs', diff === null || diff === 0 ? 'text-ink-3' : good ? 'text-fuel' : 'text-danger')}>
        {diff !== null && diff !== 0 && (diff > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />)}
        {prev !== null ? fmt(prev) : ''}
      </span>
    </div>
  );
}

function WeeklyReview({ d }: { d: Data }) {
  const today = useToday();
  const home = useHomeSettings();
  const now = weekStats(d, range(today, 7));
  const prev = weekStats(d, range(addDays(today, -7), 7));
  return (
    <Card title={t('Last 7 days')} icon={CalendarRange} accent="var(--color-accent)" action={<span className="text-[11px] text-ink-3">{t('vs week before')}</span>}>
      <div className="divide-y divide-white/[0.05]">
        <Row label={t('Habits done')} now={now.habits} prev={prev.habits} fmt={(v) => `${Math.round(v)}%`} />
        <Row label={t('Average sleep')} now={now.sleep} prev={prev.sleep} fmt={(v) => hm(v)} />
        <Row label={t('Average mood')} now={now.mood} prev={prev.mood} fmt={(v) => `${round1(v)}/5`} />
        <Row label={t('Water per day')} now={now.water} prev={prev.water} fmt={(v) => `${round1(v / 1000)} L`} />
        <Row label={t('Workouts')} now={now.workouts} prev={prev.workouts} fmt={(v) => String(v)} />
        <Row label={t('To-dos done')} now={now.todos} prev={prev.todos} fmt={(v) => String(v)} />
        <Row label={t('Spent')} now={now.spent} prev={prev.spent} fmt={(v) => money(Math.round(v), home.currency)} higherIsBetter={false} />
      </div>
    </Card>
  );
}

const MOOD_COLORS = ['#ff7a85', '#ffb47e', '#ffd86e', '#b9e56f', '#62e0ad'];

function YearInPixels({ d }: { d: Data }) {
  const today = useToday();
  const year = Number(today.slice(0, 4));
  const byDate = new Map(d.checkins.filter((c) => c.mood).map((c) => [c.date, c.mood]));
  const logged = [...byDate.keys()].filter((k) => k.startsWith(String(year))).length;
  return (
    <Card title={t('Year in pixels')} icon={CalendarRange} accent="var(--color-mood)" action={<span className="tabular text-[11px] text-ink-3">{t('{n} days', { n: logged })}</span>}>
      <div className="overflow-x-auto">
        <div className="grid min-w-[300px] gap-[3px]" style={{ gridTemplateColumns: 'auto repeat(31, minmax(0, 1fr))' }}>
          {Array.from({ length: 12 }, (_, m) => {
            const month = `${year}-${String(m + 1).padStart(2, '0')}`;
            const days = new Date(year, m + 1, 0).getDate();
            return [
              <div key={`l${m}`} className="pe-1 text-[9px] leading-[10px] text-ink-3">
                {new Date(year, m, 1).toLocaleDateString(locale(), { month: 'narrow' })}
              </div>,
              ...Array.from({ length: 31 }, (_, i) => {
                const date = `${month}-${String(i + 1).padStart(2, '0')}`;
                const mood = byDate.get(date);
                return (
                  <div
                    key={date}
                    title={i < days ? `${date}${mood ? ` · ${mood}/5` : ''}` : ''}
                    className={cn('aspect-square rounded-[2px]', i >= days ? 'opacity-0' : '', date === today && 'ring-1 ring-ink')}
                    style={{ background: i >= days ? 'transparent' : mood ? MOOD_COLORS[mood - 1] : date > today ? 'rgb(255 255 255 / 0.03)' : 'rgb(255 255 255 / 0.07)' }}
                  />
                );
              }),
            ];
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-ink-3">
        <span>{year}</span>
        <span className="flex items-center gap-1">
          {t('low')}
          {MOOD_COLORS.map((c) => (
            <span key={c} className="size-2.5 rounded-[2px]" style={{ background: c }} />
          ))}
          {t('great')}
        </span>
      </div>
    </Card>
  );
}

function Patterns({ d }: { d: Data }) {
  const items = useMemo(() => {
    const out: string[] = [];
    const trained = new Set(d.sessions.filter((s) => s.ended_at).map((s) => s.date));
    const moods = d.checkins.filter((c) => c.mood);
    const mOn = avg(moods.filter((c) => trained.has(c.date)).map((c) => c.mood));
    const mOff = avg(moods.filter((c) => !trained.has(c.date)).map((c) => c.mood));
    if (mOn !== null && mOff !== null && moods.filter((c) => trained.has(c.date)).length >= 3 && moods.filter((c) => !trained.has(c.date)).length >= 3) {
      const diff = round1(mOn - mOff);
      if (Math.abs(diff) >= 0.3)
        out.push(diff > 0 ? t('Your mood is {d} points higher on days you train.', { d: diff }) : t('Your mood is {d} points lower on training days. Maybe go lighter?', { d: -diff }));
    }
    const sl = d.sleep.map((s) => ({ date: s.date, min: sleepMinutes(s.bed, s.wake) }));
    const sAfter = avg(sl.filter((s) => trained.has(addDays(s.date, -1))).map((s) => s.min));
    const sRest = avg(sl.filter((s) => !trained.has(addDays(s.date, -1))).map((s) => s.min));
    if (sAfter !== null && sRest !== null && sl.length >= 6) {
      const diff = Math.round(sAfter - sRest);
      if (Math.abs(diff) >= 15)
        out.push(diff > 0 ? t('You sleep {m} more after a workout day.', { m: hm(diff) }) : t('You sleep {m} less after a workout day.', { m: hm(-diff) }));
    }
    const sleepMood = d.checkins
      .filter((c) => c.mood)
      .map((c) => ({ mood: c.mood, s: sl.find((x) => x.date === c.date)?.min }))
      .filter((x): x is { mood: number; s: number } => x.s !== undefined);
    if (sleepMood.length >= 6) {
      const good = avg(sleepMood.filter((x) => x.s >= 7 * 60).map((x) => x.mood));
      const bad = avg(sleepMood.filter((x) => x.s < 7 * 60).map((x) => x.mood));
      if (good !== null && bad !== null && good - bad >= 0.3) out.push(t('After 7+ hours of sleep your mood averages {a}/5, vs {b}/5 on shorter nights.', { a: round1(good), b: round1(bad) }));
    }
    const logged = new Set(d.habitLogs.map((l) => `${l.habit_id}|${l.date}`));
    let we = 0, weDue = 0, wd = 0, wdDue = 0;
    for (const day of range(addDays(new Date().toISOString().slice(0, 10), -1), 56))
      for (const h of d.habits)
        if (habitDueOn(h, day)) {
          const weekend = [5, 6].includes(parseISODate(day).getDay()); // Fri & Sat
          if (weekend) {
            weDue++;
            if (logged.has(`${h.id}|${day}`)) we++;
          } else {
            wdDue++;
            if (logged.has(`${h.id}|${day}`)) wd++;
          }
        }
    if (weDue >= 6 && wdDue >= 10) {
      const a = Math.round((we / weDue) * 100);
      const b = Math.round((wd / wdDue) * 100);
      if (Math.abs(a - b) >= 15) out.push(a < b ? t('Habits slip on weekends ({a}% vs {b}% on weekdays).', { a, b }) : t('You’re better at habits on weekends ({a}% vs {b}%).', { a, b }));
    }
    return out;
  }, [d]);
  return (
    <Card title={t('Patterns')} icon={Lightbulb} accent="var(--color-money)">
      {items.length ? (
        <ul className="space-y-2">
          {items.map((s) => (
            <li key={s} className="rounded-2xl bg-white/[0.04] px-3.5 py-3 text-sm leading-relaxed">
              💡 {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">{t('Keep logging mood, sleep, habits and workouts for a couple of weeks and patterns will show up here.')}</p>
      )}
    </Card>
  );
}

function Achievements({ d }: { d: Data }) {
  const workouts = d.sessions.filter((s) => s.ended_at).length;
  const bestHabitStreak = (() => {
    let best = 0;
    for (const h of d.habits) {
      const days = new Set(d.habitLogs.filter((l) => l.habit_id === h.id).map((l) => l.date));
      let cur = 0;
      for (const day of [...days].sort()) {
        cur = days.has(addDays(day, -1)) ? cur + 1 : 1;
        best = Math.max(best, cur);
      }
    }
    return best;
  })();
  const loggedDays = new Set([...d.water.map((w) => w.date), ...d.checkins.map((c) => c.date), ...d.habitLogs.map((l) => l.date)]).size;
  const list = [
    { emoji: '🏋️', name: t('First workout'), got: workouts >= 1 },
    { emoji: '💪', name: t('10 workouts'), got: workouts >= 10 },
    { emoji: '🏆', name: t('50 workouts'), got: workouts >= 50 },
    { emoji: '🔥', name: t('7-day habit streak'), got: bestHabitStreak >= 7 },
    { emoji: '🌋', name: t('30-day habit streak'), got: bestHabitStreak >= 30 },
    { emoji: '💧', name: t('Hydrated week'), got: d.water.filter((w) => w.ml >= 3000).length >= 7 },
    { emoji: '📓', name: t('10 journal entries'), got: d.journal.length >= 10 },
    { emoji: '🎯', name: t('Shared goal reached'), got: d.goals.some((g) => g.done_at) },
    { emoji: '📅', name: t('30 days logged'), got: loggedDays >= 30 },
    { emoji: '⚖️', name: t('14 weigh-ins'), got: d.weights.length >= 14 },
    { emoji: '🚶', name: t('10k-step day'), got: d.steps.some((s) => s.steps >= 10000) },
  ];
  const got = list.filter((a) => a.got).length;
  return (
    <Card title={t('Achievements')} icon={Award} accent="var(--color-lift)" action={<span className="tabular text-xs text-ink-3">{got}/{list.length}</span>}>
      <ul className="grid grid-cols-3 gap-2 lg:grid-cols-4">
        {list.map((a) => (
          <li key={a.name} className={cn('flex flex-col items-center gap-1 rounded-2xl px-1 py-3 text-center', a.got ? 'bg-lift/12' : 'bg-white/[0.03] opacity-45 grayscale')}>
            <span className="text-2xl">{a.emoji}</span>
            <span className="text-[11px] font-medium leading-tight">{a.name}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function InsightsPage() {
  const d = useAll();
  return (
    <>
      <PageHeader title={t('Insights')} back="/life" />
      <div className="space-y-3">
        <WeeklyReview d={d} />
        <Patterns d={d} />
        <YearInPixels d={d} />
        <Achievements d={d} />
      </div>
    </>
  );
}
