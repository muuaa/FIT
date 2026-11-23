import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FocusMode = 'focus' | 'break';

interface FocusState {
  endsAt: number | null;
  startedAt: number | null;
  minutes: number;
  mode: FocusMode;
  label: string;
  start: (minutes: number, mode: FocusMode, label?: string) => void;
  stop: () => void;
}

/** Focus / break timer. Timestamp-based and saved, so it survives reloads and app switches. */
export const useFocusStore = create<FocusState>()(
  persist(
    (set) => ({
      endsAt: null,
      startedAt: null,
      minutes: 25,
      mode: 'focus',
      label: '',
      start: (minutes, mode, label = '') => set({ endsAt: Date.now() + minutes * 60_000, startedAt: Date.now(), minutes, mode, label }),
      stop: () => set({ endsAt: null, startedAt: null }),
    }),
    { name: 'fit.focus' },
  ),
);
