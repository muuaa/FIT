import {
  Activity,
  BedDouble,
  BookOpen,
  Droplets,
  Dumbbell,
  Flame,
  Plus,
  Scale,
  Smile,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Stepper } from '@/components/ui/Stepper';
import { useLogBodyweight } from '@/hooks/useBodyweight';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { useSetWater, useWater } from '@/hooks/useWater';
import { tick } from '@/lib/alerts';
import { num, round1 } from '@/lib/format';
import { t } from '@/lib/i18n';
import { toast } from '@/stores/toastStore';
import { useRestStore } from '@/stores/workoutStore';

const FoodEntrySheet = lazy(() => import('@/features/fuel/FoodEntrySheet').then((m) => ({ default: m.FoodEntrySheet })));
const ExpenseSheet = lazy(() => import('@/features/life/money').then((m) => ({ default: m.ExpenseSheet })));
const SleepSheet = lazy(() => import('@/features/life/sleep').then((m) => ({ default: m.SleepSheet })));
const CardioSheet = lazy(() => import('@/features/cardio/CardioSheet').then((m) => ({ default: m.CardioSheet })));
const CheckInForm = lazy(() => import('@/features/life/checkin').then((m) => ({ default: m.CheckInForm })));

type Action = 'expense' | 'food' | 'water' | 'weight' | 'mood' | 'sleep' | 'cardio' | 'journal' | 'habit' | 'workout';

const ACTIONS: { id: Action; label: string; icon: LucideIcon; accent: string }[] = [
  { id: 'expense', label: 'Expense', icon: Wallet, accent: 'var(--color-money)' },
  { id: 'food', label: 'Food', icon: Utensils, accent: 'var(--color-fuel)' },
  { id: 'water', label: 'Water', icon: Droplets, accent: 'var(--color-water)' },
  { id: 'weight', label: 'Weight', icon: Scale, accent: 'var(--color-weight)' },
  { id: 'mood', label: 'Mood', icon: Smile, accent: 'var(--color-mood)' },
  { id: 'sleep', label: 'Sleep', icon: BedDouble, accent: 'var(--color-sleep)' },
  { id: 'cardio', label: 'Cardio', icon: Activity, accent: 'var(--color-cardio)' },
  { id: 'journal', label: 'Journal', icon: BookOpen, accent: 'var(--color-journal)' },
  { id: 'habit', label: 'Habits', icon: Flame, accent: 'var(--color-habit)' },
  { id: 'workout', label: 'Workout', icon: Dumbbell, accent: 'var(--color-lift)' },
];


function WeightQuick({ onDone }: { onDone: () => void }) {
  const today = useToday();
  const log = useLogBodyweight();
  const [value, setValue] = useState('');
  const n = num(value);
  return (
    <div className="space-y-3">
      <Stepper label={t('Morning weight · kg')} value={value} onChange={setValue} step={0.1} decimals={1} fallback={70} />
      <Button
        variant="primary"
        accent="var(--color-weight)"
        size="lg"
        block
        disabled={n === null || n < 20 || n > 400}
        onClick={() =>
          n !== null &&
          log.mutate({ date: today, weight_kg: round1(n) }, { onSuccess: () => (toast.success(t('Logged {kg} kg', { kg: round1(n) })), onDone()) })
        }
      >
        {t('Save weight')}
      </Button>
    </div>
  );
}

/** Floating ✚ button: log anything from anywhere. */
export function QuickAdd() {
  const navigate = useNavigate();
  const today = useToday();
  const { data: profile } = useProfile();
  const { data: ml = 0 } = useWater(today);
  const setWater = useSetWater(today);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState<Action | null>(null);
  // Sit above the rest-timer bar when it's showing, so its buttons stay reachable.
  const resting = useRestStore((s) => s.endsAt !== null);

  const pick = (a: Action) => {
    tick();
    setOpen(false);
    if (a === 'water') {
      const step = profile?.water_step_ml ?? 250;
      setWater.mutate(ml + step, { onSuccess: (v) => toast.success(t('Water {ml} ml', { ml: v.toLocaleString() })) });
      return;
    }
    if (a === 'journal') return navigate('/life/journal');
    if (a === 'habit') return navigate('/life/habits');
    if (a === 'workout') return navigate('/train');
    setSheet(a);
  };
  const close = () => setSheet(null);

  return (
    <>
      <button
        type="button"
        aria-label={t('Quick add')}
        onClick={() => {
          tick();
          setOpen(true);
        }}
        className="press fixed end-4 z-40 grid size-14 place-items-center rounded-full text-bg transition-[bottom] duration-300 lg:end-8 lg:!bottom-8"
        style={{
          bottom: `calc(${resting ? '10.4rem' : '5.9rem'} + env(safe-area-inset-bottom))`,
          background: 'linear-gradient(145deg, color-mix(in oklab, var(--color-accent) 80%, white), var(--color-accent) 55%, color-mix(in oklab, var(--color-us) 70%, var(--color-accent)))',
          boxShadow: '0 12px 30px -8px color-mix(in oklab, var(--color-accent) 70%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.4)',
        }}
      >
        <Plus size={28} strokeWidth={2.6} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('Quick add')}>
        <div className="grid grid-cols-3 gap-2.5 pb-2 min-[400px]:grid-cols-4">
          {ACTIONS.map(({ id, label, icon: Icon, accent }, i) => (
            <button
              key={id}
              type="button"
              onClick={() => pick(id)}
              className="press animate-pop flex flex-col items-center gap-2 rounded-[22px] border border-white/[0.06] bg-white/[0.035] px-1 py-3.5"
              style={{ animationDelay: `${i * 18}ms` }}
            >
              <span
                className="grid size-11 place-items-center rounded-2xl"
                style={{ background: `linear-gradient(145deg, color-mix(in oklab, ${accent} 34%, transparent), color-mix(in oklab, ${accent} 12%, transparent))`, color: accent }}
              >
                <Icon size={21} strokeWidth={2.2} />
              </span>
              <span className="text-[12.5px] font-medium text-ink-2">{t(label)}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'weight'} onClose={close} title={t('Morning weigh-in')}>
        <WeightQuick onDone={close} />
      </Sheet>
      <Suspense fallback={null}>
        {sheet === 'food' && <FoodEntrySheet open onClose={close} date={today} initialTab="saved" />}
        {sheet === 'expense' && <ExpenseSheet open onClose={close} date={today} />}
        {sheet === 'sleep' && <SleepSheet open onClose={close} date={today} />}
        {sheet === 'cardio' && <CardioSheet open onClose={close} />}
        {sheet === 'mood' && (
          <Sheet open onClose={close} title={t('How are you feeling?')}>
            <CheckInForm date={today} />
          </Sheet>
        )}
      </Suspense>
    </>
  );
}
