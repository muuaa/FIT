import { create } from 'zustand';
import { setNamespace } from '@/lib/localDb';
import { supabase } from '@/lib/supabase';
import { stopSync, useSyncStore } from '@/lib/sync';
import { useRestStore, useWorkoutStore } from '@/stores/workoutStore';

export interface SessionUser {
  id: string;
  email: string;
}

export const useSession = create<{ user: SessionUser | null }>()(() => ({ user: null }));

/** Unsent changes on this device (only counts while signed in). */
export function pendingChanges(): number {
  return useSyncStore.getState().pending;
}

export async function signOut(): Promise<void> {
  stopSync();
  useWorkoutStore.getState().setActive(null);
  useRestStore.getState().stop();
  setNamespace(null);
  useSession.setState({ user: null });
  await supabase?.auth.signOut({ scope: 'local' }).catch(() => undefined);
}
