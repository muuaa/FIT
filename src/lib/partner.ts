/** The other person in the app: find them, and switch the whole app to view their data. */
import { create } from 'zustand';
import { t } from './i18n';
import { queryClient } from './queryClient';
import { all, enterView, exitView, getProfile, TABLE_NAMES, type TableName } from './localDb';
import { supabase } from './supabase';
import { JOINT_TABLES, pauseSync } from './sync';
import type { Profile } from '@/types/db';

export interface Partner {
  id: string;
  name: string;
}

interface PartnerState {
  partner: Partner | null;
  /** You (kept so your name still shows correctly while the app is showing your partner's data). */
  self: Partner | null;
  viewing: boolean;
  loading: boolean;
}

export const usePartnerStore = create<PartnerState>()(() => ({ partner: null, self: null, viewing: false, loading: false }));

/** Your own name, read from your profile (only valid while not viewing the partner). */
function ownName(): string {
  return getProfile().display_name?.trim() || t('Me');
}

/** The other person relative to whose data is on screen: your partner, or you while viewing them. */
export function useOtherPerson(): Partner | null {
  const { partner, self, viewing } = usePartnerStore();
  return viewing ? self : partner;
}

/** Look up the partner (the other account). Their profile row is readable to us. */
export async function findPartner(myId: string): Promise<void> {
  if (!supabase) return;
  if (!usePartnerStore.getState().viewing) usePartnerStore.setState({ self: { id: myId, name: ownName() } });
  const { data } = await supabase.from('records').select('user_id,data').eq('tbl', 'profile').neq('user_id', myId).limit(1);
  const row = data?.[0];
  if (!row) return usePartnerStore.setState({ partner: null });
  const name = String((row.data as Partial<Profile>)?.display_name ?? '').trim();
  usePartnerStore.setState({ partner: { id: row.user_id as string, name: name || t('Partner') } });
}

export async function viewPartner(): Promise<void> {
  const { partner } = usePartnerStore.getState();
  if (!partner || !supabase) return;
  usePartnerStore.setState({ loading: true });
  try {
    // Joint data (to-dos, money) is the same for both of us: bring ours along.
    const tables: Partial<Record<TableName, unknown[]>> = {};
    for (const tbl of JOINT_TABLES) tables[tbl as TableName] = [...all(tbl as TableName)];
    let profile: Partial<Profile> | null = null;
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from('records')
        .select('tbl,data')
        .eq('user_id', partner.id)
        .eq('deleted', false)
        .order('tbl')
        .order('row_id')
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      for (const r of data ?? []) {
        if (r.tbl === 'profile') profile = r.data as Partial<Profile>;
        else if ((TABLE_NAMES as string[]).includes(r.tbl) && !JOINT_TABLES.has(r.tbl)) (tables[r.tbl as TableName] ??= []).push(r.data);
      }
      if (!data || data.length < 1000) break;
    }
    const self = usePartnerStore.getState().self;
    if (self) usePartnerStore.setState({ self: { ...self, name: ownName() } }); // before the profile swaps
    pauseSync(true);
    enterView(tables, profile, partner.id);
    queryClient.clear(); // drop cached screens of our own data before showing theirs
    usePartnerStore.setState({ viewing: true });
  } finally {
    usePartnerStore.setState({ loading: false });
  }
}

export function viewMe(): void {
  if (!usePartnerStore.getState().viewing) return;
  exitView();
  queryClient.clear();
  usePartnerStore.setState({ viewing: false });
  pauseSync(false);
}

export interface DaySnapshot {
  waterMl: number;
  waterTarget: number;
  habitsDone: number;
  habitsDue: number;
  mood: number;
  sleepMin: number | null;
  trained: boolean;
  steps: number;
  /** Prayers prayed (0–5). */
  prayers: number;
}

/** A person's day from their synced rows (works for the partner, whose rows we can read). */
export async function fetchDaySnapshot(userId: string, date: string): Promise<DaySnapshot> {
  if (!supabase) throw new Error('offline');
  const base = () => supabase!.from('records').select('tbl,data').eq('user_id', userId).eq('deleted', false);
  const home = () => supabase!.from('household_records').select('tbl,data').eq('deleted', false);
  const [small, day, habits, ticks] = await Promise.all([
    base().eq('tbl', 'profile'),
    base().in('tbl', ['water_days', 'checkins', 'sleep_logs', 'workout_sessions', 'steps_days']).eq('data->>date', date),
    home().eq('tbl', 'habits'), // shared
    home().in('tbl', ['habit_logs', 'islam_days']).eq('data->>date', date).eq('data->>by', userId),
  ]);
  for (const r of [small, day, habits, ticks]) if (r.error) throw new Error(r.error.message);
  const rows = [...(small.data ?? []), ...(day.data ?? []), ...(habits.data ?? []), ...(ticks.data ?? [])];
  const of = (t: string) => rows.filter((r) => r.tbl === t).map((r) => r.data as Record<string, unknown>);
  const profile = (of('profile')[0] ?? {}) as Record<string, unknown>;
  const wd = new Date(`${date}T12:00:00`).getDay();
  const due = of('habits').filter(
    (h) => !h.archived && String(h.created_at ?? '').slice(0, 10) <= date && (!(h.days as number[])?.length || (h.days as number[]).includes(wd)),
  );
  const logged = new Set(of('habit_logs').map((l) => l.habit_id));
  const sleep = of('sleep_logs')[0];
  let sleepMin: number | null = null;
  if (sleep) {
    const [bh, bm] = String(sleep.bed).split(':').map(Number);
    const [wh, wm] = String(sleep.wake).split(':').map(Number);
    sleepMin = wh * 60 + wm - (bh * 60 + bm);
    if (sleepMin <= 0) sleepMin += 1440;
  }
  return {
    waterMl: Number(of('water_days')[0]?.ml ?? 0),
    waterTarget: Number(profile.water_target_ml ?? 4000),
    habitsDone: due.filter((h) => logged.has(h.id)).length,
    habitsDue: due.length,
    mood: Number(of('checkins')[0]?.mood ?? 0),
    sleepMin,
    trained: of('workout_sessions').some((r) => r.ended_at),
    steps: Number(of('steps_days')[0]?.steps ?? 0),
    prayers: Object.values((of('islam_days')[0]?.prayers ?? {}) as Record<string, boolean>).filter(Boolean).length,
  };
}

export interface WeekSnapshot {
  habitsDone: number;
  habitsDue: number;
  /** Days the water goal was reached. */
  waterDays: number;
  workouts: number;
  /** Average mood 1–5 (0 = none logged). */
  mood: number;
  /** Average sleep in minutes (null = none logged). */
  sleepMin: number | null;
  /** Days anything was written in the journal. */
  journalDays: number;
}

/** A person's week (7 dates) from their synced rows: works for you and for your partner. */
export async function fetchWeekSnapshot(userId: string, days: string[]): Promise<WeekSnapshot> {
  if (!supabase) throw new Error('offline');
  const base = () => supabase!.from('records').select('tbl,data').eq('user_id', userId).eq('deleted', false);
  const home = () => supabase!.from('household_records').select('tbl,data').eq('deleted', false);
  const [small, week, habits, ticks, journal] = await Promise.all([
    base().eq('tbl', 'profile'),
    base().in('tbl', ['water_days', 'checkins', 'sleep_logs', 'workout_sessions']).in('data->>date', days),
    home().eq('tbl', 'habits'),
    home().eq('tbl', 'habit_logs').in('data->>date', days).eq('data->>by', userId),
    home().eq('tbl', 'journal').in('data->>date', days).eq('data->>by', userId),
  ]);
  for (const r of [small, week, habits, ticks, journal]) if (r.error) throw new Error(r.error.message);
  const rows = [...(small.data ?? []), ...(week.data ?? []), ...(habits.data ?? []), ...(ticks.data ?? [])];
  const of = (t: string) => rows.filter((r) => r.tbl === t).map((r) => r.data as Record<string, unknown>);
  const profile = (of('profile')[0] ?? {}) as Record<string, unknown>;
  const target = Number(profile.water_target_ml ?? 4000);
  let due = 0;
  let done = 0;
  const logs = of('habit_logs');
  for (const date of days) {
    const wd = new Date(`${date}T12:00:00`).getDay();
    const today = of('habits').filter(
      (h) => !h.archived && String(h.created_at ?? '').slice(0, 10) <= date && (!(h.days as number[])?.length || (h.days as number[]).includes(wd)),
    );
    const ticked = new Set(logs.filter((l) => l.date === date).map((l) => l.habit_id));
    due += today.length;
    done += today.filter((h) => ticked.has(h.id)).length;
  }
  const moods = of('checkins').map((c) => Number(c.mood)).filter((m) => m > 0);
  const sleeps = of('sleep_logs').map((s) => {
    const [bh, bm] = String(s.bed).split(':').map(Number);
    const [wh, wm] = String(s.wake).split(':').map(Number);
    let m = wh * 60 + wm - (bh * 60 + bm);
    if (m <= 0) m += 1440;
    return m;
  });
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const journalDays = new Set(
    (journal.data ?? [])
      .map((r) => r.data as { date: string; text?: string; gratitude?: string[] })
      .filter((j) => (j.text ?? '').trim() || (j.gratitude ?? []).some((g) => g.trim()))
      .map((j) => j.date),
  ).size;
  return {
    habitsDone: done,
    habitsDue: due,
    waterDays: of('water_days').filter((w) => Number(w.ml ?? 0) >= target).length,
    workouts: of('workout_sessions').filter((w) => w.ended_at).length,
    mood: moods.length ? Math.round(avg(moods) * 10) / 10 : 0,
    sleepMin: sleeps.length ? Math.round(avg(sleeps)) : null,
    journalDays,
  };
}
