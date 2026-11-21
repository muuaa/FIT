import { Flag, ListPlus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { WorkoutClock } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/Progress';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/States';
import {
  exercisesFor,
  useDiscardWorkout,
  useExercises,
  useFinishWorkout,
  usePreviousSets,
  useSessionSets,
} from '@/hooks/useWorkouts';
import { DAY_LABEL } from '@/lib/split';
import { toast } from '@/stores/toastStore';
import { useRestStore, type ActiveWorkout as Active } from '@/stores/workoutStore';
import { ExerciseEditor } from './ExerciseEditor';
import { ExerciseLogCard } from './ExerciseLogCard';
import { RestPresets } from './RestPresets';

export function ActiveWorkout({ active }: { active: Active }) {
  const { data: allExercises, isLoading } = useExercises();
  const exercises = useMemo(() => exercisesFor(allExercises, active.dayType), [allExercises, active.dayType]);
  const { data: sets = [] } = useSessionSets(active.sessionId);
  const { data: previous = {} } = usePreviousSets(exercises, active.sessionId);
  const finish = useFinishWorkout();
  const discard = useDiscardWorkout();
  const stopRest = useRestStore((s) => s.stop);
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | 'finish' | 'discard'>(null);

  const targetSets = exercises.reduce((n, e) => n + e.target_sets, 0);
  // Count each exercise up to its target, so extra sets don't overfill the bar.
  const doneSets = exercises.reduce(
    (n, e) => n + Math.min(e.target_sets, sets.filter((s) => s.exercise_id === e.id).length),
    0,
  );
  const volume = Math.round(sets.reduce((a, s) => a + s.weight_kg * s.reps, 0));

  // Sets for exercises that were later removed from the template still count; show them too.
  const orphanNames = [...new Set(sets.filter((s) => !exercises.some((e) => e.id === s.exercise_id)).map((s) => s.exercise_name))];

  return (
    <div className="space-y-3">
      <section className="rounded-3xl border border-lift/25 bg-gradient-to-br from-lift/14 via-surface to-surface p-4">
        <div className="text-xs font-medium uppercase tracking-wider text-lift">{DAY_LABEL[active.dayType]} day · in progress</div>
        <WorkoutClock className="mt-1 block text-5xl font-bold tracking-tight" />
        <div className="tabular mt-1 text-sm text-ink-3">
          {targetSets > 0 ? `${doneSets} of ${targetSets} sets` : `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`} ·{' '}
          {volume.toLocaleString()} kg volume
        </div>
        {targetSets > 0 && <ProgressBar className="mt-3" value={doneSets} max={targetSets} accent="var(--color-lift)" />}
        <div className="mt-4 flex gap-2">
          <Button variant="danger" aria-label="Discard workout" onClick={() => setConfirm('discard')}>
            <Trash2 size={16} />
          </Button>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <ListPlus size={16} /> Edit
          </Button>
          <Button variant="primary" accent="var(--color-lift)" className="flex-1" onClick={() => setConfirm('finish')}>
            <Flag size={16} /> Finish
          </Button>
        </div>
      </section>

      <RestPresets />

      {isLoading ? (
        <Spinner />
      ) : exercises.length === 0 ? (
        <div className="rounded-3xl border border-line/70 bg-surface p-4">
          <h3 className="mb-3 font-semibold">Build your {DAY_LABEL[active.dayType]} day</h3>
          <ExerciseEditor dayType={active.dayType} />
        </div>
      ) : (
        exercises.map((ex) => (
          <ExerciseLogCard
            key={ex.id}
            exercise={ex}
            sessionId={active.sessionId}
            logged={sets.filter((s) => s.exercise_id === ex.id).sort((a, b) => a.set_number - b.set_number)}
            previous={previous[ex.id]}
          />
        ))
      )}

      {orphanNames.map((name) => (
        <div key={name} className="rounded-2xl bg-surface p-3 text-sm text-ink-3">
          {name}: {sets.filter((s) => s.exercise_name === name).length} sets logged (removed from template)
        </div>
      ))}

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title={`${DAY_LABEL[active.dayType]} exercises`}>
        <ExerciseEditor dayType={active.dayType} />
      </Sheet>

      <Sheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === 'finish' ? 'Finish workout?' : 'Discard workout?'}
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            {confirm === 'finish' ? (
              <Button
                variant="primary"
                accent="var(--color-lift)"
                className="flex-1"
                disabled={finish.isPending}
                onClick={() =>
                  finish.mutate(undefined, {
                    onSuccess: () => {
                      stopRest();
                      setConfirm(null);
                      toast.success(sets.length ? 'Workout saved 💪' : 'Empty workout discarded');
                    },
                  })
                }
              >
                Finish & save
              </Button>
            ) : (
              <Button
                variant="danger"
                className="flex-1"
                disabled={discard.isPending}
                onClick={() =>
                  discard.mutate(undefined, {
                    onSuccess: () => {
                      stopRest();
                      setConfirm(null);
                    },
                  })
                }
              >
                Discard
              </Button>
            )}
          </div>
        }
      >
        <p className="text-sm text-ink-2">
          {confirm === 'finish'
            ? sets.length
              ? `${sets.length} sets and ${volume.toLocaleString()} kg of volume will be saved to your history.`
              : 'No sets were logged, so nothing will be saved.'
            : 'All sets logged in this session will be deleted. This cannot be undone.'}
        </p>
      </Sheet>
    </div>
  );
}
