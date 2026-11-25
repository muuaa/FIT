/** Google Calendar link: your plans in Google Calendar, and Google events in Plan (via the `calendar` function). */
import { useQuery } from '@tanstack/react-query';
import { t } from './i18n';
import { supabase } from './supabase';

export interface GoogleEvent {
  uid: string;
  title: string;
  date: string;
  time: string | null;
  endDate: string;
  endTime: string | null;
  /** Whose Google Calendar it came from (user id). */
  who: string;
}

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Amman';

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error(t('Sign in to connect Google Calendar.'));
  const { data, error } = await supabase.functions.invoke('calendar', { body });
  if (error) {
    // The function explains what went wrong (e.g. a wrong address) in the response body.
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error : null;
    throw new Error(msg || error.message);
  }
  return data as T;
}

export const googleStatus = () => call<{ mine: boolean; partner: boolean }>({ action: 'status' });
export const linkGoogle = (url: string) => call<{ ok: boolean; count: number }>({ action: 'link', url });
export const unlinkGoogle = () => call<{ ok: boolean }>({ action: 'unlink' });
export const feedUrl = () => call<{ url: string }>({ action: 'feed', tz: zone() }).then((r) => r.url);

/** Opens Google Calendar's "add this calendar" page for the app's shared plans. */
export function googleSubscribeUrl(feed: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(feed.replace(/^https:/, 'webcal:'))}`;
}

/** Google events (both of you) between two dates. Quietly empty when nothing is linked or offline. */
export function useGoogleEvents(from: string, to: string) {
  return useQuery({
    queryKey: ['gcal', from, to],
    enabled: Boolean(supabase),
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      if (!navigator.onLine) return [] as GoogleEvent[];
      const r = await call<{ events: GoogleEvent[] }>({ action: 'events', from, to, tz: zone() });
      return r.events ?? [];
    },
  });
}

/** Does a Google event fall on this day? (all-day events end the day before their end date). */
export function googleOn(e: GoogleEvent, date: string): boolean {
  if (e.time === null) return e.date <= date && date < e.endDate;
  // A timed event ending exactly at midnight doesn't spill into the next day.
  const last = e.endTime === '00:00' && e.endDate > e.date ? prevDay(e.endDate) : e.endDate;
  return e.date <= date && date <= last;
}

function prevDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
