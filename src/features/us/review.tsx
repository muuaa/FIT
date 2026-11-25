/** Weekly review: the week in numbers for both of you, then a few questions each, side by side. */
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Lock, RefreshCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/features/auth/session';
import { useTableActions, useTableEveryone } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/lib/cn';
import { addDays, parseISODate } from '@/lib/date';
import { t } from '@/lib/i18n';
import { fetchWeekSnapshot, usePartnerStore, type WeekSnapshot } from '@/lib/partner';
import { weekOf } from '@/lib/plan';
import { supabase } from '@/lib/supabase';
import type { WeekReview } from '@/types/db';

const ACCENT = 'var(--color-us)';
const MOOD = ['😞', '😕', '😐', '🙂', '😄'];

function weekLabel(start: string): string {
  const a = parseISODate(start);
  const b = parseISODate(addDays(start, 6));
  const same = a.getMonth() === b.getMonth();
  return `${a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString(undefined, same ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
}

const hm = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

const QUESTIONS: { key: 'wins' | 'hard' | 'proud' | 'focus'; label: string; hint: string }[] = [
  { key: 'wins', label: 'What went well this week?', hint: 'Wins, big or small' },
  { key: 'hard', label: 'What was hard, or could be better?', hint: 'Be honest, be kind' },
  { key: 'proud', label: 'What are you proud of {name} for?', hint: 'Tell them' },
  { key: 'focus', label: 'Your one focus for next week', hint: 'Just one thing' },
];

function useWeekStats(userId: string | undefined, start: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return useQuery({
    queryKey: ['week-snap', userId, start],
    queryFn: () => fetchWeekSnapshot(userId!, days),
    enabled: Boolean(userId && supabase),
    staleTime: 60_000,
    retry: 1,
  });
}

function StatRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2">
      <div className="tabular text-end text-[15px] font-semibold">{a}</div>
      <div className="w-24 text-center text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
      <div className="tabular text-[15px] font-semibold">{b}</div>
    </div>
  );
}

const show = {
  habits: (s?: WeekSnapshot) => (!s ? '…' : s.habitsDue ? `${Math.round((s.habitsDone / s.habitsDue) * 100)}%` : '—'),
  water: (s?: WeekSnapshot) => (!s ? '…' : `${s.waterDays}/7`),
  workouts: (s?: WeekSnapshot) => (!s ? '…' : String(s.workouts)),
  mood: (s?: WeekSnapshot) => (!s ? '…' : s.mood ? MOOD[Math.round(s.mood) - 1] : '—'),
  sleep: (s?: WeekSnapshot) => (!s ? '…' : s.sleepMin !== null ? hm(s.sleepMin) : '—'),
  journal: (s?: WeekSnapshot) => (!s ? '…' : `${s.journalDays}/7`),
};

function Area({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(64, el.scrollHeight)}px`;
  }, [value]);
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={1000}
        rows={2}
        className="w-full resize-none rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-us/60"
      />
    </label>
  );
}

const empty = (week: string, by: string): WeekReview => ({ week, by, wins: '', hard: '', proud: '', focus: '', score: 0, updated_at: '' });
const written = (r?: WeekReview) => Boolean(r && (r.wins.trim() || r.hard.trim() || r.proud.trim() || r.focus.trim() || r.score));

export function ReviewPage() {
  const today = useToday();
  const me = useSession((s) => s.user);
  const { partner, viewing, self } = usePartnerStore();
  const [params, setParams] = useSearchParams();
  const thisWeek = weekOf(today)[0];
  const week = params.get('week') ?? thisWeek;
  const setWeek = (w: string) => setParams(w === thisWeek ? {} : { week: w }, { replace: true });
  const { data: rows = [] } = useTableEveryone('reviews');
  const actions = useTableActions('reviews');
  // While looking at your partner's side the page is theirs, read-only.
  const left = viewing ? partner : me ? { id: me.id, name: t('You') } : null;
  const right = viewing ? (self ?? (me ? { id: me.id, name: t('You') } : null)) : partner;
  const mine = rows.find((r) => r.week === week && r.by === left?.id);
  const theirs = rows.find((r) => r.week === week && r.by === right?.id);
  const statsA = useWeekStats(left?.id, week);
  const statsB = useWeekStats(right?.id, week);

  // Your answers, saved as you type.
  const [draft, setDraft] = useState<WeekReview>(() => mine ?? empty(week, me?.id ?? ''));
  const [seeded, setSeeded] = useState(`${week}|${left?.id}`);
  if (seeded !== `${week}|${left?.id}`) {
    setSeeded(`${week}|${left?.id}`);
    setDraft(mine ?? empty(week, me?.id ?? ''));
  }
  const timer = useRef<number | undefined>(undefined);
  const change = (patch: Partial<WeekReview>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const { by: _by, ...row } = { ...next, week, updated_at: new Date().toISOString() };
      void _by;
      actions.put(row);
    }, 600);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const past = [...new Set(rows.map((r) => r.week))].filter((w) => w !== week).sort().reverse().slice(0, 12);
  const scoreOf = (w: string, id?: string) => rows.find((r) => r.week === w && r.by === id)?.score || null;
  const canWrite = !viewing && week <= thisWeek;
  const unlocked = written(mine) || viewing;

  return (
    <>
      <PageHeader title={t('Weekly review')} subtitle={t('Week of {range}', { range: weekLabel(week) })} />
      <div className="mb-3 flex items-center justify-between px-1">
        <IconButton label={t('Previous week')} onClick={() => setWeek(addDays(week, -7))}>
          <ChevronLeft size={20} className="rtl:-scale-x-100" />
        </IconButton>
        <button type="button" onClick={() => setWeek(thisWeek)} className="press rounded-full px-3 py-1.5 text-sm font-semibold">
          {weekLabel(week)}
          {week !== thisWeek && <span className="ms-2 text-xs font-medium text-accent">{t('This week')}</span>}
        </button>
        <IconButton label={t('Next week')} disabled={week >= thisWeek} onClick={() => setWeek(addDays(week, 7))}>
          <ChevronRight size={20} className="rtl:-scale-x-100" />
        </IconButton>
      </div>
      <div className="space-y-3">
        {left && (
          <Card title={t('The week in numbers')} icon={RefreshCcw} accent={ACCENT}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/[0.06] pb-2 text-sm font-semibold">
              <div className="text-end text-accent">{left.name}</div>
              <div className="w-24" />
              <div className="text-us">{right?.name ?? ''}</div>
            </div>
            <div className="divide-y divide-white/[0.05]">
              <StatRow label={t('Habits')} a={show.habits(statsA.data)} b={right ? show.habits(statsB.data) : ''} />
              <StatRow label={t('Water goal')} a={show.water(statsA.data)} b={right ? show.water(statsB.data) : ''} />
              <StatRow label={t('Workouts')} a={show.workouts(statsA.data)} b={right ? show.workouts(statsB.data) : ''} />
              <StatRow label={t('Mood')} a={show.mood(statsA.data)} b={right ? show.mood(statsB.data) : ''} />
              <StatRow label={t('Sleep')} a={show.sleep(statsA.data)} b={right ? show.sleep(statsB.data) : ''} />
              <StatRow label={t('Journal')} a={show.journal(statsA.data)} b={right ? show.journal(statsB.data) : ''} />
            </div>
          </Card>
        )}

        {canWrite ? (
          <Card title={t('Your review')} icon={RefreshCcw} accent="var(--color-accent)">
            <div className="space-y-4">
              {QUESTIONS.map((q) => (
                <Area
                  key={q.key}
                  label={t(q.label, { name: partner?.name ?? t('your partner') })}
                  placeholder={t(q.hint)}
                  value={draft[q.key]}
                  onChange={(v) => change({ [q.key]: v })}
                />
              ))}
              <div>
                <span className="mb-1.5 block text-sm font-semibold">{t('How was your week, 1 to 10?')}</span>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={draft.score === n}
                      onClick={() => change({ score: draft.score === n ? 0 : n })}
                      className={cn('press tabular h-10 rounded-xl text-sm font-bold', draft.score === n ? 'bg-accent text-bg' : 'bg-white/[0.05] text-ink-2')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-ink-3">{t('Saved as you type.')}</p>
            </div>
          </Card>
        ) : (
          mine && <Answers title={t('{name}’s review', { name: left?.name ?? '' })} r={mine} partnerName={right?.name ?? ''} />
        )}

        {right &&
          (theirs && written(theirs) ? (
            unlocked ? (
              <Answers title={t('{name}’s review', { name: right.name })} r={theirs} partnerName={left?.name ?? ''} accent={ACCENT} />
            ) : (
              <Card title={t('{name}’s review', { name: right.name })} icon={Lock} accent={ACCENT}>
                <p className="text-sm text-ink-2">{t('{name} has written theirs. Write yours to see it, so neither of you is swayed.', { name: right.name })}</p>
              </Card>
            )
          ) : (
            <Card title={t('{name}’s review', { name: right.name })} icon={RefreshCcw} accent={ACCENT}>
              <p className="text-sm text-ink-3">{t('Not written yet.')}</p>
            </Card>
          ))}

        {past.length > 0 && (
          <Card title={t('Past weeks')} icon={RefreshCcw} accent={ACCENT}>
            <ul className="divide-y divide-white/[0.05]">
              {past.map((w) => (
                <li key={w}>
                  <button type="button" onClick={() => setWeek(w)} className="press flex w-full items-center justify-between py-2.5 text-start">
                    <span className="text-sm font-medium">{weekLabel(w)}</span>
                    <span className="tabular flex gap-3 text-sm">
                      <span className="text-accent">{scoreOf(w, left?.id) ?? '–'}</span>
                      <span className="text-us">{scoreOf(w, right?.id) ?? '–'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

function Answers({ title, r, partnerName, accent = 'var(--color-accent)' }: { title: string; r: WeekReview; partnerName: string; accent?: string }) {
  return (
    <Card title={title} icon={RefreshCcw} accent={accent} action={r.score ? <span className="tabular text-sm font-bold" style={{ color: accent }}>{r.score}/10</span> : undefined}>
      <div className="space-y-3">
        {QUESTIONS.map((q) =>
          r[q.key].trim() ? (
            <div key={q.key}>
              <div className="text-xs font-medium uppercase tracking-wider text-ink-3">{t(q.label, { name: partnerName })}</div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{r[q.key]}</p>
            </div>
          ) : null,
        )}
      </div>
    </Card>
  );
}

/** The Us tab's card: this week's review, who has written it, and a way in. */
export function ReviewCard() {
  const today = useToday();
  const me = useSession((s) => s.user);
  const { partner, viewing, self } = usePartnerStore();
  const { data: rows = [] } = useTableEveryone('reviews');
  const week = weekOf(today)[0];
  const left = viewing ? partner : me ? { id: me.id, name: t('You') } : null;
  const right = viewing ? (self ?? null) : partner;
  const done = (id?: string) => written(rows.find((r) => r.week === week && r.by === id));
  // The week ends on Friday: nudge from Thursday.
  const wd = parseISODate(today).getDay();
  const due = wd === 4 || wd === 5;
  return (
    <Card
      title={t('Weekly review')}
      icon={RefreshCcw}
      accent={ACCENT}
      action={
        <Link to="/us/review" className="text-xs font-semibold text-us">
          {t('Open')}
        </Link>
      }
    >
      <p className="text-sm text-ink-2">
        {done(left?.id)
          ? right && !done(right.id)
            ? t('Yours is done. Waiting for {name}.', { name: right.name })
            : t('Both written. Read each other’s.')
          : due
            ? t('The week is wrapping up: how did it go?')
            : t('Wins, what was hard, and one focus for next week. Takes 3 minutes.')}
      </p>
      <div className="mt-3 flex gap-2">
        {[left, right].filter(Boolean).map((p) => (
          <span key={p!.id} className={cn('rounded-full px-3 py-1 text-xs font-semibold', done(p!.id) ? 'bg-us/15 text-us' : 'bg-white/[0.05] text-ink-3')}>
            {p!.name} {done(p!.id) ? '✓' : '…'}
          </span>
        ))}
      </div>
      <Link to="/us/review" className="press mt-3 flex h-11 items-center justify-center rounded-2xl bg-us/15 text-sm font-semibold text-us">
        {done(left?.id) ? t('See this week’s review') : t('Write this week’s review')}
      </Link>
    </Card>
  );
}
