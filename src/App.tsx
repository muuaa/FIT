import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/States';
import { Toaster } from '@/components/ui/Toaster';
import { TodayPage } from '@/features/today/TodayPage';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { language, setLanguage } from '@/lib/i18n';
import { useValidateActiveWorkout } from '@/hooks/useWorkouts';
import { useWakeLock } from '@/hooks/useWakeLock';

const TrainPage = lazy(() => import('@/features/train/TrainPage').then((m) => ({ default: m.TrainPage })));
const FuelPage = lazy(() => import('@/features/fuel/FuelPage').then((m) => ({ default: m.FuelPage })));
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })));
const LifePage = lazy(() => import('@/features/life/LifePage').then((m) => ({ default: m.LifePage })));
const HabitsPage = lazy(() => import('@/features/life/habits').then((m) => ({ default: m.HabitsPage })));
const TodosPage = lazy(() => import('@/features/life/todos').then((m) => ({ default: m.TodosPage })));
const SleepPage = lazy(() => import('@/features/life/sleep').then((m) => ({ default: m.SleepPage })));
const CheckInPage = lazy(() => import('@/features/life/checkin').then((m) => ({ default: m.CheckInPage })));
const BodyPage = lazy(() => import('@/features/life/body').then((m) => ({ default: m.BodyPage })));
const MoneyPage = lazy(() => import('@/features/life/money').then((m) => ({ default: m.MoneyPage })));
const JournalPage = lazy(() => import('@/features/life/journal').then((m) => ({ default: m.JournalPage })));
const ListsPage = lazy(() => import('@/features/life/lists').then((m) => ({ default: m.ListsPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export default function App() {
  useValidateActiveWorkout();
  useWakeLock();
  // Remount the screens when the calendar day changes so everything that reads "today" moves on
  // (an installed app is often left open overnight).
  const today = useToday();
  const { data: profile } = useProfile();
  // Switch language before rendering so every string and the layout direction match.
  if (profile && profile.language !== language()) setLanguage(profile.language);
  const lang = profile?.language ?? language();
  return (
    <>
      <AppShell key={lang}>
        <Suspense
          fallback={
            <div className="grid h-40 place-items-center">
              <Spinner />
            </div>
          }
        >
          <Routes key={`${today}-${lang}`}>
            <Route path="/" element={<TodayPage />} />
            <Route path="/train" element={<TrainPage />} />
            <Route path="/fuel" element={<FuelPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/life" element={<LifePage />} />
            <Route path="/life/habits" element={<HabitsPage />} />
            <Route path="/life/todos" element={<TodosPage />} />
            <Route path="/life/sleep" element={<SleepPage />} />
            <Route path="/life/mood" element={<CheckInPage />} />
            <Route path="/life/body" element={<BodyPage />} />
            <Route path="/life/money" element={<MoneyPage />} />
            <Route path="/life/journal" element={<JournalPage />} />
            <Route path="/life/lists" element={<ListsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
      <Toaster />
    </>
  );
}
