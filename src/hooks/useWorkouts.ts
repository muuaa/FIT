import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { todayISO } from '@/lib/date';
import { estimated1RM } from '@/lib/format';
import { all, insert, remove, uid, update } from '@/lib/localDb';
import { toast } from '@/stores/toastStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { DayType, Exercise, SetLog, WorkoutSession } from '@/types/db';

function invalidateTraining(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['workoutHistory', 'todaySessions', 'previousSets', 'exerciseProgress', 'sessionSets', 'sessionDetail']) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

// ---------------------------------------------------------------- exercises

export function useExercises() {
  return useQuery({
    queryKey: ['exercises'],
    queryFn: async () => [...all('exercises')],
  });
}

export function exercisesFor(list: Exercise[] | undefined, dayType: DayType): Exercise[] {
  return (list ?? []).filter((e) => e.day_type === dayType).sort((a, b) => a.position - b.position);
}

export function useAddExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<Exercise, 'day_type' | 'name' | 'target_sets' | 'target_reps'>) => {
      const position = exercisesFor(all('exercises'), input.day_type).reduce((m, e) => Math.max(m, e.position), -1) + 1;
      return insert('exercises', { ...input, id: uid(), position });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Exercise> & { id: string }) => {
      update('exercises', (e) => e.id === id, patch);
      // Keep history readable after a rename.
      if (patch.name) update('set_logs', (s) => s.exercise_id === id, { exercise_name: patch.name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      invalidateTraining(qc);
    },
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      remove('exercises', (e) => e.id === id);
      // History stays, matched by name from now on.
      update('set_logs', (s) => s.exercise_id === id, { exercise_id: null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exercises'] });
      invalidateTraining(qc);
    },
  });
}

/** Swap an exercise with its neighbour (direction -1 = up, +1 = down). */
export function useMoveExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ exercise, direction }: { exercise: Exercise; direction: -1 | 1 }) => {
      const list = exercisesFor(all('exercises'), exercise.day_type);
      const idx = list.findIndex((e) => e.id === exercise.id);
      if (!list[idx + direction]) return;
      [list[idx], list[idx + direction]] = [list[idx + direction], list[idx]];
      list.forEach((e, i) => update('exercises', (x) => x.id === e.id, { position: i }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exercises'] }),
  });
}

// ---------------------------------------------------------------- sessions

export function useStartWorkout() {
  const setActive = useWorkoutStore((s) => s.setActive);
  return useMutation({
    mutationFn: async (dayType: DayType): Promise<WorkoutSession> =>
      insert('workout_sessions', {
        id: uid(),
        date: todayISO(),
        day_type: dayType,
        started_at: new Date().toISOString(),
        ended_at: null,
        duration_seconds: null,
      }),
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
      const hasSets = all('set_logs').some((s) => s.session_id === active.sessionId);
      if (!hasSets) {
        // Nothing logged: don't keep an empty session in history.
        remove('workout_sessions', (s) => s.id === active.sessionId);
        return;
      }
      const ended = Date.now();
      update('workout_sessions', (s) => s.id === active.sessionId, {
        ended_at: new Date(ended).toISOString(),
        duration_seconds: Math.round((ended - active.startedAt) / 1000),
      });
    },
    onSuccess: () => {
      setActive(null);
      invalidateTraining(qc);
    },
  });
}

export function useDiscardWorkout() {
  const qc = useQueryClient();
  const { active, setActive } = useWorkoutStore();
  return useMutation({
    mutationFn: async () => {
      if (!active) return;
      remove('set_logs', (s) => s.session_id === active.sessionId);
      remove('workout_sessions', (s) => s.id === active.sessionId);
    },
    onSuccess: () => {
      setActive(null);
      invalidateTraining(qc);
    },
  });
}

/** Clears a persisted active workout whose session no longer exists (e.g. after erasing data). */
export function useValidateActiveWorkout() {
  const { active, setActive } = useWorkoutStore();
  return useQuery({
    queryKey: ['activeCheck', active?.sessionId],
    enabled: Boolean(active),
    queryFn: async () => {
      const row = all('workout_sessions').find((s) => s.id === active!.sessionId);
      if (!row || row.ended_at) setActive(null);
      return Boolean(row && !row.ended_at);
    },
  });
}

export function useTodaySessions() {
  const date = todayISO();
  return useQuery({
    queryKey: ['todaySessions', date],
    queryFn: async () => all('workout_sessions').filter((s) => s.date === date && s.ended_at),
  });
}

// ---------------------------------------------------------------- sets

export function useSessionSets(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['sessionSets', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () =>
      all('set_logs')
        .filter((s) => s.session_id === sessionId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  });
}

/**
 * For each exercise, the sets from the most recent *other* finished session that included it.
 * Matches by exercise id, falling back to name for history whose exercise was deleted or re-created.
 */
export function usePreviousSets(exercises: Exercise[], currentSessionId: string | undefined) {
  return useQuery({
    queryKey: ['previousSets', currentSessionId, exercises.map((e) => `${e.id}:${e.name}`).join(',')],
    enabled: exercises.length > 0,
    queryFn: async () => {
      const finished = new Map(
        all('workout_sessions')
          .filter((s) => s.ended_at && s.id !== currentSessionId)
          .map((s) => [s.id, s.started_at]),
      );
      const sets = all('set_logs').filter((s) => finished.has(s.session_id));
      const result: Record<string, SetLog[]> = {};
      for (const ex of exercises) {
        let mine = sets.filter((s) => s.exercise_id === ex.id);
        if (!mine.length) mine = sets.filter((s) => s.exercise_name.toLowerCase() === ex.name.toLowerCase());
        if (!mine.length) continue;
        const latest = mine.reduce((best, s) =>
          finished.get(s.session_id)! > finished.get(best.session_id)! ? s : best,
        ).session_id;
        result[ex.id] = mine.filter((s) => s.session_id === latest).sort((a, b) => a.set_number - b.set_number);
      }
      return result;
    },
  });
}

export function useLogSet(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<SetLog, 'exercise_id' | 'exercise_name' | 'set_number' | 'weight_kg' | 'reps'>) => {
      if (!sessionId) throw new Error('No workout in progress');
      return insert('set_logs', { ...input, id: uid(), session_id: sessionId, created_at: new Date().toISOString() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessionSets', sessionId] }),
  });
}

export function useUpdateSet(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, weight_kg, reps }: Pick<SetLog, 'id' | 'weight_kg' | 'reps'>) =>
      update('set_logs', (s) => s.id === id, { weight_kg, reps }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessionSets', sessionId] }),
  });
}

export function useDeleteSet(sessionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const row = all('set_logs').find((s) => s.id === id);
      remove('set_logs', (s) => s.id === id);
      // Keep set numbers contiguous per exercise.
      const byExercise = new Map<string, SetLog[]>();
      for (const s of all('set_logs').filter((x) => x.session_id === sessionId)) {
        const k = s.exercise_id ?? s.exercise_name;
        byExercise.set(k, [...(byExercise.get(k) ?? []), s]);
      }
      for (const list of byExercise.values()) {
        list
          .sort((a, b) => a.set_number - b.set_number)
          .forEach((s, i) => s.set_number !== i + 1 && update('set_logs', (x) => x.id === s.id, { set_number: i + 1 }));
      }
      return row;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['sessionSets', sessionId] });
      if (row)
        toast.undo(`Deleted set ${row.set_number}`, () => {
          // Put it back in its old slot and shift later sets of the same exercise down one.
          const key = (s: SetLog) => (s.exercise_id ?? s.exercise_name) === (row.exercise_id ?? row.exercise_name);
          for (const s of all('set_logs').filter((x) => x.session_id === row.session_id && key(x) && x.set_number >= row.set_number))
            update('set_logs', (x) => x.id === s.id, { set_number: s.set_number + 1 });
          insert('set_logs', row);
          qc.invalidateQueries({ queryKey: ['sessionSets', sessionId] });
        });
    },
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
      const sets = all('set_logs');
      return all('workout_sessions')
        .filter((s) => s.ended_at)
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, limit)
        .map((s) => {
          const mine = sets.filter((x) => x.session_id === s.id);
          return {
            ...s,
            setCount: mine.length,
            volumeKg: Math.round(mine.reduce((a, x) => a + x.weight_kg * x.reps, 0)),
            exerciseCount: new Set(mine.map((x) => x.exercise_name)).size,
          };
        });
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
    queryKey: ['exerciseProgress', exercise?.id, exercise?.name],
    enabled: Boolean(exercise),
    queryFn: async (): Promise<StrengthPoint[]> => {
      const sessions = new Map(
        all('workout_sessions')
          .filter((s) => s.ended_at)
          .map((s) => [s.id, s.date]),
      );
      const rows = all('set_logs').filter(
        (s) =>
          sessions.has(s.session_id) &&
          (s.exercise_id === exercise!.id || s.exercise_name.toLowerCase() === exercise!.name.toLowerCase()),
      );
      const byDate = new Map<string, StrengthPoint>();
      for (const r of rows) {
        const date = sessions.get(r.session_id)!;
        const e = estimated1RM(r.weight_kg, r.reps);
        const cur = byDate.get(date);
        if (!cur) byDate.set(date, { date, topWeight: r.weight_kg, e1rm: e, bestSet: `${r.weight_kg}×${r.reps}` });
        else {
          cur.topWeight = Math.max(cur.topWeight, r.weight_kg);
          if (e > cur.e1rm) {
            cur.e1rm = e;
            cur.bestSet = `${r.weight_kg}×${r.reps}`;
          }
        }
      }
      return [...byDate.values()]
        .map((p) => ({ ...p, e1rm: Math.round(p.e1rm * 10) / 10 }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });
}

/** A finished session's sets, grouped by exercise in the order they were logged. */
export function useSessionDetail(sessionId: string | null) {
  return useQuery({
    queryKey: ['sessionDetail', sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const groups = new Map<string, SetLog[]>();
      for (const s of all('set_logs')
        .filter((x) => x.session_id === sessionId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        groups.set(s.exercise_name, [...(groups.get(s.exercise_name) ?? []), s]);
      }
      return [...groups.entries()].map(([name, sets]) => ({
        name,
        sets: sets.sort((a, b) => a.set_number - b.set_number),
      }));
    },
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const session = all('workout_sessions').find((s) => s.id === id);
      const sets = all('set_logs').filter((s) => s.session_id === id);
      remove('set_logs', (s) => s.session_id === id);
      remove('workout_sessions', (s) => s.id === id);
      return session ? { session, sets } : null;
    },
    onSuccess: (deleted) => {
      invalidateTraining(qc);
      if (deleted)
        toast.undo('Workout deleted', () => {
          insert('workout_sessions', deleted.session);
          for (const s of deleted.sets) insert('set_logs', s);
          invalidateTraining(qc);
        });
    },
  });
}
