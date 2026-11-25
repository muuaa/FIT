import { lazy, Suspense, useEffect, useState } from 'react';
import { usePartnerStore } from '@/lib/partner';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/States';
import { Toaster } from '@/components/ui/Toaster';
import { TodayPage } from '@/features/today/TodayPage';
import { useProfile } from '@/hooks/useProfile';
import { useToday } from '@/hooks/useToday';
import { effectiveLanguage, language, setLanguage } from '@/lib/i18n';
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
const MoneyPage = lazy(() => import('@/features/life/money').then((m) => ({ default: m.MoneyPage })));
const ReviewPage = lazy(() => import('@/features/us/review').then((m) => ({ default: m.ReviewPage })));
const WishlistPage = lazy(() => import('@/features/us/collections').then((m) => ({ default: m.WishlistPage })));
const DatesPage = lazy(() => import('@/features/us/collections').then((m) => ({ default: m.DatesPage })));
const MemoriesPage = lazy(() => import('@/features/us/collections').then((m) => ({ default: m.MemoriesPage })));
const JournalPage = lazy(() => import('@/features/life/journal').then((m) => ({ default: m.JournalPage })));
const ListsPage = lazy(() => import('@/features/life/lists').then((m) => ({ default: m.ListsPage })));
const RemindersPage = lazy(() => import('@/features/reminders/RemindersPage').then((m) => ({ default: m.RemindersPage })));
const PlanPage = lazy(() => import('@/features/plan/PlanPage').then((m) => ({ default: m.PlanPage })));
const HealthPage = lazy(() => import('@/features/health/HealthPage').then((m) => ({ default: m.HealthPage })));
const UsPage = lazy(() => import('@/features/us/UsPage').then((m) => ({ default: m.UsPage })));
const BillsPage = lazy(() => import('@/features/admin/bills').then((m) => ({ default: m.BillsPage })));
const MealsPage = lazy(() => import('@/features/admin/meals').then((m) => ({ default: m.MealsPage })));
const ChoresPage = lazy(() => import('@/features/admin/chores').then((m) => ({ default: m.ChoresPage })));
const NotesPage = lazy(() => import('@/features/admin/notes').then((m) => ({ default: m.NotesPage })));
const InsightsPage = lazy(() => import('@/features/admin/insights').then((m) => ({ default: m.InsightsPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export default function App() {
  useValidateActiveWorkout();
  useWakeLock();
  // Remount the screens when the calendar day changes so everything that reads "today" moves on
  // (an installed app is often left open overnight).
  const today = useToday();
  const { data: profile } = useProfile();
  // Switch language before rendering so every string and the layout direction match.
  const viewing = usePartnerStore((s) => s.viewing);
  // Keep your own language while looking at your partner's data.
  if (profile && !viewing && effectiveLanguage(profile.language) !== language()) setLanguage(profile.language);
  const lang = language();
  return (
    <>
      <AppShell key={lang}>
        <Suspense
          fallback={<SlowSpinner />}
        >
          <Routes key={`${today}-${lang}-${viewing ? 'partner' : 'me'}`}>
            <Route path="/" element={<TodayPage />} />
            <Route path="/train" element={<TrainPage />} />
            <Route path="/fuel" element={<FuelPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/us" element={<UsPage />} />
            <Route path="/life" element={<LifePage />} />
            <Route path="/life/habits" element={<HabitsPage />} />
            <Route path="/life/todos" element={<TodosPage />} />
            <Route path="/life/sleep" element={<SleepPage />} />
            <Route path="/life/mood" element={<CheckInPage />} />
            <Route path="/life/money" element={<MoneyPage />} />
            <Route path="/life/journal" element={<JournalPage />} />
            <Route path="/us/review" element={<ReviewPage />} />
            <Route path="/us/wishlist" element={<WishlistPage />} />
            <Route path="/us/dates" element={<DatesPage />} />
            <Route path="/us/memories" element={<MemoriesPage />} />
            <Route path="/life/lists" element={<ListsPage />} />
            <Route path="/life/bills" element={<BillsPage />} />
            <Route path="/life/meals" element={<MealsPage />} />
            <Route path="/life/chores" element={<ChoresPage />} />
            <Route path="/life/notes" element={<NotesPage />} />
            <Route path="/life/insights" element={<InsightsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/reminders" element={<RemindersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
      <Toaster />
    </>
  );
}

/** Only show a spinner if a page takes a moment to load (a quick flash of one looks glitchy). */
function SlowSpinner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setShow(true), 350);
    return () => window.clearTimeout(id);
  }, []);
  return <div className="grid h-40 place-items-center">{show && <Spinner />}</div>;
}
