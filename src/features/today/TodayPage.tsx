import { Activity, CheckCircle2, Droplets, Dumbbell, Flame, Footprints, Moon, Pill, Play, Plus, Scale, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, WorkoutClock } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { cardioSummary } from '@/features/cardio/CardioList';
import { CARDIO_LABEL, CardioSheet } from '@/features/cardio/CardioSheet';
import { CalorieSummary } from '@/features/fuel/CalorieSummary';
import { FoodEntrySheet } from '@/features/fuel/FoodEntrySheet';
import { SupplementChecklist } from '@/features/fuel/SupplementChecklist';
import { SupplementManagerSheet } from '@/features/fuel/SupplementManagerSheet';
import { WaterTracker } from '@/features/fuel/WaterTracker';
import { WelcomeCard } from '@/features/onboarding/WelcomeCard';
import { BodyweightQuick } from '@/features/progress/BodyweightQuick';
import { useCardio } from '@/hooks/useCardio';
import { useProfile } from '@/hooks/useProfile';
import { exercisesFor, useExercises, useStartWorkout, useTodaySessions } from '@/hooks/useWorkouts';
import { todayISO } from '@/lib/date';
import { formatClock } from '@/lib/format';
import { DAY_LABEL, WEEKDAY_SHORT, dayTypeForDate, nextTrainingDay } from '@/lib/split';
import { useWorkoutStore } from '@/stores/workoutStore';
import type { CardioKind, Profile } from '@/types/db';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function WorkoutCard({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const active = useWorkoutStore((s) => s.active);
  const { data: exercises } = useExercises();
  const { data: doneToday = [] } = useTodaySessions();
  const start = useStartWorkout();
  const scheduled = dayTypeForDate(profile.split_mode, new Date());

  const shell = 'rounded-3xl border p-4';

  if (active)
    return (
      <section className={`${shell} border-lift/30 bg-gradient-to-br from-lift/16 via-surface to-surface`}>
        <div className="text-xs font-medium uppercase tracking-wider text-lift">Workout in progress</div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight">{DAY_LABEL[active.dayType]}</span>
          <WorkoutClock className="text-xl font-semibold text-ink-2" />
        </div>
        <Button variant="primary" accent="var(--color-lift)" size="lg" block className="mt-4" onClick={() => navigate('/train')}>
          Continue workout
        </Button>
      </section>
    );

  if (doneToday.length) {
    const s = doneToday[doneToday.length - 1];
    return (
      <section className={`${shell} border-fuel/25 bg-surface`}>
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-fuel" size={28} />
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-fuel">Done for today</div>
            <div className="text-xl font-bold">
              {DAY_LABEL[s.day_type]} · <span className="tabular">{formatClock(s.duration_seconds ?? 0)}</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!scheduled) {
    const next = nextTrainingDay(profile.split_mode, new Date());
    return (
      <section className={`${shell} border-line/70 bg-surface`}>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-lift-2/15 text-lift-2">
            <Moon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-bold">Rest day</div>
            <div className="text-sm text-ink-3">
              Next: {WEEKDAY_SHORT[next.date.getDay()]} · {DAY_LABEL[next.dayType]}
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/train')}>
            Train anyway
          </Button>
        </div>
      </section>
    );
  }

  const count = exercisesFor(exercises, scheduled).length;
  return (
    <section className={`${shell} border-lift/25 bg-gradient-to-br from-lift/14 via-surface to-surface`}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-lift/15 text-lift">
          <Dumbbell size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wider text-lift">Today · {profile.split_mode}</div>
          <div className="text-2xl font-bold tracking-tight">{DAY_LABEL[scheduled]} day</div>
          <div className="text-sm text-ink-3">{count ? `${count} exercises` : 'No exercises set up yet'}</div>
        </div>
      </div>
      <Button
        variant="primary"
        accent="var(--color-lift)"
        size="lg"
        block
        className="mt-4"
        disabled={start.isPending}
        onClick={() => start.mutate(scheduled, { onSuccess: () => navigate('/train') })}
      >
        <Play size={18} fill="currentColor" /> Start workout
      </Button>
    </section>
  );
}

function CardioQuick() {
  const { data = [] } = useCardio(10);
  const [open, setOpen] = useState<CardioKind | null>(null);
  const today = data.filter((c) => c.date === todayISO());
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOpen('running')}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-cardio/12 font-semibold text-cardio active:scale-[0.97]"
        >
          <Footprints size={18} /> Run
        </button>
        <button
          type="button"
          onClick={() => setOpen('jump_rope')}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-cardio/12 font-semibold text-cardio active:scale-[0.97]"
        >
          <Activity size={18} /> Jump rope
        </button>
      </div>
      {today.length > 0 && (
        <ul className="mt-3 space-y-1">
          {today.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={14} className="text-cardio" />
              <span className="font-medium">{CARDIO_LABEL[c.kind]}</span>
              <span className="tabular truncate text-ink-3">{cardioSummary(c)}</span>
            </li>
          ))}
        </ul>
      )}
      <CardioSheet open={open !== null} initialKind={open ?? 'running'} onClose={() => setOpen(null)} />
    </>
  );
}

export function TodayPage() {
  const { data: profile } = useProfile();
  const date = todayISO();
  const [foodOpen, setFoodOpen] = useState(false);
  const [suppOpen, setSuppOpen] = useState(false);
  const name = profile?.display_name?.trim();

  return (
    <>
      <PageHeader
        title={name ? `${greeting()}, ${name}` : greeting()}
        subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      />
      {!profile ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <WelcomeCard />
          <WorkoutCard profile={profile} />

          <Card
            title="Calories"
            icon={Flame}
            accent="var(--color-fuel)"
            action={
              <Button size="sm" variant="primary" accent="var(--color-fuel)" onClick={() => setFoodOpen(true)}>
                <Plus size={16} /> Log
              </Button>
            }
          >
            <CalorieSummary profile={profile} date={date} />
          </Card>

          <Card title="Water" icon={Droplets} accent="var(--color-water)">
            <WaterTracker profile={profile} date={date} />
          </Card>

          <Card title="Morning weigh-in" icon={Scale} accent="var(--color-weight)">
            <BodyweightQuick />
          </Card>

          <Card
            title="Supplements"
            icon={Pill}
            accent="var(--color-supp)"
            action={
              <IconButton label="Manage supplements" onClick={() => setSuppOpen(true)}>
                <Settings2 size={18} />
              </IconButton>
            }
          >
            <SupplementChecklist date={date} onManage={() => setSuppOpen(true)} />
          </Card>

          <Card title="Cardio" icon={Activity} accent="var(--color-cardio)">
            <CardioQuick />
          </Card>
        </div>
      )}
      <FoodEntrySheet open={foodOpen} onClose={() => setFoodOpen(false)} date={date} initialTab="saved" />
      <SupplementManagerSheet open={suppOpen} onClose={() => setSuppOpen(false)} />
    </>
  );
}
