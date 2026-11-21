import { useEffect } from 'react';
import { useWorkoutStore } from '@/stores/workoutStore';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

/** Keeps the screen on while a workout is in progress, so the timers stay visible between sets. */
export function useWakeLock(): void {
  const active = useWorkoutStore((s) => s.active !== null);
  useEffect(() => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!active || !wl) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      wl.request('screen')
        .then((s) => {
          if (cancelled) void s.release().catch(() => {});
          else sentinel = s;
        })
        .catch(() => {
          /* not allowed (battery saver, iframe): ignore */
        });
    };
    acquire();
    // The browser drops the lock when the app is hidden; take it again on return.
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
