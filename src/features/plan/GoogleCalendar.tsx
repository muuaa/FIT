import { Check, ChevronDown, Copy, ExternalLink, Loader2, Unlink, type LucideIcon } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { feedUrl, googleStatus, googleSubscribeUrl, linkGoogle, unlinkGoogle, type GoogleEvent } from '@/lib/googleCalendar';
import { t, tn } from '@/lib/i18n';
import { usePartnerStore } from '@/lib/partner';
import { supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';

/** The multi-coloured Google "G", small. */
export function GoogleG({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const GIcon = ((p: { size?: number }) => <GoogleG size={p.size} />) as unknown as LucideIcon;

/** A Google event in the day's schedule (read-only; tapping opens that day in Google Calendar). */
export function GoogleEventRow({ e, meId }: { e: GoogleEvent; meId: string | undefined }) {
  const partner = usePartnerStore((s) => s.partner);
  const theirs = e.who !== meId;
  const [y, m, d] = e.date.split('-');
  return (
    <li>
      <a
        href={`https://calendar.google.com/calendar/r/day/${y}/${Number(m)}/${Number(d)}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-2xl bg-white/[0.035] px-3 py-2.5"
      >
        <span className="tabular w-12 shrink-0 text-sm font-semibold text-ink-2">{e.time ?? t('All day')}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
        {theirs && partner && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-us/25 text-[10px] font-bold text-us">{partner.name.slice(0, 1).toUpperCase()}</span>}
        <GoogleG />
      </a>
    </li>
  );
}

/** Connect Google Calendar both ways. Lives at the bottom of Plan. */
export function GoogleCalendarCard() {
  const qc = useQueryClient();
  const partner = usePartnerStore((s) => s.partner);
  const status = useQuery({ queryKey: ['gcal-status'], queryFn: googleStatus, enabled: Boolean(supabase), staleTime: 60_000 });
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  if (!supabase) return null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['gcal-status'] });
    void qc.invalidateQueries({ queryKey: ['gcal'] });
  };
  const connect = async () => {
    setBusy('link');
    try {
      const r = await linkGoogle(url.trim());
      toast.success(tn(r.count, 'Connected · {n} event found', 'Connected · {n} events found'));
      setUrl('');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not connect'));
    } finally {
      setBusy(null);
    }
  };
  const disconnect = async () => {
    setBusy('unlink');
    try {
      await unlinkGoogle();
      refresh();
    } finally {
      setBusy(null);
    }
  };
  const addToGoogle = async (copy: boolean) => {
    setBusy(copy ? 'copy' : 'add');
    try {
      const feed = await feedUrl();
      if (copy) {
        await navigator.clipboard.writeText(feed);
        toast.success(t('Link copied. In Google Calendar: Other calendars → + → From URL.'));
      } else window.open(googleSubscribeUrl(feed), '_blank', 'noopener');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not connect'));
    } finally {
      setBusy(null);
    }
  };

  const mine = status.data?.mine;
  return (
    <Card title={t('Google Calendar')} icon={GIcon} accent="var(--color-todo)">
      <div className="space-y-4">
        <section>
          <div className="text-sm font-semibold">{t('Your Google events in Plan')}</div>
          {status.isLoading ? (
            <Loader2 size={16} className="mt-2 animate-spin text-ink-3" />
          ) : mine ? (
            <div className="mt-2 flex items-center gap-2">
              <span className="flex flex-1 items-center gap-1.5 text-sm text-fuel">
                <Check size={16} /> {t('Connected. Your Google events show in the schedule.')}
              </span>
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void disconnect()}>
                <Unlink size={14} /> {t('Disconnect')}
              </Button>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-ink-3">{t('Paste your Google Calendar’s private address once. Your events then appear here, next to your plans.')}</p>
              <button type="button" onClick={() => setHelp((v) => !v)} className="flex items-center gap-1 text-xs font-semibold text-todo">
                {t('Where do I find it?')} <ChevronDown size={14} className={cn('transition-transform', help && 'rotate-180')} />
              </button>
              {help && (
                <ol className="list-decimal space-y-1 rounded-2xl bg-white/[0.035] py-2.5 pe-3 ps-7 text-xs text-ink-2">
                  <li>{t('On a computer (or Chrome in desktop mode), open calendar.google.com.')}</li>
                  <li>{t('Settings ⚙ → under “Settings for my calendars”, click your calendar.')}</li>
                  <li>{t('Scroll to “Integrate calendar” and copy “Secret address in iCal format”.')}</li>
                  <li>{t('Paste it below. Keep it private: anyone with it can see your calendar.')}</li>
                </ol>
              )}
              <div className="flex gap-2">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                  aria-label={t('Secret address in iCal format')}
                  className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-3 text-sm text-ink outline-none focus:border-todo"
                />
                <Button variant="primary" accent="var(--color-todo)" disabled={!url.trim() || busy !== null} onClick={() => void connect()}>
                  {busy === 'link' ? <Loader2 size={16} className="animate-spin" /> : t('Connect')}
                </Button>
              </div>
            </div>
          )}
          {partner && status.data && (
            <p className="mt-2 text-xs text-ink-3">
              {status.data.partner
                ? t('{name}’s Google events show too, marked with their initial.', { name: partner.name })
                : t('{name} can connect theirs the same way.', { name: partner.name })}
            </p>
          )}
        </section>

        <section className="border-t border-white/[0.06] pt-4">
          <div className="text-sm font-semibold">{t('Your plans in Google Calendar')}</div>
          <p className="mt-1 text-xs text-ink-3">{t('Adds your shared events to Google Calendar as a calendar called “Better Together”. It stays up to date by itself.')}</p>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <Button variant="secondary" disabled={busy !== null} onClick={() => void addToGoogle(false)}>
              {busy === 'add' ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />} {t('Add to Google Calendar')}
            </Button>
            <Button variant="ghost" disabled={busy !== null} onClick={() => void addToGoogle(true)} aria-label={t('Copy link')}>
              <Copy size={16} />
            </Button>
          </div>
        </section>
      </div>
    </Card>
  );
}
