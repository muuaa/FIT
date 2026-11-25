/**
 * Generic read/write hooks for the Life tables. Each table is small, so screens read the whole
 * table (cached by React Query under ['t', table]) and derive what they need with useMemo.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { all, insert, PERSON_TABLES, personId, remove, rowKey, update, upsert, type TableName, type Tables } from '@/lib/localDb';
import { toast } from '@/stores/toastStore';

/** Rows of a table. For shared per-person tables (habit ticks, journal) only the person on screen's. */
export function useTable<T extends TableName>(t: T) {
  return useQuery({ queryKey: ['t', t], queryFn: async () => mine(t) });
}

/** Every row, both of yours, for shared per-person tables (to show your partner's ticks and entries). */
export function useTableEveryone<T extends TableName>(t: T) {
  return useQuery({ queryKey: ['t', t, 'everyone'], queryFn: async () => [...all(t)] as Tables[T][] });
}

/** The person-on-screen's rows of a table (all rows for ordinary tables). */
export function mine<T extends TableName>(t: T): Tables[T][] {
  if (!PERSON_TABLES.has(t)) return [...all(t)];
  const me = personId();
  return all(t).filter((r) => (r as { by?: string }).by === me);
}

/** Write helpers below take keys without the person (e.g. `habit|date`); add whose row it is. */
const own = (t: TableName, key: string) => (PERSON_TABLES.has(t) ? `${key}|${personId()}` : key);
const stamp = <T extends TableName>(t: T, row: Tables[T]): Tables[T] => (PERSON_TABLES.has(t) ? ({ ...row, by: personId() } as Tables[T]) : row);
type In<T extends TableName> = T extends 'habit_logs' | 'journal' | 'reviews' ? Omit<Tables[T], 'by'> : Tables[T];

export function useTableActions<T extends TableName>(t: T) {
  const qc = useQueryClient();
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['t', t] }), [qc, t]); // also the 'everyone' view
  return useMemo(
    () => ({
      insert: (input: In<T>) => {
        const row = stamp(t, input as Tables[T]);
        insert(t, row);
        void refresh();
        return row;
      },
      /** Insert or replace the row with the same key. */
      put: (input: In<T>) => {
        const row = stamp(t, input as Tables[T]);
        const k = rowKey(t, row);
        upsert(t, row, (r) => rowKey(t, r) === k);
        void refresh();
      },
      patch: (rawKey: string, patch: Partial<Tables[T]>) => {
        const key = own(t, rawKey);
        update(t, (r) => rowKey(t, r) === key, patch);
        void refresh();
      },
      /** Delete by key. With `undoLabel`, shows an Undo toast that puts the row back. */
      remove: (rawKey: string, undoLabel?: string) => {
        const key = own(t, rawKey);
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
