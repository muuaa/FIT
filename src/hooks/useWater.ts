import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentUserId, supabase, unwrap } from '@/lib/supabase';

export function useWater(date: string) {
  return useQuery({
    queryKey: ['water', date],
    queryFn: async () => {
      const row = unwrap(await supabase.from('water_days').select('ml').eq('date', date).maybeSingle()) as {
        ml: number;
      } | null;
      return row?.ml ?? 0;
    },
  });
}

export function useSetWater(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ml: number) => {
      const user_id = await currentUserId();
      const clamped = Math.max(0, Math.min(20000, Math.round(ml)));
      unwrap(await supabase.from('water_days').upsert({ user_id, date, ml: clamped }, { onConflict: 'user_id,date' }));
      return clamped;
    },
    onMutate: async (ml) => {
      await qc.cancelQueries({ queryKey: ['water', date] });
      const prev = qc.getQueryData<number>(['water', date]);
      qc.setQueryData(['water', date], Math.max(0, ml));
      return { prev };
    },
    onError: (_e, _v, c) => qc.setQueryData(['water', date], c?.prev ?? 0),
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
