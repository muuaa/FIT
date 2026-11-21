import { Cloud, CloudOff, LogOut, RefreshCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { signOut, useSession } from '@/features/auth/session';
import { useNow } from '@/hooks/useNow';
import { cloudEnabled } from '@/lib/supabase';
import { syncNow, useSyncStore } from '@/lib/sync';

function ago(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} h ago`;
}

export function AccountCard() {
  const user = useSession((s) => s.user);
  const { status, pending, lastSyncedAt, error } = useSyncStore();
  const now = useNow(true, 30_000);
  const [confirm, setConfirm] = useState(false);
  if (!cloudEnabled || !user) return null;

  const Icon = status === 'offline' ? CloudOff : status === 'error' ? TriangleAlert : Cloud;
  const line =
    status === 'syncing'
      ? 'Syncing…'
      : status === 'offline'
        ? `Offline${pending ? ` · ${pending} change${pending === 1 ? '' : 's'} will sync when you're back online` : ''}`
        : status === 'error'
          ? `Sync problem: ${error}`
          : pending
            ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync`
            : lastSyncedAt
              ? `All synced · ${ago(now - lastSyncedAt)}`
              : 'Synced';

  return (
    <Card title="Account" icon={Icon} accent={status === 'error' ? 'var(--color-lift)' : 'var(--color-water)'}>
      <div className="mb-1 truncate text-sm font-medium">{user.email}</div>
      <p className={`text-xs ${status === 'error' ? 'text-lift' : 'text-ink-3'}`}>{line}</p>
      <p className="mt-2 text-xs text-ink-3">Sign in with the same email on any phone or tablet to see your data there.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={status === 'syncing'} onClick={() => void syncNow()}>
          <RefreshCw size={16} className={status === 'syncing' ? 'animate-spin' : ''} /> Sync now
        </Button>
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          <LogOut size={16} /> Sign out
        </Button>
      </div>
      {confirm && (
        <div className="mt-3 space-y-2 rounded-2xl bg-surface-2 p-3">
          <p className="text-sm text-ink-2">
            {pending
              ? `${pending} change${pending === 1 ? " hasn't" : "s haven't"} reached your account yet. Sync first or they'll stay only on this phone until you sign in again.`
              : 'Your data stays safe in your account. Sign in again any time to get it back.'}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
