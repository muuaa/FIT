import { ArrowDown, ArrowUp, Check, Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Empty } from '@/components/ui/States';
import {
  exercisesFor,
  useAddExercise,
  useDeleteExercise,
  useExercises,
  useMoveExercise,
  useUpdateExercise,
} from '@/hooks/useWorkouts';
import { DAY_LABEL } from '@/lib/split';
import type { DayType, Exercise } from '@/types/db';

function ExerciseForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Pick<Exercise, 'name' | 'target_sets' | 'target_reps'>;
  submitLabel: string;
  onSubmit: (v: { name: string; target_sets: number; target_reps: string }) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [sets, setSets] = useState(String(initial?.target_sets ?? 3));
  const [reps, setReps] = useState(initial?.target_reps ?? '8-12');
  const setsNum = Math.round(Number(sets));
  const valid = name.trim().length > 0 && setsNum >= 1 && setsNum <= 20;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({ name: name.trim(), target_sets: setsNum, target_reps: reps.trim() || '8-12' });
        if (!initial) {
          setName('');
        }
      }}
    >
      <Field label="Exercise" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Incline DB press" />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Sets" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
        <Field label="Reps" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="8-12" />
      </div>
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" accent="var(--color-lift)" className="flex-1" disabled={!valid}>
          {initial ? <Check size={18} /> : <Plus size={18} />} {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function ExerciseRow({ ex, index, total }: { ex: Exercise; index: number; total: number }) {
  const update = useUpdateExercise();
  const del = useDeleteExercise();
  const move = useMoveExercise();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (editing)
    return (
      <li className="rounded-2xl bg-surface-2 p-3">
        <ExerciseForm
          initial={ex}
          submitLabel="Save"
          onCancel={() => setEditing(false)}
          onSubmit={(v) => {
            update.mutate({ id: ex.id, ...v });
            setEditing(false);
          }}
        />
      </li>
    );

  return (
    <li className="flex items-center gap-1 rounded-2xl bg-surface-2 py-1.5 pl-3 pr-1">
      <span className="tabular w-5 text-xs text-ink-3">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{ex.name}</div>
        <div className="tabular text-xs text-ink-3">
          {ex.target_sets} × {ex.target_reps}
        </div>
      </div>
      {confirm ? (
        <>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            Keep
          </Button>
          <Button size="sm" variant="danger" onClick={() => del.mutate(ex.id)}>
            Delete
          </Button>
        </>
      ) : (
        <>
          <IconButton label="Move up" disabled={index === 0} onClick={() => move.mutate({ exercise: ex, direction: -1 })}>
            <ArrowUp size={16} />
          </IconButton>
          <IconButton
            label="Move down"
            disabled={index === total - 1}
            onClick={() => move.mutate({ exercise: ex, direction: 1 })}
          >
            <ArrowDown size={16} />
          </IconButton>
          <IconButton label={`Edit ${ex.name}`} onClick={() => setEditing(true)}>
            <Pencil size={16} />
          </IconButton>
          <IconButton label={`Delete ${ex.name}`} onClick={() => setConfirm(true)}>
            <Trash2 size={16} />
          </IconButton>
        </>
      )}
    </li>
  );
}

/** Manage the exercise template for one day type (Push/Pull/Legs/Upper/Lower). */
export function ExerciseEditor({ dayType }: { dayType: DayType }) {
  const { data: all } = useExercises();
  const add = useAddExercise();
  const list = exercisesFor(all, dayType);
  return (
    <div className="space-y-3">
      {list.length === 0 ? (
        <Empty icon={Dumbbell} title={`No ${DAY_LABEL[dayType]} exercises yet`}>
          Add the movements you want to run on {DAY_LABEL[dayType]} days.
        </Empty>
      ) : (
        <ul className="space-y-1.5">
          {list.map((ex, i) => (
            <ExerciseRow key={ex.id} ex={ex} index={i} total={list.length} />
          ))}
        </ul>
      )}
      <div className="rounded-2xl border border-dashed border-line p-3">
        <ExerciseForm submitLabel="Add exercise" onSubmit={(v) => add.mutate({ ...v, day_type: dayType })} />
      </div>
    </div>
  );
}
