/** Tell the partner about something you just did (they choose which kinds they get). Fire-and-forget. */
import { isViewingPartner } from './localDb';
import { supabase } from './supabase';

export type ActivityKind = 'workout' | 'habits' | 'event' | 'expense' | 'bill' | 'goal' | 'chore' | 'list' | 'todo' | 'pic';

export function sendActivity(kind: ActivityKind, params: Record<string, string | number> = {}): void {
  if (!supabase || isViewingPartner() || !navigator.onLine) return;
  void supabase.functions.invoke('send-reminders', { body: { activity: { kind, params } } }).catch(() => undefined);
}
