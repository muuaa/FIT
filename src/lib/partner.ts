/** The other person in the app: find them, and switch the whole app to view their data. */
import { create } from 'zustand';
import { t } from './i18n';
import { queryClient } from './queryClient';
import { all, enterView, exitView, TABLE_NAMES, type TableName } from './localDb';
import { supabase } from './supabase';
import { JOINT_TABLES, pauseSync } from './sync';
import type { Profile } from '@/types/db';

export interface Partner {
  id: string;
  name: string;
}

interface PartnerState {
  partner: Partner | null;
  viewing: boolean;
  loading: boolean;
}

export const usePartnerStore = create<PartnerState>()(() => ({ partner: null, viewing: false, loading: false }));

/** Look up the partner (the other account). Their profile row is readable to us. */
export async function findPartner(myId: string): Promise<void> {
  if (!supabase) return;
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
    pauseSync(true);
    enterView(tables, profile);
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
