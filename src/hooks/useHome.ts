import { useProfile } from './useProfile';
import { useTable, useTableActions } from './useTable';
import type { HomeSettings } from '@/lib/localDb';

/** Joint settings (monthly budget, currency) shared by both of you. */
export function useHomeSettings(): HomeSettings & { save: (patch: Partial<Omit<HomeSettings, 'id'>>) => void } {
  const { data: rows = [] } = useTable('home_settings');
  const { data: profile } = useProfile();
  const actions = useTableActions('home_settings');
  // Until someone saves joint settings, fall back to this person's old per-person values.
  const cur: HomeSettings = rows.find((r) => r.id === 'main') ?? {
    id: 'main',
    monthly_budget: profile?.monthly_budget ?? 0,
    currency: profile?.currency ?? 'USD',
  };
  return { ...cur, save: (patch) => actions.put({ ...cur, ...patch, id: 'main' }) };
}
