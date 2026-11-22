import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { t } from '@/lib/i18n';
import { addDays, todayISO } from '@/lib/date';
import { all, remove, upsert } from '@/lib/localDb';
import { toast } from '@/stores/toastStore';
import type { BodyweightLog } from '@/types/db';

/** All bodyweight entries in the last `days` days, oldest first. */
export function useBodyweight(days = 120) {
  return useQuery({
    queryKey: ['bodyweight', days],
    queryFn: async () => {
      const since = addDays(todayISO(), -days);
      return all('bodyweight_logs')
        .filter((l) => l.date >= since)
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

export function useLogBodyweight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, weight_kg }: BodyweightLog) =>
      upsert('bodyweight_logs', { date, weight_kg }, (l) => l.date === date),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bodyweight'] }),
  });
}

export function useDeleteBodyweight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const row = all('bodyweight_logs').find((l) => l.date === date);
      remove('bodyweight_logs', (l) => l.date === date);
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['bodyweight'] });
      if (row)
        toast.undo(t('Deleted {kg} kg weigh-in', { kg: row.weight_kg }), () => {
          upsert('bodyweight_logs', row, (l) => l.date === row.date);
          qc.invalidateQueries({ queryKey: ['bodyweight'] });
        });
    },
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
