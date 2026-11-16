import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { todayISO } from '@/lib/date';
import { estimated1RM } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { DayType, Exercise, SetLog, WorkoutSession } from '@/types/db';

const EX_COLS = 'id, user_id, day_type, name, target_sets, target_reps, position';
const SET_COLS = 'id, session_id, exercise_id, exercise_name, set_number, weight_kg, reps, created_at';
const SESSION_COLS = 'id, user_id, date, day_type, started_at, ended_at, duration_seconds';

const normSet = (s: SetLog): SetLog => ({ ...s, weight_kg: Number(s.weight_kg) });

// ---------------------------------------------------------------- exercises

export function useExercises() {
  return useQuery({
    queryKey: ['exercises'],
    queryFn: async () =>
      unwrap(await supabase.from('exercises').select(EX_COLS).order('position').order('created_at')) as Exercise[],
  });
}

export function exercisesFor(all: Exercise[] | undefined, dayType: DayType): Exercise[] {
  return (all ?? []).filter((e) => e.day_type === dayType).sort((a, b) => a.position - b.position);
}

export function useAddExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<Exercise, 'day_type' | 'name' | 'target_sets' | 'target_reps'>) => {
      const list = exercisesFor(qc.getQueryData<Exercise[]>(['exercises']), input.day_type);
      const position = list.reduce((m, e) => Math.max(m, e.position), -1) + 1;
      return unwrap(
        await supabase
          .from('exercises')
          .insert({ ...input, position })
          .select(EX_COLS)
          .single(),
      ) as Exercise;
    },
    onSuccess: (row) => qc.setQueryData<Exercise[]>(['exercises'], (old) => [...(old ?? []), row]),
  });
}

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Exercise> & { id: string }) =>
      unwrap(await supabase.from('exercises').update(patch).eq('id', id)),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ['exercises'] });
      const prev = qc.getQueryData<Exercise[]>(['exercises']);
      qc.setQueryData<Exercise[]>(['exercises'], (old) => old?.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      return { prev };
    },
    onError: (_e, _v, c) => c?.prev && qc.setQueryData(['exercises'], c.prev),
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('exercises').delete().eq('id', id)),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['exercises'] });
      const prev = qc.getQueryData<Exercise[]>(['exercises']);
      qc.setQueryData<Exercise[]>(['exercises'], (old) => old?.filter((e) => e.id !== id));
      return { prev };
    },
    onError: (_e, _v, c) => c?.prev && qc.setQueryData(['exercises'], c.prev),
  });
}

/** Swap an exercise with its neighbour (direction -1 = up, +1 = down). */
export function useMoveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ exercise, direction }: { exercise: Exercise; direction: -1 | 1 }) => {
      const list = exercisesFor(qc.getQueryData<Exercise[]>(['exercises']), exercise.day_type);
      const idx = list.findIndex((e) => e.id === exercise.id);
      const other = list[idx + direction];
      if (!other) return;
      // Re-number the whole day so positions are always distinct.
      const reordered = [...list];
      [reordered[idx], reordered[idx + direction]] = [other, exercise];
      const updates = reordered.map((e, i) => ({ id: e.id, position: i }));
      qc.setQueryData<Exercise[]>(['exercises'], (old) =>
        old?.map((e) => {
          const u = updates.find((x) => x.id === e.id);
          return u ? { ...e, position: u.position } : e;
        }),
      );
      await Promise.all(
        updates.map(async (u) => unwrap(await supabase.from('exercises').update({ position: u.position }).eq('id', u.id))),
      );
    },
    onError: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

// ---------------------------------------------------------------- sessions

export function useStartWorkout() {
  const setActive = useWorkoutStore((s) => s.setActive);
  return useMutation({
    mutationFn: async (dayType: DayType) => {
      const startedAt = new Date();
      const row = unwrap(
        await supabase
          .from('workout_sessions')
          .insert({ date: todayISO(), day_type: dayType, started_at: startedAt.toISOString() })
          .select(SESSION_COLS)
          .single(),
      ) as WorkoutSession;
      return row;
    },
    onSuccess: (row) =>
      setActive({ sessionId: row.id, dayType: row.day_type, startedAt: new Date(row.started_at).getTime() }),
  });
}

export function useFinishWorkout() {
  const qc = useQueryClient();
  const { active, setActive } = useWorkoutStore();
  return useMutation({
    mutationFn: async () => {
      if (!active) return;
      const sets = qc.getQueryData<SetLog[]>(['sessionSets', active.sessionId]) ?? [];
      if (sets.length === 0) {
        // Nothing logged: don't keep an empty session in history.
        unwrap(await supabase.from('workout_sessions').delete().eq('id', active.sessionId));
        return;
      }
      const ended = new Date();
      unwrap(
        await supabase
          .from('workout_sessions')
          .update({
            ended_at: ended.toISOString(),
            duration_seconds: Math.round((ended.getTime() - active.startedAt) / 1000),
          })
          .eq('id', active.sessionId),
      );
    },
    onSuccess: () => {
      setActive(null);
      qc.invalidateQueries({ queryKey: ['workoutHistory'] });
      qc.invalidateQueries({ queryKey: ['todaySessions'] });
      qc.invalidateQueries({ queryKey: ['previousSets'] });
      qc.invalidateQueries({ queryKey: ['exerciseProgress'] });
    },
  });
}

export function useDiscardWorkout() {
  const qc = useQueryClient();
  const { active, setActive } = useWorkoutStore();
  return useMutation({
    mutationFn: async () => {
      if (active) unwrap(await supabase.from('workout_sessions').delete().eq('id', active.sessionId));
    },
    onSuccess: () => {
      setActive(null);
      qc.invalidateQueries({ queryKey: ['todaySessions'] });
    },
  });
}

/** Verifies a persisted active session still exists (e.g. it was finished on another device). */
export function useValidateActiveWorkout() {
  const { active, setActive } = useWorkoutStore();
  return useQuery({
    queryKey: ['activeCheck', active?.sessionId],
    enabled: Boolean(active),
    queryFn: async () => {
      const row = unwrap(
        await supabase.from('workout_sessions').select('id, ended_at').eq('id', active!.sessionId).maybeSingle(),
      ) as { id: string; ended_at: string | null } | null;
      if (!row || row.ended_at) setActive(null);
      return Boolean(row && !row.ended_at);
    },
  });
}

export function useTodaySessions() {
  const date = todayISO();
  return useQuery({
    queryKey: ['todaySessions', date],
    queryFn: async () =>
      unwrap(
        await supabase.from('workout_sessions').select(SESSION_COLS).eq('date', date).not('ended_at', 'is', null),
      ) as WorkoutSession[],
  });
}

// ---------------------------------------------------------------- sets

export function useSessionSets(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['sessionSets', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () =>
      (
        unwrap(
          await supabase.from('set_logs').select(SET_COLS).eq('session_id', sessionId!).order('created_at'),
        ) as SetLog[]
      ).map(normSet),
  });
}

/**
 * For each exercise, the sets from the most recent *other* session that included it.
 * Matches by exercise id, falling back to exercise name for history logged before a rename/re-create.
 */
export function usePreviousSets(exercises: Exercise[], currentSessionId: string | undefined) {
  const ids = exercises.map((e) => e.id);
  const names = exercises.map((e) => e.name);
  return useQuery({
    queryKey: ['previousSets', currentSessionId, ids.join(',')],
    enabled: exercises.length > 0,
    queryFn: async () => {
      let q = supabase
        .from('set_logs')
        .select(SET_COLS)
        .or(`exercise_id.in.(${ids.join(',')}),exercise_name.in.(${names.map((n) => JSON.stringify(n)).join(',')})`)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (currentSessionId) q = q.neq('session_id', currentSessionId);
      const rows = (unwrap(await q) as SetLog[]).map(normSet);
      const result: Record<string, SetLog[]> = {};
      for (const ex of exercises) {
        const mine = rows.filter((r) => r.exercise_id === ex.id || (r.exercise_id === null && r.exercise_name === ex.name));
        const byId = mine.length ? mine : rows.filter((r) => r.exercise_name === ex.name);
        if (!byId.length) continue;
        const latestSession = byId[0].session_id;
        result[ex.id] = byId.filter((r) => r.session_id === latestSession).sort((a, b) => a.set_number - b.set_number);
      }
      return result;
    },
  });
}

export function useLogSet(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<SetLog, 'exercise_id' | 'exercise_name' | 'set_number' | 'weight_kg' | 'reps'>) =>
      normSet(
        unwrap(
          await supabase
            .from('set_logs')
            .insert({ ...input, session_id: sessionId })
            .select(SET_COLS)
            .single(),
        ) as SetLog,
      ),
    onSuccess: (row) => qc.setQueryData<SetLog[]>(['sessionSets', sessionId], (old) => [...(old ?? []), row]),
  });
}

export function useUpdateSet(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, weight_kg, reps }: Pick<SetLog, 'id' | 'weight_kg' | 'reps'>) =>
      unwrap(await supabase.from('set_logs').update({ weight_kg, reps }).eq('id', id)),
    onMutate: ({ id, weight_kg, reps }) => {
      const prev = qc.getQueryData<SetLog[]>(['sessionSets', sessionId]);
      qc.setQueryData<SetLog[]>(['sessionSets', sessionId], (old) =>
        old?.map((s) => (s.id === id ? { ...s, weight_kg, reps } : s)),
      );
      return { prev };
    },
    onError: (_e, _v, c) => c?.prev && qc.setQueryData(['sessionSets', sessionId], c.prev),
  });
}

export function useDeleteSet(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('set_logs').delete().eq('id', id)),
    onMutate: (id) => {
      const prev = qc.getQueryData<SetLog[]>(['sessionSets', sessionId]);
      qc.setQueryData<SetLog[]>(['sessionSets', sessionId], (old) => old?.filter((s) => s.id !== id));
      return { prev };
    },
    onError: (_e, _v, c) => c?.prev && qc.setQueryData(['sessionSets', sessionId], c.prev),
  });
}

// ---------------------------------------------------------------- history & progress

export interface HistoryItem extends WorkoutSession {
  setCount: number;
  volumeKg: number;
  exerciseCount: number;
}

export function useWorkoutHistory(limit = 30) {
  return useQuery({
    queryKey: ['workoutHistory', limit],
    queryFn: async (): Promise<HistoryItem[]> => {
      const rows = unwrap(
        await supabase
          .from('workout_sessions')
          .select(`${SESSION_COLS}, set_logs(exercise_name, weight_kg, reps)`)
          .not('ended_at', 'is', null)
          .order('started_at', { ascending: false })
          .limit(limit),
      ) as (WorkoutSession & { set_logs: { exercise_name: string; weight_kg: number; reps: number }[] })[];
      return rows.map(({ set_logs, ...s }) => ({
        ...s,
        setCount: set_logs.length,
        volumeKg: Math.round(set_logs.reduce((a, x) => a + Number(x.weight_kg) * x.reps, 0)),
        exerciseCount: new Set(set_logs.map((x) => x.exercise_name)).size,
      }));
    },
  });
}

export interface StrengthPoint {
  date: string;
  topWeight: number;
  e1rm: number;
  bestSet: string;
}

export function useExerciseProgress(exercise: Exercise | undefined) {
  return useQuery({
    queryKey: ['exerciseProgress', exercise?.id],
    enabled: Boolean(exercise),
    queryFn: async (): Promise<StrengthPoint[]> => {
      const rows = unwrap(
        await supabase
          .from('set_logs')
          .select('weight_kg, reps, exercise_id, exercise_name, workout_sessions!inner(date, ended_at)')
          .or(`exercise_id.eq.${exercise!.id},exercise_name.eq.${JSON.stringify(exercise!.name)}`)
          .not('workout_sessions.ended_at', 'is', null)
          .limit(2000),
      ) as unknown as { weight_kg: number; reps: number; workout_sessions: { date: string } }[];
      const byDate = new Map<string, StrengthPoint>();
      for (const r of rows) {
        const w = Number(r.weight_kg);
        const e = estimated1RM(w, r.reps);
        const date = r.workout_sessions.date;
        const cur = byDate.get(date);
        if (!cur) {
          byDate.set(date, { date, topWeight: w, e1rm: e, bestSet: `${w}×${r.reps}` });
        } else {
          if (w > cur.topWeight) cur.topWeight = w;
          if (e > cur.e1rm) {
            cur.e1rm = e;
            cur.bestSet = `${w}×${r.reps}`;
          }
        }
      }
      return [...byDate.values()]
        .map((p) => ({ ...p, e1rm: Math.round(p.e1rm * 10) / 10 }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}
