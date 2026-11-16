import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentUserId, supabase, unwrap } from '@/lib/supabase';
import type { Supplement } from '@/types/db';

const COLS = 'id, name, dosage, active, position';

export function useSupplements() {
  return useQuery({
    queryKey: ['supplements'],
    queryFn: async () =>
      unwrap(await supabase.from('supplements').select(COLS).order('position').order('created_at')) as Supplement[],
  });
}

function useOptimisticSupplements() {
  const qc = useQueryClient();
  const snapshot = async () => {
    await qc.cancelQueries({ queryKey: ['supplements'] });
    return qc.getQueryData<Supplement[]>(['supplements']);
  };
  const restore = (prev?: Supplement[]) => prev && qc.setQueryData(['supplements'], prev);
  return { qc, snapshot, restore };
}

export function useUpdateSupplement() {
  const { qc, snapshot, restore } = useOptimisticSupplements();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Supplement> & { id: string }) =>
      unwrap(await supabase.from('supplements').update(patch).eq('id', id)),
    onMutate: async ({ id, ...patch }) => {
      const prev = await snapshot();
      qc.setQueryData<Supplement[]>(['supplements'], (old) => old?.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      return { prev };
    },
    onError: (_e, _v, c) => restore(c?.prev),
  });
}

export function useAddSupplement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; dosage: string }) => {
      const list = qc.getQueryData<Supplement[]>(['supplements']) ?? [];
      const position = list.reduce((m, s) => Math.max(m, s.position), -1) + 1;
      return unwrap(
        await supabase
          .from('supplements')
          .insert({ ...input, active: true, position })
          .select(COLS)
          .single(),
      ) as Supplement;
    },
    onSuccess: (row) => qc.setQueryData<Supplement[]>(['supplements'], (old) => [...(old ?? []), row]),
  });
}

export function useDeleteSupplement() {
  const { qc, snapshot, restore } = useOptimisticSupplements();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('supplements').delete().eq('id', id)),
    onMutate: async (id) => {
      const prev = await snapshot();
      qc.setQueryData<Supplement[]>(['supplements'], (old) => old?.filter((s) => s.id !== id));
      return { prev };
    },
    onError: (_e, _v, c) => restore(c?.prev),
  });
}

/** Set of supplement ids taken on `date`. */
export function useSupplementLogs(date: string) {
  return useQuery({
    queryKey: ['suppLogs', date],
    queryFn: async () => {
      const rows = unwrap(await supabase.from('supplement_logs').select('supplement_id').eq('date', date)) as {
        supplement_id: string;
      }[];
      return rows.map((r) => r.supplement_id);
    },
  });
}

export function useToggleSupplementTaken(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, taken }: { id: string; taken: boolean }) => {
      if (taken) {
        const user_id = await currentUserId();
        unwrap(
          await supabase
            .from('supplement_logs')
            .upsert({ user_id, supplement_id: id, date }, { onConflict: 'user_id,supplement_id,date' }),
        );
      } else {
        unwrap(await supabase.from('supplement_logs').delete().eq('supplement_id', id).eq('date', date));
      }
    },
    onMutate: async ({ id, taken }) => {
      await qc.cancelQueries({ queryKey: ['suppLogs', date] });
      const prev = qc.getQueryData<string[]>(['suppLogs', date]);
      qc.setQueryData<string[]>(['suppLogs', date], (old = []) =>
        taken ? [...new Set([...old, id])] : old.filter((x) => x !== id),
      );
      return { prev };
    },
    onError: (_e, _v, c) => qc.setQueryData(['suppLogs', date], c?.prev ?? []),
  });
}
