/**
 * "Both of you on the same screen": read-only cards showing the other person's data on each page.
 * The other person is your partner, or you while the app is showing your partner's day. Their rows
 * are read straight from the server (each of you can read the other's synced data).
 */
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, HeartHandshake } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { ENERGY, MOOD, STRESS } from '@/features/life/checkin';
import { relativeDay } from '@/lib/date';
import { t, tn } from '@/lib/i18n';
import { useOtherPerson, type Partner } from '@/lib/partner';
import type { SupplementLog, WaterDay } from '@/lib/localDb';
import { supabase } from '@/lib/supabase';
import type {
  BodyweightLog,
  CheckIn,
  FocusSession,
  FoodEntry,
  Note,
  Profile,
  Routine,
  RoutineLog,
  SleepLog,
  StepsDay,
  Supplement,
  WorkoutSession,
} from '@/types/db';

type Row = { tbl: string; data: Record<string, unknown> };

const opts = {
  staleTime: 30_000,
  refetchInterval: 60_000,
  refetchOnWindowFocus: true,
  retry: 1,
} as const;

/** Fetch some of a person's tables, optionally only the rows for one day. */
async function fetchRows(userId: string, tables: string[], date?: string): Promise<Row[]> {
  let q = supabase!.from('records').select('tbl,data').eq('user_id', userId).eq('deleted', false).in('tbl', tables);
  if (date) q = q.eq('data->>date', date);
  const { data, error } = await q.limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

/** Latest rows of one date-keyed table, newest first. */
async function fetchLatest(userId: string, tbl: string, n: number): Promise<Row[]> {
  const { data, error } = await supabase!
    .from('records')
    .select('tbl,data')
    .eq('user_id', userId)
    .eq('deleted', false)
    .eq('tbl', tbl)
    .order('data->>date', { ascending: false })
    .limit(n);
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

const pick = <T,>(rows: Row[] | undefined, tbl: string) => (rows ?? []).filter((r) => r.tbl === tbl).map((r) => r.data as unknown as T);

function useOther<T>(key: string, fn: (who: Partner) => Promise<T>, deps: unknown[] = []) {
  const who = useOtherPerson();
  const q = useQuery({
    queryKey: ['other', key, who?.id, ...deps],
    queryFn: () => fn(who!),
    enabled: Boolean(who && supabase),
    ...opts,
  });
  return { who, ...q };
}

/** Card frame with the other person's initial and name. */
function OtherCard({ who, title, children }: { who: Partner; title?: string; children: ReactNode }) {
  return (
    <Card title={title ?? who.name} icon={HeartHandshake} accent="var(--color-us)">
      {children}
    </Card>
  );
}

function Line({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm text-ink-3">{label}</span>
      <span className="tabular text-end text-sm font-semibold">
        {value}
        {sub && <span className="ms-1 text-xs font-normal text-ink-3">{sub}</span>}
      </span>
    </div>
  );
}

const Loading = () => <p className="text-sm text-ink-3">{t('Loading…')}</p>;
const Failed = () => <p className="text-sm text-ink-3">{t('Couldn’t load. Check your connection.')}</p>;
const round1 = (n: number) => Math.round(n * 10) / 10;
const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`;

function sleepMinutes(s: SleepLog): number {
  const [bh, bm] = s.bed.split(':').map(Number);
  const [wh, wm] = s.wake.split(':').map(Number);
  let m = wh * 60 + wm - (bh * 60 + bm);
  if (m <= 0) m += 1440;
  return m + (s.nap_min || 0);
}

function profileOf(rows: Row[] | undefined): Partial<Profile> {
  return pick<Partial<Profile>>(rows, 'profile')[0] ?? {};
}

// ---------------------------------------------------------------- nutrition

export function OtherFuel({ date }: { date: string }) {
  const { who, data, isLoading, isError } = useOther(
    'fuel',
    async (w) => {
      const [day, base] = await Promise.all([
        fetchRows(w.id, ['food_entries', 'water_days', 'supplement_logs'], date),
        fetchRows(w.id, ['profile', 'supplements']),
      ]);
      return [...day, ...base];
    },
    [date],
  );
  if (!who) return null;
  const p = profileOf(data);
  const food = pick<FoodEntry>(data, 'food_entries');
  const kcal = food.reduce((s, f) => s + (f.kcal || 0), 0);
  const protein = food.reduce((s, f) => s + (f.protein_g || 0), 0);
  const water = pick<WaterDay>(data, 'water_days')[0]?.ml ?? 0;
  const supps = pick<Supplement>(data, 'supplements').filter((s) => s.active);
  const taken = new Set(pick<SupplementLog>(data, 'supplement_logs').map((l) => l.supplement_id));
  return (
    <OtherCard who={who}>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <Failed />
      ) : (
        <>
          <div className="divide-y divide-white/[0.05]">
            <Line
              label={t('Calories')}
              value={Math.round(kcal).toLocaleString()}
              sub={p.kcal_target ? `/ ${p.kcal_target.toLocaleString()}` : undefined}
            />
            <Line label={t('Protein')} value={`${Math.round(protein)} g`} sub={p.protein_target_g ? `/ ${p.protein_target_g} g` : undefined} />
            <Line
              label={t('Water')}
              value={`${round1(water / 1000)} L`}
              sub={p.water_target_ml ? `/ ${round1(p.water_target_ml / 1000)} L` : undefined}
            />
            {supps.length > 0 && <Line label={t('Supplements')} value={`${supps.filter((s) => taken.has(s.id)).length}/${supps.length}`} />}
          </div>
          {food.length > 0 && (
            <p className="mt-2 line-clamp-3 text-xs text-ink-3">
              {food
                .sort((a, b) => a.created_at.localeCompare(b.created_at))
                .map((f) => f.name)
                .join(' · ')}
            </p>
          )}
        </>
      )}
    </OtherCard>
  );
}

// ---------------------------------------------------------------- training

export function OtherTrain({ date }: { date: string }) {
  const { who, data, isLoading, isError } = useOther(
    'train',
    async (w) => {
      const [today, last] = await Promise.all([fetchRows(w.id, ['workout_sessions', 'cardio_logs'], date), fetchLatest(w.id, 'workout_sessions', 5)]);
      const sessions = pick<WorkoutSession>(today, 'workout_sessions');
      let sets = 0;
      if (sessions.length) {
        const { count } = await supabase!
          .from('records')
          .select('row_id', { count: 'exact', head: true })
          .eq('user_id', w.id)
          .eq('deleted', false)
          .eq('tbl', 'set_logs')
          .in(
            'data->>session_id',
            sessions.map((s) => s.id),
          );
        sets = count ?? 0;
      }
      return {
        sessions,
        cardio: today.filter((r) => r.tbl === 'cardio_logs').length,
        sets,
        last: pick<WorkoutSession>(last, 'workout_sessions').find((s) => s.ended_at),
      };
    },
    [date],
  );
  if (!who) return null;
  const s = data?.sessions.find((x) => x.ended_at) ?? data?.sessions[0];
  return (
    <OtherCard who={who}>
      {isLoading ? (
        <Loading />
      ) : isError || !data ? (
        <Failed />
      ) : (
        <div className="divide-y divide-white/[0.05]">
          <Line
            label={relativeDay(date)}
            value={s ? `${t(s.day_type)}${s.ended_at ? ' ✓' : ` · ${t('In progress')}`}` : t('No workout')}
            sub={s?.duration_seconds ? `${Math.round(s.duration_seconds / 60)} ${t('min')}` : undefined}
          />
          {s && <Line label={t('Sets')} value={data.sets} />}
          {data.cardio > 0 && <Line label={t('Cardio')} value={tn(data.cardio, '{n} session', '{n} sessions')} />}
          {!s && data.last && <Line label={t('Last workout')} value={t(data.last.day_type)} sub={relativeDay(data.last.date)} />}
        </div>
      )}
    </OtherCard>
  );
}

// ---------------------------------------------------------------- body

export function OtherBody({ date, steps = false }: { date: string; steps?: boolean }) {
  const { who, data, isLoading, isError } = useOther(
    'body',
    async (w) => {
      const [weights, day, base, meas] = await Promise.all([
        fetchLatest(w.id, 'bodyweight_logs', 30),
        fetchRows(w.id, ['steps_days'], date),
        fetchRows(w.id, ['profile']),
        fetchLatest(w.id, 'measurements', 1),
      ]);
      return [...weights, ...day, ...base, ...meas];
    },
    [date],
  );
  if (!who) return null;
  const weights = pick<BodyweightLog>(data, 'bodyweight_logs');
  const latest = weights[0];
  const weekAgo = latest && weights.find((w) => w.date <= shift(latest.date, -7));
  const change = latest && weekAgo ? round1(latest.weight_kg - weekAgo.weight_kg) : null;
  const stepsToday = pick<StepsDay>(data, 'steps_days')[0]?.steps ?? 0;
  const p = profileOf(data);
  const waist = pick<{ waist_cm: number | null; date: string }>(data, 'measurements')[0];
  return (
    <OtherCard who={who}>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <Failed />
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {steps && (
            <Line label={t('Steps')} value={stepsToday.toLocaleString()} sub={p.steps_target ? `/ ${p.steps_target.toLocaleString()}` : undefined} />
          )}
          <Line
            label={t('Bodyweight')}
            value={latest ? `${latest.weight_kg} kg` : '—'}
            sub={latest ? `${change !== null ? `${change > 0 ? '+' : ''}${change} ${t('this week')} · ` : ''}${relativeDay(latest.date)}` : undefined}
          />
          {waist?.waist_cm ? <Line label={t('Waist')} value={`${waist.waist_cm} cm`} sub={relativeDay(waist.date)} /> : null}
        </div>
      )}
    </OtherCard>
  );
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- sleep

export function OtherSleep({ date }: { date: string }) {
  const { who, data, isLoading, isError } = useOther(
    'sleep',
    async (w) => [...(await fetchLatest(w.id, 'sleep_logs', 7)), ...(await fetchRows(w.id, ['profile']))],
    [date],
  );
  if (!who) return null;
  const logs = pick<SleepLog>(data, 'sleep_logs');
  const last = logs.find((l) => l.date === date);
  const avg = logs.length ? logs.reduce((s, l) => s + sleepMinutes(l), 0) / logs.length : null;
  return (
    <OtherCard who={who}>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <Failed />
      ) : (
        <div className="divide-y divide-white/[0.05]">
          <Line
            label={t('Last night')}
            value={last ? hm(sleepMinutes(last)) : '—'}
            sub={last ? `${last.bed}–${last.wake} · ${'★'.repeat(last.quality)}` : undefined}
          />
          {avg !== null && <Line label={t('Average')} value={hm(avg)} sub={tn(logs.length, '{n} night', '{n} nights')} />}
          {last?.note && <p className="pt-2 text-xs text-ink-3">{last.note}</p>}
        </div>
      )}
    </OtherCard>
  );
}

// ---------------------------------------------------------------- mood

export function OtherMood({ date }: { date: string }) {
  const { who, data, isLoading, isError } = useOther('mood', (w) => fetchRows(w.id, ['checkins'], date), [date]);
  if (!who) return null;
  const c = pick<CheckIn>(data, 'checkins')[0];
  return (
    <OtherCard who={who}>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <Failed />
      ) : !c ? (
        <p className="text-sm text-ink-3">{t('No check-in yet')}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              [t('Mood'), MOOD[c.mood - 1]],
              [t('Energy'), ENERGY[c.energy - 1]],
              [t('Stress'), STRESS[c.stress - 1]],
            ].map(([label, emoji]) => (
              <div key={label} className="rounded-2xl bg-white/[0.04] py-2">
                <div className="text-2xl">{emoji ?? '—'}</div>
                <div className="text-[11px] text-ink-3">{label}</div>
              </div>
            ))}
          </div>
          {c.note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-2">{c.note}</p>}
        </>
      )}
    </OtherCard>
  );
}

// ---------------------------------------------------------------- plan (routines + focus)

export function OtherPlan({ date }: { date: string }) {
  const { who, data, isLoading, isError } = useOther(
    'plan',
    async (w) => [...(await fetchRows(w.id, ['routine_logs', 'focus_sessions'], date)), ...(await fetchRows(w.id, ['routines']))],
    [date],
  );
  if (!who) return null;
  const routines = pick<Routine>(data, 'routines');
  const logs = pick<RoutineLog>(data, 'routine_logs');
  const focus = pick<FocusSession>(data, 'focus_sessions').reduce((s, f) => s + f.minutes, 0);
  if (!isLoading && !isError && !routines.length && !focus) return null;
  return (
    <OtherCard who={who}>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <Failed />
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {routines.map((r) => {
            const done = logs.find((l) => l.routine_id === r.id)?.done.length ?? 0;
            return <Line key={r.id} label={`${r.emoji} ${r.name}`} value={`${done}/${r.steps.length}`} />;
          })}
          {focus > 0 && <Line label={t('Focus')} value={`${focus} ${t('min')}`} />}
        </div>
      )}
    </OtherCard>
  );
}

// ---------------------------------------------------------------- notes

export function OtherNotes() {
  const { who, data, isLoading, isError } = useOther('notes', (w) => fetchRows(w.id, ['notes']));
  const [open, setOpen] = useState<string | null>(null);
  if (!who) return null;
  const notes = pick<Note>(data, 'notes').sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at));
  return (
    <OtherCard who={who} title={t('{name}’s notes', { name: who.name })}>
      {isLoading ? (
        <Loading />
      ) : isError ? (
        <Failed />
      ) : !notes.length ? (
        <p className="text-sm text-ink-3">{t('No notes yet')}</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {notes.map((n) => {
            const isOpen = open === n.id;
            return (
              <li key={n.id}>
                <button type="button" onClick={() => setOpen(isOpen ? null : n.id)} className="flex w-full items-start gap-2 py-2.5 text-start">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {n.pinned && '📌 '}
                      {n.title || t('Untitled')}
                    </div>
                    <div className={isOpen ? 'mt-1 whitespace-pre-wrap break-words text-sm text-ink-2' : 'line-clamp-1 text-xs text-ink-3'}>
                      {n.body}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="mt-0.5 text-ink-3" /> : <ChevronDown size={16} className="mt-0.5 text-ink-3" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </OtherCard>
  );
}
