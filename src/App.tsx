import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Spinner } from '@/components/ui/States';
import { Toaster } from '@/components/ui/Toaster';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { useAuth } from '@/features/auth/AuthContext';
import { MissingConfig } from '@/features/auth/MissingConfig';
import { NewPasswordSheet } from '@/features/auth/NewPasswordSheet';
import { TodayPage } from '@/features/today/TodayPage';
import { useValidateActiveWorkout } from '@/hooks/useWorkouts';
import { supabaseConfigured } from '@/lib/supabase';

const TrainPage = lazy(() => import('@/features/train/TrainPage').then((m) => ({ default: m.TrainPage })));
const FuelPage = lazy(() => import('@/features/fuel/FuelPage').then((m) => ({ default: m.FuelPage })));
const ProgressPage = lazy(() => import('@/features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function AuthedApp() {
  useValidateActiveWorkout();
  return (
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
  );
}

export default function App() {
  const { session, loading } = useAuth();
  let body;
  if (!supabaseConfigured) body = <MissingConfig />;
  else if (loading)
    body = (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  else if (!session) body = <AuthScreen />;
  else body = <AuthedApp />;
  return (
    <>
      {body}
      <NewPasswordSheet />
      <Toaster />
    </>
  );
}
