import { ArrowLeftRight, CalendarClock, ListChecks, Play } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { Spinner } from '@/components/ui/States';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { exercisesFor, useExercises, useStartWorkout } from '@/hooks/useWorkouts';
import { cn } from '@/lib/cn';
import { DAY_LABEL, DAY_TYPES, WEEKDAY_SHORT, dayTypeForDate, weekSchedule } from '@/lib/split';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { DayType, SplitMode } from '@/types/db';
import { ActiveWorkout } from './ActiveWorkout';
import { ExerciseEditor } from './ExerciseEditor';
import { WorkoutHistory } from './WorkoutHistory';

export function SplitSwitcher() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  if (!profile) return null;
  const today = new Date().getDay();
  return (
    <Card title="Split" icon={ArrowLeftRight} accent="var(--color-lift-2)">
      <Segmented<SplitMode>
        value={profile.split_mode}
        onChange={(split_mode) => update.mutate({ split_mode })}
        accent="var(--color-lift-2)"
        options={[
          { value: 'PPL-UL', label: 'PPL · UL' },
          { value: 'UL-PPL', label: 'UL · PPL' },
        ]}
      />
      <ol className="mt-3 grid grid-cols-5 gap-1.5">
        {weekSchedule(profile.split_mode).map(({ weekday, dayType }) => (
          <li
            key={weekday}
            className={cn(
              'flex flex-col items-center rounded-xl py-2',
              weekday === today ? 'bg-lift-2/18 ring-1 ring-lift-2/50' : 'bg-surface-2',
            )}
          >
            <span className="text-[10px] font-medium uppercase text-ink-3">{WEEKDAY_SHORT[weekday]}</span>
            <span className="text-sm font-semibold">{DAY_LABEL[dayType]}</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-center text-[11px] text-ink-3">Wed & Sun are rest days</p>
    </Card>
  );
}

function StartCard() {
  const { data: profile } = useProfile();
  const { data: exercises } = useExercises();
  const start = useStartWorkout();
  const scheduled = profile ? dayTypeForDate(profile.split_mode, new Date()) : null;
  const [pick, setPick] = useState<DayType | null>(null);
  const chosen = pick ?? scheduled ?? 'push';
  const count = exercisesFor(exercises, chosen).length;

  return (
    <section className="rounded-3xl border border-lift/25 bg-gradient-to-br from-lift/14 via-surface to-surface p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-lift">
        {scheduled ? "Today's session" : 'Rest day · optional session'}
      </div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{DAY_LABEL[chosen]}</div>
      <div className="text-sm text-ink-3">{count ? `${count} exercises` : 'No exercises yet — add them once you start'}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {DAY_TYPES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setPick(d)}
            className={cn(
              'h-8 rounded-full px-3 text-xs font-semibold transition active:scale-95',
              d === chosen ? 'bg-lift text-bg' : 'bg-surface-2 text-ink-2',
            )}
          >
            {DAY_LABEL[d]}
            {d === scheduled && ' •'}
          </button>
        ))}
      </div>
      <Button
        variant="primary"
        accent="var(--color-lift)"
        size="lg"
        block
        className="mt-4"
        disabled={start.isPending}
        onClick={() => start.mutate(chosen)}
      >
        <Play size={18} fill="currentColor" /> Start {DAY_LABEL[chosen]} workout
      </Button>
    </section>
  );
}

function TemplatesCard() {
  const { data: profile } = useProfile();
  const scheduled = profile ? dayTypeForDate(profile.split_mode, new Date()) : null;
  const [day, setDay] = useState<DayType>(scheduled ?? 'push');
  return (
    <Card title="Exercises per day" icon={ListChecks} accent="var(--color-lift)">
      <Segmented<DayType>
        size="sm"
        className="mb-3"
        value={day}
        onChange={setDay}
        accent="var(--color-lift)"
        options={DAY_TYPES.map((d) => ({ value: d, label: DAY_LABEL[d] }))}
      />
      <ExerciseEditor dayType={day} />
    </Card>
  );
}

export function TrainPage() {
  const active = useWorkoutStore((s) => s.active);
  const { data: profile } = useProfile();
  return (
    <>
      <PageHeader title="Train" subtitle={profile ? `${profile.split_mode} split` : undefined} />
      {!profile ? (
        <Spinner />
      ) : active ? (
        <ActiveWorkout active={active} />
      ) : (
        <div className="space-y-3">
          <StartCard />
          <SplitSwitcher />
          <TemplatesCard />
          <Card title="Recent workouts" icon={CalendarClock} accent="var(--color-lift)">
            <WorkoutHistory />
          </Card>
        </div>
      )}
    </>
  );
}
