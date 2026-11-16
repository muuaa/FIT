import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { all, getProfile, insert, remove, uid, update, upsert } from '@/lib/localDb';
import type { Supplement } from '@/types/db';

export function useSupplements() {
  return useQuery({
    queryKey: ['supplements'],
    queryFn: async () => {
      getProfile(); // ensures the default shelf exists on first launch
      return [...all('supplements')].sort((a, b) => a.position - b.position);
    },
  });
}

export function useUpdateSupplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Supplement> & { id: string }) =>
      update('supplements', (s) => s.id === id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  });
}

export function useAddSupplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; dosage: string }) => {
      const position = all('supplements').reduce((m, s) => Math.max(m, s.position), -1) + 1;
      return insert('supplements', { ...input, id: uid(), active: true, position });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplements'] }),
  });
}

export function useDeleteSupplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      remove('supplements', (s) => s.id === id);
      remove('supplement_logs', (l) => l.supplement_id === id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplements'] });
      qc.invalidateQueries({ queryKey: ['suppLogs'] });
    },
  });
}

/** Ids of supplements taken on `date`. */
export function useSupplementLogs(date: string) {
  return useQuery({
    queryKey: ['suppLogs', date],
    queryFn: async () =>
      all('supplement_logs')
        .filter((l) => l.date === date)
        .map((l) => l.supplement_id),
  });
}

export function useToggleSupplementTaken(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, taken }: { id: string; taken: boolean }) => {
      const match = (l: { supplement_id: string; date: string }) => l.supplement_id === id && l.date === date;
      if (taken) upsert('supplement_logs', { supplement_id: id, date, taken_at: new Date().toISOString() }, match);
      else remove('supplement_logs', match);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppLogs', date] }),
  });
}
