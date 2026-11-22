/**
 * Generic read/write hooks for the Life tables. Each table is small, so screens read the whole
 * table (cached by React Query under ['t', table]) and derive what they need with useMemo.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { all, insert, remove, rowKey, update, upsert, type TableName, type Tables } from '@/lib/localDb';
import { toast } from '@/stores/toastStore';

export function useTable<T extends TableName>(t: T) {
  return useQuery({ queryKey: ['t', t], queryFn: async () => [...all(t)] as Tables[T][] });
}

export function useTableActions<T extends TableName>(t: T) {
  const qc = useQueryClient();
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['t', t] }), [qc, t]);
  return useMemo(
    () => ({
      insert: (row: Tables[T]) => {
        insert(t, row);
        void refresh();
        return row;
      },
      /** Insert or replace the row with the same key. */
      put: (row: Tables[T]) => {
        const k = rowKey(t, row);
        upsert(t, row, (r) => rowKey(t, r) === k);
        void refresh();
      },
      patch: (key: string, patch: Partial<Tables[T]>) => {
        update(t, (r) => rowKey(t, r) === key, patch);
        void refresh();
      },
      /** Delete by key. With `undoLabel`, shows an Undo toast that puts the row back. */
      remove: (key: string, undoLabel?: string) => {
        const row = all(t).find((r) => rowKey(t, r) === key);
        remove(t, (r) => rowKey(t, r) === key);
        void refresh();
        if (row && undoLabel)
          toast.undo(undoLabel, () => {
            upsert(t, row, (r) => rowKey(t, r) === key);
            void refresh();
          });
        return row;
      },
      removeWhere: (match: (r: Tables[T]) => boolean) => {
        remove(t, match);
        void refresh();
      },
    }),
    [t, refresh],
  );
}
