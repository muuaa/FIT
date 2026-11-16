import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { all, insert, remove, uid } from '@/lib/localDb';
import type { CardioLog } from '@/types/db';

export function useCardio(limit = 60) {
  return useQuery({
    queryKey: ['cardio', limit],
    queryFn: async () =>
      [...all('cardio_logs')]
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
        .slice(0, limit),
  });
}

export function useAddCardio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<CardioLog, 'id' | 'created_at'>) =>
      insert('cardio_logs', { ...input, id: uid(), created_at: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cardio'] }),
  });
}

export function useDeleteCardio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => remove('cardio_logs', (c) => c.id === id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cardio'] }),
  });
}
