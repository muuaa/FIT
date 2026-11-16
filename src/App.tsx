import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/States';
import { Toaster } from '@/components/ui/Toaster';
import { TodayPage } from '@/features/today/TodayPage';
import { useValidateActiveWorkout } from '@/hooks/useWorkouts';

const TrainPage = lazy(() => import('@/features/train/TrainPage').then((m) => ({ default: m.TrainPage })));
const FuelPage = lazy(() => import('@/features/fuel/FuelPage').then((m) => ({ default: m.FuelPage })));
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export default function App() {
  useValidateActiveWorkout();
  return (
    <>
      <AppShell>
        <Suspense
          fallback={
            <div className="grid h-40 place-items-center">
              <Spinner />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<TodayPage />} />
            <Route path="/train" element={<TrainPage />} />
            <Route path="/fuel" element={<FuelPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
      <Toaster />
    </>
  );
}
