import {
  Activity,
  ArrowDown,
  ArrowUp,
  BedDouble,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  LayoutList,
  ListTodo,
  Moon,
  Pill,
  Play,
  Plus,
  Scale,
  Settings2,
  Smile,
  Wallet,
} from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { DayHero } from './DayHero';
import { BodyweightQuick } from '@/features/progress/BodyweightQuick';
import { useCardio } from '@/hooks/useCardio';
import { useProfile } from '@/hooks/useProfile';
import { exercisesFor, useExercises, useStartWorkout, useTodaySessions } from '@/hooks/useWorkouts';
import { todayISO } from '@/lib/date';
import { formatClock } from '@/lib/format';
import { dayLabel, dayTypeForDate, nextTrainingDay } from '@/lib/split';
import { weekdayShort } from '@/lib/date';
import { useActiveWorkout } from '@/stores/workoutStore';
import type { CardioKind, Profile, TodayCard } from '@/types/db';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { CheckInForm } from '@/features/life/checkin';
import { StepsToday } from '@/features/life/body';
import { HabitsToday } from '@/features/life/habits';
import { JournalToday } from '@/features/life/journal';
import { MoneyToday } from '@/features/life/money';
import { SleepToday } from '@/features/life/sleep';
import { TodosToday } from '@/features/life/todos';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { locale, t , tn} from '@/lib/i18n';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return t('Good morning');
  if (h < 18) return t('Good afternoon');
  return t('Good evening');
}

function WorkoutCard({ profile }: { profile: Profile }) {
  const navigate = useNavigate();
  const active = useActiveWorkout();
  const { data: exercises } = useExercises();
  const { data: doneToday = [] } = useTodaySessions();
  const start = useStartWorkout();
  const scheduled = dayTypeForDate(profile.split_mode, new Date());

  const shell = 'glass rounded-[28px] p-4';

  if (active)
    return (
      <section className={`${shell} border-lift/30 bg-gradient-to-br from-lift/16 via-surface to-surface`}>
        <div className="text-xs font-medium uppercase tracking-wider text-lift">{t('Workout in progress')}</div>
        <div className="mt-1 flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight">{dayLabel(active.dayType)}</span>
          <WorkoutClock className="text-xl font-semibold text-ink-2" />
        </div>
        <Button variant="primary" accent="var(--color-lift)" size="lg" block className="mt-4" onClick={() => navigate('/train')}>
          {t('Continue workout')}
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
            <div className="text-xs font-medium uppercase tracking-wider text-fuel">{t('Done for today')}</div>
            <div className="text-xl font-bold">
              {dayLabel(s.day_type)} · <span className="tabular">{formatClock(s.duration_seconds ?? 0)}</span>
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
            <div className="text-xl font-bold">{t('Rest day')}</div>
            <div className="text-sm text-ink-3">
              {t('Next: {day} · {type}', { day: weekdayShort(next.date.getDay()), type: dayLabel(next.dayType) })}
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/train')}>
            {t('Train anyway')}
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
          <div className="text-2xl font-bold tracking-tight">{dayLabel(scheduled)} day</div>
          <div className="text-sm text-ink-3">{count ? tn(count, '{n} exercise', '{n} exercises') : t('No exercises set up yet')}</div>
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
        <Play size={18} fill="currentColor" /> {count ? t('Start workout') : t('Set up & start {day}', { day: dayLabel(scheduled) })}
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
          <Footprints size={18} /> {t('Run')}
        </button>
        <button
          type="button"
          onClick={() => setOpen('jump_rope')}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-cardio/12 font-semibold text-cardio active:scale-[0.97]"
        >
          <Activity size={18} /> {t('Jump rope')}
        </button>
      </div>
      {today.length > 0 && (
        <ul className="mt-3 space-y-1">
          {today.map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={14} className="text-cardio" />
              <span className="font-medium">{t(CARDIO_LABEL[c.kind])}</span>
              <span className="tabular truncate text-ink-3">{cardioSummary(c)}</span>
            </li>
          ))}
        </ul>
      )}
      <CardioSheet open={open !== null} initialKind={open ?? 'running'} onClose={() => setOpen(null)} />
    </>
  );
}

export const CARD_LABEL: Record<TodayCard, string> = {
  workout: 'Workout',
  calories: 'Calories',
  water: 'Water',
  weight: 'Morning weigh-in',
  supplements: 'Supplements',
  cardio: 'Cardio',
  habits: 'Habits',
  todos: 'To-dos',
  sleep: 'Sleep',
  checkin: 'Mood & energy',
  steps: 'Steps',
  money: 'Money',
  journal: 'Journal',
};
export const ALL_CARDS = Object.keys(CARD_LABEL) as TodayCard[];

/** Choose which cards Today shows, and their order. Used here and in Settings. */
export function TodayCardsEditor() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  if (!profile) return null;
  const shown = profile.today_cards.filter((c) => ALL_CARDS.includes(c));
  const hidden = ALL_CARDS.filter((c) => !shown.includes(c));
  const save = (cards: TodayCard[]) => update.mutate({ today_cards: cards });
  const move = (i: number, d: -1 | 1) => {
    const next = [...shown];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    save(next);
  };
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {shown.map((c, i) => (
          <li key={c} className="flex items-center gap-1 rounded-2xl bg-surface-2 py-1 ps-3 pe-1">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{t(CARD_LABEL[c])}</span>
            <IconButton label={t('Move up')} disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp size={16} />
            </IconButton>
            <IconButton label={t('Move down')} disabled={i === shown.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown size={16} />
            </IconButton>
            <Toggle checked label={t(CARD_LABEL[c])} accent="var(--color-fuel)" onChange={() => save(shown.filter((x) => x !== c))} />
          </li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-3">{t('Hidden')}</div>
          <ul className="space-y-1.5">
            {hidden.map((c) => (
              <li key={c} className="flex items-center gap-2 rounded-2xl bg-surface-2/60 py-2.5 ps-3 pe-2">
                <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{t(CARD_LABEL[c])}</span>
                <Toggle checked={false} label={t(CARD_LABEL[c])} onChange={() => save([...shown, c])} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function TodayPage() {
  const { data: profile } = useProfile();
  const date = useToday();
  const [foodOpen, setFoodOpen] = useState(false);
  const [suppOpen, setSuppOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const navigate = useNavigate();
  const name = profile?.display_name?.trim();

  const cards: Record<TodayCard, () => ReactNode> = {
    workout: () => <WorkoutCard profile={profile!} />,
    calories: () => (
      <Card
        title={t('Calories')}
        icon={Flame}
        accent="var(--color-fuel)"
        action={
          <Button size="sm" variant="primary" accent="var(--color-fuel)" onClick={() => setFoodOpen(true)}>
            <Plus size={16} /> {t('Log')}
          </Button>
        }
      >
        <CalorieSummary profile={profile!} date={date} />
      </Card>
    ),
    water: () => (
      <Card title={t('Water')} icon={Droplets} accent="var(--color-water)">
        <WaterTracker profile={profile!} date={date} />
      </Card>
    ),
    weight: () => (
      <Card title={t('Morning weigh-in')} icon={Scale} accent="var(--color-weight)">
        <BodyweightQuick />
      </Card>
    ),
    supplements: () => (
      <Card
        title={t('Supplements')}
        icon={Pill}
        accent="var(--color-supp)"
        action={
          <IconButton label={t('Manage supplements')} onClick={() => setSuppOpen(true)}>
            <Settings2 size={18} />
          </IconButton>
        }
      >
        <SupplementChecklist date={date} onManage={() => setSuppOpen(true)} />
      </Card>
    ),
    cardio: () => (
      <Card title={t('Cardio')} icon={Activity} accent="var(--color-cardio)">
        <CardioQuick />
      </Card>
    ),
    habits: () => (
      <Card title={t('Habits')} icon={Flame} accent="var(--color-habit)" action={<MoreLink to="/life/habits" />}>
        <HabitsToday onAdd={() => navigate('/life/habits')} />
      </Card>
    ),
    todos: () => (
      <Card title={t('To-dos')} icon={ListTodo} accent="var(--color-todo)" action={<MoreLink to="/life/todos" />}>
        <TodosToday limit={5} />
      </Card>
    ),
    sleep: () => (
      <Card title={t('Sleep')} icon={BedDouble} accent="var(--color-sleep)" action={<MoreLink to="/life/sleep" />}>
        <SleepToday />
      </Card>
    ),
    checkin: () => (
      <Card title={t('Mood & energy')} icon={Smile} accent="var(--color-mood)" action={<MoreLink to="/life/mood" />}>
        <CheckInForm date={date} />
      </Card>
    ),
    steps: () => (
      <Card title={t('Steps')} icon={Footprints} accent="var(--color-steps)" action={<MoreLink to="/life/body" />}>
        <StepsToday />
      </Card>
    ),
    money: () => (
      <Card title={t('Money')} icon={Wallet} accent="var(--color-money)" action={<MoreLink to="/life/money" />}>
        <MoneyToday />
      </Card>
    ),
    journal: () => (
      <Card title={t('Journal')} icon={BookOpen} accent="var(--color-journal)" action={<MoreLink to="/life/journal" label={t('Write')} />}>
        <Link to="/life/journal" className="block">
          <JournalToday />
        </Link>
      </Card>
    ),
  };
  return (
    <>
      <PageHeader
        title={name ? `${greeting()}, ${name}` : greeting()}
        subtitle={new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}
      />
      {!profile ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <WelcomeCard />
          <DayHero />
          {profile.today_cards
            .filter((c) => c in cards)
            .map((c) => (
              <Fragment key={c}>{cards[c]()}</Fragment>
            ))}
          <Button block variant="ghost" onClick={() => setCustomize(true)}>
            <LayoutList size={16} /> {t('Customize this screen')}
          </Button>
        </div>
      )}
      <FoodEntrySheet open={foodOpen} onClose={() => setFoodOpen(false)} date={date} initialTab="saved" />
      <SupplementManagerSheet open={suppOpen} onClose={() => setSuppOpen(false)} />
      <Sheet open={customize} onClose={() => setCustomize(false)} title={t('Today screen')}>
        <p className="mb-3 text-sm text-ink-3">{t('Pick the cards you want and put them in your order.')}</p>
        <TodayCardsEditor />
      </Sheet>
    </>
  );
}

function MoreLink({ to, label }: { to: string; label?: string }) {
  return (
    <Link to={to} className="flex h-9 items-center gap-0.5 rounded-xl px-2 text-xs font-semibold text-ink-2 active:bg-surface-2">
      {label ?? t('Open')} <ChevronRight size={14} className="rtl:-scale-x-100" />
    </Link>
  );
}
