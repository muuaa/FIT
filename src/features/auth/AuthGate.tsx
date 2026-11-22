import { useQueryClient } from '@tanstack/react-query';
import { t } from '@/lib/i18n';
import { CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/States';
import { getProfile, setNamespace } from '@/lib/localDb';
import { migrateLegacyIntoAccount } from '@/lib/migrate';
import { refreshPush } from '@/lib/push';
import { cloudEnabled, supabase } from '@/lib/supabase';
import { hasSyncedBefore, startSync, stopSync, syncNow, useSyncStore } from '@/lib/sync';
import { toast } from '@/stores/toastStore';
import { AuthScreen, NewPasswordScreen } from './AuthScreen';
import { useSession } from './session';

type Phase = 'checking' | 'signedOut' | 'loading' | 'needOnline' | 'failed' | 'ready' | 'recovery';

function Splash({ children }: { children?: ReactNode }) {
  return (
    <div className="pt-safe mx-auto flex min-h-full max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size={56} />
      {children ?? <Spinner />}
    </div>
  );
}

/**
 * Decides what to show: the sign-in screen, a loading screen while the account's data is fetched
 * for the first time on this device, or the app. Local-only builds skip straight to the app.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>(cloudEnabled ? 'checking' : 'ready');
  const activeUser = useRef<string | null>(null);
  const syncError = useSyncStore((s) => s.error);

  const enter = useCallback(
    async (uid: string, email: string) => {
      if (activeUser.current === uid) return;
      activeUser.current = uid;
      setNamespace(uid);
      qc.clear();
      useSession.setState({ user: { id: uid, email } });
      startSync(uid, () => qc.invalidateQueries());

      const finish = () => {
        const moved = migrateLegacyIntoAccount();
        getProfile(); // first use of a brand-new account: create targets + default supplement shelf
        void refreshPush();
        qc.invalidateQueries();
        setPhase('ready');
        if (moved) toast.success(t('Moved {n} entries from this phone into your account', { n: moved.toLocaleString() }));
      };

      if (hasSyncedBefore()) {
        // Data is already on this device: open instantly, catch up in the background.
        finish();
        void syncNow();
        return;
      }
      // First time on this device: load the account before creating anything, so a new device
      // doesn't add a second copy of the default supplements, etc.
      setPhase('loading');
      const ok = await syncNow();
      if (activeUser.current !== uid) return;
      if (ok) finish();
      else setPhase(navigator.onLine && useSyncStore.getState().status === 'error' ? 'failed' : 'needOnline');
    },
    [qc],
  );

  useEffect(() => {
    if (!supabase) {
      setNamespace(null);
      return;
    }
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data.session?.user;
      if (u) void enter(u.id, u.email ?? '');
      else setPhase('signedOut');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPhase('recovery');
        return;
      }
      const u = session?.user;
      if (u) void enter(u.id, u.email ?? '');
      else if (event === 'SIGNED_OUT') {
        // Also covers a session that expired on its own: stop syncing and leave the account's space.
        activeUser.current = null;
        stopSync();
        setNamespace(null);
        useSession.setState({ user: null });
        qc.clear();
        setPhase('signedOut');
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [enter, qc]);

  // Sign-out from Settings clears the session store; follow it here.
  const user = useSession((s) => s.user);
  useEffect(() => {
    if (cloudEnabled && !user && phase === 'ready') {
      activeUser.current = null;
      qc.clear();
      setPhase('signedOut');
    }
  }, [user, phase, qc]);

  const retry = () => {
    const u = useSession.getState().user;
    if (!u) return;
    activeUser.current = null;
    void enter(u.id, u.email);
  };

  switch (phase) {
    case 'checking':
      return <Splash />;
    case 'signedOut':
      return <AuthScreen />;
    case 'recovery':
      return (
        <NewPasswordScreen
          onDone={() => {
            toast.success(t('Password updated'));
            const u = useSession.getState().user;
            if (u) setPhase('ready');
            else setPhase('signedOut');
          }}
        />
      );
    case 'loading':
      return (
        <Splash>
          <Spinner />
          <p className="text-sm text-ink-2">{t('Loading your data…')}</p>
        </Splash>
      );
    case 'needOnline':
    case 'failed':
      return (
        <Splash>
          {phase === 'needOnline' ? <CloudOff className="text-ink-3" /> : <TriangleAlert className="text-lift" />}
          <p className="text-sm text-ink-2">
            {phase === 'needOnline'
              ? t('Connect to the internet once to load your account on this device. After that it works offline.')
              : t("Couldn't load your account: {error}", { error: syncError ?? t('unknown error') })}
          </p>
          <Button variant="secondary" onClick={retry}>
            <RefreshCw size={16} /> {t('Try again')}
          </Button>
        </Splash>
      );
    default:
      return <>{children}</>;
  }
}
