import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { usePartnerStore } from '@/lib/partner';
import type { DayType } from '@/types/db';

export interface ActiveWorkout {
  sessionId: string;
  dayType: DayType;
  startedAt: number; // epoch ms
}

interface WorkoutState {
  active: ActiveWorkout | null;
  setActive: (a: ActiveWorkout | null) => void;
}

/** The in-progress workout survives reloads and app switches (persisted to localStorage). */
export const useWorkoutStore = create<WorkoutState>()(
  persist((set) => ({ active: null, setActive: (active) => set({ active }) }), { name: 'fit.activeWorkout' }),
);

interface RestState {
  endsAt: number | null; // epoch ms
  duration: number; // seconds of the current/last rest
  lastPreset: number;
  start: (seconds: number) => void;
  extend: (seconds: number) => void;
  stop: () => void;
}

export const useRestStore = create<RestState>()(
  persist(
    (set, get) => ({
      endsAt: null,
      duration: 90,
      lastPreset: 90,
      start: (seconds) => set({ endsAt: Date.now() + seconds * 1000, duration: seconds, lastPreset: seconds }),
      extend: (seconds) => {
        const { endsAt, duration } = get();
        if (!endsAt) return;
        const next = Math.max(Date.now(), endsAt + seconds * 1000);
        set({ endsAt: next, duration: Math.max(1, duration + seconds) });
      },
      stop: () => set({ endsAt: null }),
    }),
    { name: 'fit.restTimer' },
  ),
);

/** The in-progress workout, or null while looking at the partner's data (it's yours, not theirs). */
export function useActiveWorkout(): ActiveWorkout | null {
  const active = useWorkoutStore((s) => s.active);
  const viewing = usePartnerStore((s) => s.viewing);
  return viewing ? null : active;
}
