import { Check, ChevronRight, SlidersHorizontal, Sparkles } from 'lucide-react';
import { sendActivity } from '@/lib/activity';
import { useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useUpdateProfile } from '@/hooks/useProfile';
import type { DayItemKind } from '@/types/db';
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
import { habitDueOn } from '@/lib/life';
import { dayLabel, dayTypeForDate } from '@/lib/split';
import { choreStatus, daysUntil } from '@/lib/plan';
import { usePartnerStore } from '@/lib/partner';
import { useSession } from '@/features/auth/session';

interface Item {
  kind: DayItemKind;
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
  const { data: routines = [] } = useTable('routines');
  const { data: routineLogs = [] } = useTable('routine_logs');
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

  return useMemo(() => {
    const out: Item[] = [];
    const scheduled = profile ? dayTypeForDate(profile.split_mode, new Date()) : null;
    if (scheduled)
      out.push({
        kind: 'workout',
        key: 'workout',
        label: t('{day} workout', { day: dayLabel(scheduled) }),
        done: sessions.length > 0,
        accent: 'var(--color-lift)',
        act: () => navigate('/train'),
      });
    const target = profile?.water_target_ml ?? 4000;
    out.push({
      kind: 'water',
      key: 'water',
      label: ml >= target ? t('Water goal reached') : t('Drink {l} L more', { l: ((target - ml) / 1000).toFixed(1) }),
      done: ml >= target,
      accent: 'var(--color-water)',
      act: () => setWater.mutate(ml + (profile?.water_step_ml ?? 250)),
    });
    const active = supps.filter((s) => s.active);
    if (active.length)
      out.push({
        kind: 'supplements',
        key: 'supps',
        label: t('Supplements ({done}/{total})', { done: active.filter((s) => taken.includes(s.id)).length, total: active.length }),
        done: active.every((s) => taken.includes(s.id)),
        accent: 'var(--color-supp)',
        act: () => navigate('/fuel'),
      });
    const logged = new Set(habitLogs.filter((l) => l.date === today).map((l) => l.habit_id));
    for (const h of habits.filter((x) => habitDueOn(x, today)).sort((a, b) => a.position - b.position))
      out.push({
        kind: 'habits',
        key: `h-${h.id}`,
        label: `${h.emoji} ${h.name}`,
        done: logged.has(h.id),
        accent: 'var(--color-habit)',
        act: () => (logged.has(h.id) ? habitActions.remove(`${h.id}|${today}`) : habitActions.put({ habit_id: h.id, date: today })),
      });
    for (const r of [...routines].sort((a, b) => a.position - b.position)) {
      const doneSteps = routineLogs.find((l) => l.routine_id === r.id && l.date === today)?.done.length ?? 0;
      out.push({
        kind: 'routines',
        key: `r-${r.id}`,
        label: `${r.emoji} ${r.name} (${doneSteps}/${r.steps.length})`,
        done: r.steps.length > 0 && doneSteps >= r.steps.length,
        accent: 'var(--color-sleep)',
        act: () => navigate('/plan'),
      });
    }
    for (const b of bills.filter((x) => daysUntil(x.next_due, today) <= 0))
      out.push({ kind: 'bills', key: `b-${b.id}`, label: t('Pay {name}', { name: `${b.emoji} ${b.name}` }), done: false, accent: 'var(--color-money)', act: () => navigate('/life/bills') });
    const meId = me?.id ?? 'me';
    for (const c of chores) {
      const st = choreStatus(c, today, meId, partner?.id ?? null);
      const doneToday = c.last_done === today;
      if ((st.days <= 0 && (st.turn === null || st.turn === meId)) || (doneToday && c.last_by === meId))
        out.push({
          kind: 'chores',
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
    const pick = profile?.day_items;
    return pick ? out.filter((i) => pick.includes(i.kind)) : out;
  }, [bills, chores, choreActions, me, partner, profile, sessions, ml, supps, taken, habits, habitLogs, routines, routineLogs, today, navigate, setWater, habitActions]);
}

const KINDS: { kind: DayItemKind; label: string; hint: string }[] = [
  { kind: 'habits', label: 'Habits', hint: 'Each habit due today' },
  { kind: 'routines', label: 'Routines', hint: 'Morning and evening routines' },
  { kind: 'water', label: 'Water', hint: 'Reaching your daily water goal' },
  { kind: 'workout', label: 'Workout', hint: 'On your training days' },
  { kind: 'supplements', label: 'Supplements', hint: 'Taking everything on your shelf' },
  { kind: 'chores', label: 'Chores', hint: 'Chores due today (your turn)' },
  { kind: 'bills', label: 'Bills', hint: 'Bills due today' },
];
const ALL_KINDS = KINDS.map((k) => k.kind);

/** What the "Your day" ring is, and which things count towards it. */
function DayHeroSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const on = profile?.day_items ?? ALL_KINDS;
  const set = (k: DayItemKind, v: boolean) => update.mutate({ day_items: v ? [...on, k] : on.filter((x) => x !== k) });
  return (
    <Sheet open={open} onClose={onClose} title={t('Your day')}>
      <p className="text-sm leading-relaxed text-ink-2">
        {t(
          'This is your day at a glance. The ring shows how much of today’s list you’ve finished, and “Next up” shows what’s left, so you can tick things off right here. Choose what counts:',
        )}
      </p>
      <ul className="mt-4 space-y-1.5">
        {KINDS.map((k) => (
          <li key={k.kind} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{t(k.label)}</div>
              <div className="text-xs text-ink-3">{t(k.hint)}</div>
            </div>
            <Toggle checked={on.includes(k.kind)} label={t(k.label)} onChange={(v) => set(k.kind, v)} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-3">{t('To-dos live in the Plan tab.')}</p>
    </Sheet>
  );
}

export function DayHero() {
  const items = useDayItems();
  const [settings, setSettings] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const left = items.filter((i) => !i.done);
  const next = showAll ? left : left.slice(0, 4);
  return (
    <section className="glass animate-page relative overflow-hidden rounded-[30px] p-5">
      <div
        className="pointer-events-none absolute -inset-16 opacity-70"
        style={{ background: 'radial-gradient(50% 50% at 20% 30%, color-mix(in oklab, var(--color-accent) 20%, transparent), transparent 70%)' }}
      />
      <button
        type="button"
        aria-label={t('Customize your day')}
        onClick={() => setSettings(true)}
        className="press absolute end-3 top-3 z-10 grid size-9 place-items-center rounded-full text-ink-3 active:bg-white/[0.06]"
      >
        <SlidersHorizontal size={17} />
      </button>
      <DayHeroSettings open={settings} onClose={() => setSettings(false)} />
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
              ? t('Add habits or routines and they’ll show up here.')
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
            <button type="button" onClick={() => setShowAll(true)} className="mt-2 text-xs font-semibold text-accent">
              {t('+{n} more', { n: items.length - done - next.length })}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
