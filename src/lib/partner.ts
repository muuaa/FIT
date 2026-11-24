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
    home().eq('tbl', 'habit_logs').eq('data->>date', date).eq('data->>by', userId),
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
  };
}
