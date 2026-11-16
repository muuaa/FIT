import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, todayISO } from '@/lib/date';
import { currentUserId, supabase, unwrap } from '@/lib/supabase';
import type { BodyweightLog } from '@/types/db';

/** All bodyweight entries in the last `days` days, oldest first. */
export function useBodyweight(days = 120) {
  const since = addDays(todayISO(), -days);
  return useQuery({
    queryKey: ['bodyweight', days],
    queryFn: async () =>
      (
        unwrap(
          await supabase.from('bodyweight_logs').select('date, weight_kg').gte('date', since).order('date'),
        ) as BodyweightLog[]
      ).map((r) => ({ ...r, weight_kg: Number(r.weight_kg) })),
  });
}

export function useLogBodyweight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, weight_kg }: BodyweightLog) => {
      const user_id = await currentUserId();
      unwrap(
        await supabase.from('bodyweight_logs').upsert({ user_id, date, weight_kg }, { onConflict: 'user_id,date' }),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bodyweight'] }),
  });
}

export function useDeleteBodyweight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => unwrap(await supabase.from('bodyweight_logs').delete().eq('date', date)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bodyweight'] }),
  });
}

export interface WeightPoint {
  date: string;
  weight: number | null;
  avg7: number | null;
}

/**
 * One point per calendar day from `from` to `to` (inclusive). `weight` is that day's entry (or null),
 * `avg7` is the mean of all entries in the trailing 7-day window ending that day (or null if none).
 */
export function buildWeightSeries(logs: BodyweightLog[], from: string, to: string): WeightPoint[] {
  const byDate = new Map(logs.map((l) => [l.date, Number(l.weight_kg)]));
  const out: WeightPoint[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const window: number[] = [];
    for (let i = 0; i < 7; i++) {
      const w = byDate.get(addDays(d, -i));
      if (w !== undefined) window.push(w);
    }
    out.push({
      date: d,
      weight: byDate.get(d) ?? null,
      avg7: window.length ? Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 100) / 100 : null,
    });
  }
  return out;
}
