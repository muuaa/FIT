import { Activity, BedDouble, Droplets, Dumbbell, Flame, LineChart, Smile, Utensils } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/States';
import { Tile } from '@/components/ui/Tile';
import { CalorieSummary } from '@/features/fuel/CalorieSummary';
import { WaterTracker } from '@/features/fuel/WaterTracker';
import { useHabitsSummary } from '@/features/life/habits';
import { useCheckInSummary } from '@/features/life/checkin';
import { useSleepSummary } from '@/features/life/sleep';
import { useFoodEntries, sumMacros } from '@/hooks/useNutrition';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { useActiveWorkout } from '@/stores/workoutStore';
import { t } from '@/lib/i18n';
import { dayLabel, dayTypeForDate } from '@/lib/split';
import { SideBySide } from '@/features/us/Together';

export function HealthPage() {
  const today = useToday();
  const { data: profile } = useProfile();
  const { data: food = [] } = useFoodEntries(today);
  const active = useActiveWorkout();
  const kcal = Math.round(sumMacros(food).kcal);
  const scheduled = profile ? dayTypeForDate(profile.split_mode, new Date()) : null;
  const train = active ? t('In progress') : scheduled ? dayLabel(scheduled) : t('Rest day');
  return (
    <>
      <PageHeader title={t('Health')} subtitle={t('Body · Food · Sleep · Mind')} />
      {!profile ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2.5">
            <Tile to="/train" icon={Dumbbell} label={t('Training')} value={train} accent="var(--color-lift)" />
            <Tile to="/fuel" icon={Utensils} label={t('Nutrition')} value={`${kcal.toLocaleString()} kcal`} accent="var(--color-fuel)" />
            <Tile to="/life/sleep" icon={BedDouble} label={t('Sleep')} value={useSleepSummary()} accent="var(--color-sleep)" />
            <Tile to="/life/habits" icon={Flame} label={t('Habits')} value={useHabitsSummary()} accent="var(--color-habit)" />
            <Tile to="/life/mood" icon={Smile} label={t('Mood')} value={useCheckInSummary()} accent="var(--color-mood)" />
            <Tile to="/progress" icon={LineChart} label={t('Progress')} value={t('Charts')} accent="var(--color-weight)" />
          </div>
          <SideBySide />
          <Card title={t('Calories')} icon={Flame} accent="var(--color-fuel)">
            <CalorieSummary profile={profile} date={today} />
          </Card>
          <Card title={t('Water')} icon={Droplets} accent="var(--color-water)">
            <WaterTracker profile={profile} date={today} />
          </Card>
          <Card title={t('Cardio')} icon={Activity} accent="var(--color-cardio)">
            <p className="text-sm text-ink-3">{t('Log a run or jump rope with the ✚ button, or see your history in Progress.')}</p>
          </Card>
        </div>
      )}
    </>
  );
}
