import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { all, upsert } from '@/lib/localDb';

export function useWater(date: string) {
  return useQuery({
    queryKey: ['water', date],
    queryFn: async () => all('water_days').find((w) => w.date === date)?.ml ?? 0,
  });
}

export function useSetWater(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ml: number) => {
      const clamped = Math.max(0, Math.min(20000, Math.round(ml)));
      upsert('water_days', { date, ml: clamped }, (w) => w.date === date);
      return clamped;
    },
    onSuccess: (ml) => qc.setQueryData(['water', date], ml),
  });
}

/**
 * Tap-to-fill: tapping bottle i (0-based) fills up to and including it.
 * Tapping the last full bottle again empties it.
 */
export function nextWaterForBottleTap(currentMl: number, index: number, bottleMl: number): number {
  const filledUpTo = (index + 1) * bottleMl;
  return currentMl >= filledUpTo ? index * bottleMl : filledUpTo;
}
