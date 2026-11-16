import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '@/lib/supabase';
import type { CardioLog } from '@/types/db';

const COLS = 'id, date, kind, duration_seconds, distance_km, rounds, jump_count, notes, created_at';

export function useCardio(limit = 60) {
  return useQuery({
    queryKey: ['cardio', limit],
    queryFn: async () =>
      (
        unwrap(
          await supabase
            .from('cardio_logs')
            .select(COLS)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit),
        ) as CardioLog[]
      ).map((c) => ({ ...c, distance_km: c.distance_km === null ? null : Number(c.distance_km) })),
  });
}

export function useAddCardio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CardioLog, 'id' | 'created_at'>) =>
      unwrap(await supabase.from('cardio_logs').insert(input).select(COLS).single()) as CardioLog,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cardio'] }),
  });
}

export function useDeleteCardio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('cardio_logs').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cardio'] }),
  });
}
