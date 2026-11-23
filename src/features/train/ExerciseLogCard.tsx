import { Check, History, Pencil, Trash2, X } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { IconButton } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { useProfile } from '@/hooks/useProfile';
import { useDeleteSet, useLogSet, useUpdateSet } from '@/hooks/useWorkouts';
import { unlockAudio } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { num, round1 } from '@/lib/format';
import { useRestStore } from '@/stores/workoutStore';
import type { Exercise, SetLog } from '@/types/db';

function fmtSet(s: Pick<SetLog, 'weight_kg' | 'reps'>) {
  return `${round1(s.weight_kg)}×${s.reps}`;
}

function LoggedSetRow({
  set,
  prev,
  sessionId,
}: {
  set: SetLog;
  prev?: SetLog;
  sessionId: string;
}) {
  const update = useUpdateSet(sessionId);
  const del = useDeleteSet(sessionId);
  const [editing, setEditing] = useState(false);
  const [w, setW] = useState(String(set.weight_kg));
  const [r, setR] = useState(String(set.reps));

  const beat = prev && (set.weight_kg > prev.weight_kg || (set.weight_kg === prev.weight_kg && set.reps > prev.reps));

  if (editing) {
    const wn = num(w);
    const rn = num(r);
    return (
      <li className="space-y-2 rounded-2xl bg-surface-2 p-2">
        <div className="flex gap-2">
          <Stepper label={t('kg')} value={w} onChange={setW} step={2.5} decimals={2} />
          <Stepper label={t('reps')} value={r} onChange={setR} step={1} inputMode="numeric" />
        </div>
        <div className="flex justify-end gap-1">
          <IconButton label={t('Cancel edit')} onClick={() => setEditing(false)}>
            <X size={18} />
          </IconButton>
          <IconButton
            label={t('Save set')}
            className="bg-lift text-bg"
            disabled={wn === null || rn === null}
            onClick={() => {
              if (wn === null || rn === null) return;
              update.mutate({ id: set.id, weight_kg: wn, reps: Math.round(rn) });
              setEditing(false);
            }}
          >
            <Check size={18} />
          </IconButton>
        </div>
      </li>
    );
  }

  return (
    <li className="flex h-11 items-center gap-3 rounded-xl bg-lift/8 ps-3 pe-1">
      <span className="grid size-6 place-items-center rounded-full bg-lift text-[11px] font-bold text-bg">{set.set_number}</span>
      <span className="tabular flex-1 font-semibold">
        {round1(set.weight_kg)} <span className="text-xs font-normal text-ink-3">kg</span> × {set.reps}
      </span>
      {prev && (
        <span className={cn('tabular text-xs', beat ? 'font-semibold text-fuel' : 'text-ink-3')}>
          {beat ? '▲ ' : ''}prev {fmtSet(prev)}
        </span>
      )}
      <IconButton label={`Edit set ${set.set_number}`} onClick={() => setEditing(true)} className="size-9">
        <Pencil size={14} />
      </IconButton>
      <IconButton label={`Delete set ${set.set_number}`} onClick={() => del.mutate(set.id)} className="size-9">
        <Trash2 size={14} />
      </IconButton>
    </li>
  );
}

export function ExerciseLogCard({
  exercise,
  sessionId,
  logged,
  previous,
}: {
  exercise: Exercise;
  sessionId: string;
  logged: SetLog[];
  previous: SetLog[] | undefined;
}) {
  const { data: profile } = useProfile();
  const startRest = useRestStore((s) => s.start);
  const logSet = useLogSet(sessionId);

  const nextNumber = logged.length + 1;
  const exactPrev = previous?.find((p) => p.set_number === nextNumber);
  // For extra sets beyond last time's count, suggest last time's final set.
  const prevForNext = exactPrev ?? previous?.[previous.length - 1];
  const lastLogged = logged[logged.length - 1];

  // Prefill the next set: carry today's working weight forward, aim for last session's reps on this set.
  const suggestWeight = lastLogged?.weight_kg ?? prevForNext?.weight_kg;
  const suggestReps = prevForNext?.reps ?? lastLogged?.reps;
  const [w, setW] = useState(suggestWeight !== undefined ? String(round1(suggestWeight)) : '');
  const [r, setR] = useState(suggestReps !== undefined ? String(suggestReps) : '');

  const previousLoaded = previous?.length ?? 0;
  useEffect(() => {
    if (suggestWeight !== undefined) setW(String(round1(suggestWeight)));
    if (suggestReps !== undefined) setR(String(suggestReps));
    // Only re-seed when moving to a new set or when history arrives, not on every refetch.
  }, [logged.length, previousLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const target = exercise.target_sets;
  const done = logged.length >= target;
  const wn = num(w);
  const rn = num(r);

  function log() {
    if (wn === null || rn === null || rn <= 0) return;
    unlockAudio();
    logSet.mutate(
      {
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        set_number: nextNumber,
        weight_kg: wn,
        reps: Math.round(rn),
      },
      { onSuccess: () => startRest(profile?.default_rest_seconds ?? 90) },
    );
  }

  return (
    <section className={cn('glass rounded-[28px] p-4', done ? 'border-lift/30' : 'border-line/70')}>
      <header className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">{exercise.name}</h3>
          <p className="tabular text-xs text-ink-3">
            Target {exercise.target_sets} × {exercise.target_reps}
          </p>
        </div>
        <span
          className={cn(
            'tabular rounded-full px-2.5 py-1 text-xs font-semibold',
            done ? 'bg-lift text-bg' : 'bg-surface-2 text-ink-2',
          )}
        >
          {logged.length}/{target}
        </span>
      </header>

      <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs">
        <History size={14} className="shrink-0 text-lift-2" />
        {previous?.length ? (
          <span className="tabular min-w-0 truncate text-ink-2">
            <span className="text-ink-3">{t('Last:')} </span>
            {previous.map(fmtSet).join(' · ')}
          </span>
        ) : (
          <span className="text-ink-3">{t('No previous session — set your baseline today.')}</span>
        )}
      </div>

      {logged.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {logged.map((s) => (
            <LoggedSetRow key={s.id} set={s} sessionId={sessionId} prev={previous?.find((p) => p.set_number === s.set_number)} />
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <Stepper label={`Set ${nextNumber} · kg`} value={w} onChange={setW} step={2.5} decimals={2} />
        <Stepper label={t('reps')} value={r} onChange={setR} step={1} inputMode="numeric" />
        <button
          type="button"
          aria-label={`Log set ${nextNumber}`}
          onClick={log}
          disabled={wn === null || rn === null || rn <= 0 || logSet.isPending}
          className={cn(
            'grid h-12 w-14 shrink-0 place-items-center rounded-2xl transition active:scale-90 disabled:opacity-40',
            done ? 'bg-surface-3 text-lift' : 'bg-lift text-bg',
          )}
        >
          <Check size={22} strokeWidth={3} />
        </button>
      </div>
      {(exactPrev || done) && (
        <p className="tabular mt-1.5 text-[11px] text-ink-3">
          {exactPrev ? t('Set {n} last time: {set}', { n: nextNumber, set: fmtSet(exactPrev) }) : t('Target reached')}
          {done && ' · this would be an extra set'}
        </p>
      )}
    </section>
  );
}
