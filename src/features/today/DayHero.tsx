import { Check, ChevronRight, Sparkles } from 'lucide-react';
import { sendActivity } from '@/lib/activity';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ring } from '@/components/ui/Progress';
import { useProfile } from '@/hooks/useProfile';
import { useSupplementLogs, useSupplements } from '@/hooks/useSupplements';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { useSetWater, useWater } from '@/hooks/useWater';
import { useTodaySessions } from '@/hooks/useWorkouts';
import { tick } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import { habitDueOn, todosFor } from '@/lib/life';
import { dayLabel, dayTypeForDate } from '@/lib/split';
import { choreStatus, daysUntil } from '@/lib/plan';
import { usePartnerStore } from '@/lib/partner';
import { useSession } from '@/features/auth/session';

interface Item {
  key: string;
  label: string;
  done: boolean;
  accent: string;
  act: () => void;
}

/** Everything that makes up "today", for the progress ring and the next-up list. */
function useDayItems(): Item[] {
  const today = useToday();
  const navigate = useNavigate();
  const { data: profile } = useProfile();
  const { data: habits = [] } = useTable('habits');
  const { data: habitLogs = [] } = useTable('habit_logs');
  const { data: todos = [] } = useTable('todos');
  const { data: todoDone = [] } = useTable('todo_done');
  const { data: ml = 0 } = useWater(today);
  const setWater = useSetWater(today);
  const { data: supps = [] } = useSupplements();
  const { data: taken = [] } = useSupplementLogs(today);
  const { data: sessions = [] } = useTodaySessions();
  const { data: bills = [] } = useTable('bills');
  const { data: chores = [] } = useTable('chores');
  const choreActions = useTableActions('chores');
  const me = useSession((st) => st.user);
  const partner = usePartnerStore((st) => st.partner);
  const habitActions = useTableActions('habit_logs');
  const todoActions = useTableActions('todos');
  const doneActions = useTableActions('todo_done');

  return useMemo(() => {
    const out: Item[] = [];
    const scheduled = profile ? dayTypeForDate(profile.split_mode, new Date()) : null;
    if (scheduled)
      out.push({
        key: 'workout',
        label: t('{day} workout', { day: dayLabel(scheduled) }),
        done: sessions.length > 0,
        accent: 'var(--color-lift)',
        act: () => navigate('/train'),
      });
    const target = profile?.water_target_ml ?? 4000;
    out.push({
      key: 'water',
      label: ml >= target ? t('Water goal reached') : t('Drink {l} L more', { l: ((target - ml) / 1000).toFixed(1) }),
      done: ml >= target,
      accent: 'var(--color-water)',
      act: () => setWater.mutate(ml + (profile?.water_step_ml ?? 250)),
    });
    const active = supps.filter((s) => s.active);
    if (active.length)
      out.push({
        key: 'supps',
        label: t('Supplements ({done}/{total})', { done: active.filter((s) => taken.includes(s.id)).length, total: active.length }),
        done: active.every((s) => taken.includes(s.id)),
        accent: 'var(--color-supp)',
        act: () => navigate('/fuel'),
      });
    const logged = new Set(habitLogs.filter((l) => l.date === today).map((l) => l.habit_id));
    for (const h of habits.filter((x) => habitDueOn(x, today)).sort((a, b) => a.position - b.position))
      out.push({
        key: `h-${h.id}`,
        label: `${h.emoji} ${h.name}`,
        done: logged.has(h.id),
        accent: 'var(--color-habit)',
        act: () => (logged.has(h.id) ? habitActions.remove(`${h.id}|${today}`) : habitActions.put({ habit_id: h.id, date: today })),
      });
    const doneKeys = new Set(todoDone.map((d) => `${d.todo_id}|${d.date}`));
    for (const it of todosFor(todos, doneKeys, today, today))
      out.push({
        key: `t-${it.todo.id}`,
        label: it.todo.title,
        done: it.done,
        accent: 'var(--color-todo)',
        act: () =>
          it.todo.repeat === 'none'
            ? todoActions.patch(it.todo.id, { done_at: it.done ? null : new Date().toISOString() })
            : it.done
              ? doneActions.remove(`${it.todo.id}|${today}`)
              : doneActions.put({ todo_id: it.todo.id, date: today }),
      });
    for (const b of bills.filter((x) => daysUntil(x.next_due, today) <= 0))
      out.push({ key: `b-${b.id}`, label: t('Pay {name}', { name: `${b.emoji} ${b.name}` }), done: false, accent: 'var(--color-money)', act: () => navigate('/life/bills') });
    const meId = me?.id ?? 'me';
    for (const c of chores) {
      const st = choreStatus(c, today, meId, partner?.id ?? null);
      const doneToday = c.last_done === today;
      if ((st.days <= 0 && (st.turn === null || st.turn === meId)) || (doneToday && c.last_by === meId))
        out.push({
          key: `c-${c.id}`,
          label: `${c.emoji} ${c.name}`,
          done: doneToday,
          accent: 'var(--color-steps)',
          act: () => {
            if (doneToday) return;
            choreActions.put({ ...c, last_done: today, last_by: meId });
            sendActivity('chore', { title: c.name });
          },
        });
    }
    return out;
  }, [bills, chores, choreActions, me, partner, profile, sessions, ml, supps, taken, habits, habitLogs, todos, todoDone, today, navigate, setWater, habitActions, todoActions, doneActions]);
}

export function DayHero() {
  const items = useDayItems();
  const navigate = useNavigate();
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const next = items.filter((i) => !i.done).slice(0, 4);
  return (
    <section className="glass animate-page relative overflow-hidden rounded-[30px] p-5">
      <div
        className="pointer-events-none absolute -inset-16 opacity-70"
        style={{ background: 'radial-gradient(50% 50% at 20% 30%, color-mix(in oklab, var(--color-accent) 20%, transparent), transparent 70%)' }}
      />
      <div className="relative flex items-center gap-5">
        <Ring value={done} max={Math.max(1, items.length)} accent="var(--color-accent)" size={112} stroke={11}>
          <div>
            <div className="tabular text-[28px] font-bold leading-none tracking-tight">{pct}%</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">{t('of today')}</div>
          </div>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-[19px] font-semibold leading-tight tracking-tight">
            {items.length === 0
              ? t('A blank page')
              : done === items.length
                ? t('All done. Nice work!')
                : t('{done} of {total} done', { done, total: items.length })}
          </div>
          <p className="mt-1 text-[13px] text-ink-3">
            {items.length === 0
              ? t('Add habits or to-dos and they’ll show up here.')
              : done === items.length
                ? t('Enjoy the rest of your day.')
                : t('{n} left for today', { n: items.length - done })}
          </p>
        </div>
      </div>
      {next.length > 0 && (
        <div className="relative mt-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            <Sparkles size={12} className="text-accent" /> {t('Next up')}
          </div>
          <ul className="space-y-1.5">
            {next.map((i) => (
              <li key={i.key}>
                <button
                  type="button"
                  onClick={() => {
                    tick();
                    i.act();
                  }}
                  className="press flex w-full items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.035] py-2.5 ps-3 pe-2 text-start"
                >
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2')} style={{ borderColor: i.accent }}>
                    {i.done && <Check size={13} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14.5px]">{i.label}</span>
                  <ChevronRight size={16} className="shrink-0 text-ink-3 rtl:-scale-x-100" />
                </button>
              </li>
            ))}
          </ul>
          {items.length - done > next.length && (
            <button type="button" onClick={() => navigate('/plan')} className="mt-2 text-xs font-semibold text-accent">
              {t('+{n} more', { n: items.length - done - next.length })}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
