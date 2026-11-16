import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useRestStore, useWorkoutStore } from '@/stores/workoutStore';

interface AuthValue {
  session: Session | null;
  loading: boolean;
  /** True after the user opened a password-reset link; they must choose a new password. */
  recovering: boolean;
  clearRecovering: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const apply = (s: Session | null) => {
      const nextId = s?.user.id ?? null;
      if (userIdRef.current !== nextId) {
        // Different (or no) user: never let one account's cached data leak into another's.
        if (userIdRef.current !== null) {
          qc.clear();
          useWorkoutStore.getState().setActive(null);
          useRestStore.getState().stop();
        }
        userIdRef.current = nextId;
      }
      setSession(s);
    };

    supabase.auth.getSession().then(({ data }) => {
      apply(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      apply(s);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  return (
    <AuthContext.Provider value={{ session, loading, recovering, clearRecovering: () => setRecovering(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
