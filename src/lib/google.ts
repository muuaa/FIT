/** Google Calendar, fully connected: each person's main Google calendar is the app's calendar. */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { t } from './i18n';
import { supabase } from './supabase';
import { toast } from '@/stores/toastStore';

export interface GEvent {
  id: string;
  /** Whose Google calendar it lives in (user id). */
  owner: string;
  title: string;
  emoji: string;
  date: string;
  time: string | null;
  endDate: string;
  endTime: string | null;
  who: string; // 'both' or a user id
  repeat: 'none' | 'weekly' | 'monthly' | 'yearly';
  recurringId: string | null;
  note: string;
  link: string;
  editable: boolean;
  uid: string;
}

export interface GStatus {
  configured: boolean;
  mine: boolean;
  myEmail: string;
  partner: boolean;
}

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Amman';

const MESSAGES: Record<string, string> = {
  'not-connected': 'Connect your Google Calendar first.',
  'partner-not-connected': 'Your partner hasn’t connected their Google Calendar yet.',
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error(t('Sign in to use Google Calendar.'));
  const { data, error } = await supabase.functions.invoke('google', { body: { tz: zone(), ...body } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error : null;
    throw new Error(t(MESSAGES[msg ?? ''] ?? msg ?? error.message));
  }
  return data as T;
}

export function useGoogleStatus() {
  return useQuery({ queryKey: ['google-status'], queryFn: () => call<GStatus>({ action: 'status' }), enabled: Boolean(supabase), staleTime: 60_000, retry: 1 });
}

/** Both of your Google events between two dates. */
export function useGoogleEvents(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['google-events', from, to],
    enabled: enabled && Boolean(supabase),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => (await call<{ events: GEvent[]; failed: string[] }>({ action: 'list', from, to })),
  });
}

/** Sends you to Google to allow calendar access; Google brings you back to Plan. */
export async function connectGoogle(): Promise<void> {
  const { url } = await call<{ url: string }>({ action: 'start' });
  window.location.href = url;
}

export const disconnectGoogle = () => call<{ ok: boolean }>({ action: 'disconnect' });

export type GEventInput = Pick<GEvent, 'title' | 'emoji' | 'date' | 'time' | 'who' | 'repeat' | 'note'> & {
  durationMin: number;
  id?: string;
  owner?: string;
  recurringId?: string | null;
  /** Apply to every repeat of a repeating event (otherwise just this one). */
  series?: boolean;
};

export const saveGoogleEvent = (event: GEventInput) => call<{ ok: boolean }>({ action: 'save', event });
export const deleteGoogleEvent = (e: GEvent, series: boolean) =>
  call<{ ok: boolean }>({ action: 'delete', owner: e.owner, id: e.id, recurringId: e.recurringId, series });

/** Does an event fall on this day? (all-day events end the day before their end date). */
export function gOn(e: GEvent, date: string): boolean {
  if (e.time === null) return e.date <= date && date < e.endDate;
  const last = e.endTime === '00:00' && e.endDate > e.date ? prevDay(e.endDate) : e.endDate;
  return e.date <= date && date <= last;
}
function prevDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Coming back from Google's sign-in (?google=connected|cancelled|…): say how it went. */
export function useGoogleReturn(): void {
  const qc = useQueryClient();
  useEffect(() => {
    const url = new URL(window.location.href);
    const r = url.searchParams.get('google');
    if (!r) return;
    url.searchParams.delete('google');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    // The app has just reopened: wait for the launch animation to lift so the message is seen.
    const id = window.setTimeout(() => {
      if (r === 'connected') toast.success(t('Google Calendar connected'));
      else if (r === 'cancelled') toast.error(t('Google Calendar wasn’t connected.'));
      else toast.error(t('Couldn’t connect Google Calendar. Try again.'));
    }, 1100);
    void qc.invalidateQueries({ queryKey: ['google-status'] });
    void qc.invalidateQueries({ queryKey: ['google-events'] });
    return () => window.clearTimeout(id);
  }, [qc]);
}
