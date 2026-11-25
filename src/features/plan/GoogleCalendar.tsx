import { ExternalLink, Loader2, Trash2, Unlink, type LucideIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useSession } from '@/features/auth/session';
import { sendActivity } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { shortDate } from '@/lib/date';
import { connectGoogle, deleteGoogleEvent, disconnectGoogle, saveGoogleEvent, useGoogleStatus, type GEvent } from '@/lib/google';
import { t } from '@/lib/i18n';
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

/** An event from Google in the day's schedule. */
export function GEventRow({ e, onOpen }: { e: GEvent; onOpen: () => void }) {
  const me = useSession((s) => s.user);
  const { partner, viewing, self } = usePartnerStore();
  const meLabel = viewing ? (self?.name ?? t('Me')) : t('Me');
  const who = e.who === 'both' ? null : e.who === me?.id ? meLabel : e.who === partner?.id ? partner.name : null;
  return (
    <li>
      <button type="button" onClick={onOpen} className="press flex w-full items-center gap-3 rounded-2xl bg-white/[0.035] px-3 py-2.5 text-start">
        <span className="tabular w-12 shrink-0 text-sm font-semibold text-todo">{e.time ?? t('All day')}</span>
        {e.emoji && <span className="text-lg">{e.emoji}</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{e.title}</span>
          {(who || e.repeat !== 'none') && (
            <span className="block text-xs text-ink-3">
              {[who, e.repeat !== 'none' ? t(e.repeat === 'weekly' ? 'Weekly' : e.repeat === 'monthly' ? 'Monthly' : 'Yearly') : null].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        <GoogleG />
      </button>
    </li>
  );
}

/** Connect (or, once connected, manage) Google Calendar. */
export function GoogleConnectCard() {
  const status = useGoogleStatus();
  const qc = useQueryClient();
  const partner = usePartnerStore((s) => s.partner);
  const [busy, setBusy] = useState(false);
  if (!supabase || status.isLoading) return null;
  const s = status.data;
  if (!s) return null;
  const go = async () => {
    setBusy(true);
    try {
      await connectGoogle();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not connect'));
      setBusy(false);
    }
  };
  if (s.mine)
    return (
      <Card title={t('Google Calendar')} icon={GIcon} accent="var(--color-todo)">
        <p className="text-sm text-ink-2">
          {t('Your plans are your Google Calendar ({email}). Anything you add, change or delete here happens there too, and the other way round.', { email: s.myEmail })}
        </p>
        {partner && <p className="mt-1 text-xs text-ink-3">{s.partner ? t('{name}’s Google Calendar is connected too.', { name: partner.name }) : t('{name} can connect theirs from their Plan tab.', { name: partner.name })}</p>}
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          disabled={busy}
          onClick={() =>
            void (async () => {
              setBusy(true);
              await disconnectGoogle().catch(() => undefined);
              await qc.invalidateQueries({ queryKey: ['google-status'] });
              setBusy(false);
            })()
          }
        >
          <Unlink size={14} /> {t('Disconnect Google Calendar')}
        </Button>
      </Card>
    );
  return (
    <Card title={t('Use your Google Calendar')} icon={GIcon} accent="var(--color-todo)">
      <p className="text-sm text-ink-2">{t('Make Google Calendar your calendar here: see your events, and add, change or delete them from the app.')}</p>
      {s.configured ? (
        <Button variant="primary" accent="var(--color-todo)" block className="mt-3" disabled={busy} onClick={() => void go()}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <GoogleG size={16} />} {t('Connect Google Calendar')}
        </Button>
      ) : (
        <p className="mt-2 rounded-2xl bg-white/[0.035] px-3 py-2.5 text-xs text-ink-3">{t('Almost ready: Google Calendar is being switched on for the app. Check back soon.')}</p>
      )}
    </Card>
  );
}

const EMOJI = ['📅', '🍽️', '🎉', '✈️', '🏥', '🦷', '💼', '🎂', '❤️', '🏋️', '🛒', '🎬', '📞', '🧹', '🚗', '🕌'];
const REPEAT: { value: GEvent['repeat']; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];
const LENGTHS = [30, 60, 90, 120, 180];

function minutesBetween(e: GEvent): number {
  if (!e.time || !e.endTime) return 60;
  const a = Date.parse(`${e.date}T${e.time}:00Z`);
  const b = Date.parse(`${e.endDate}T${e.endTime}:00Z`);
  return Math.max(15, Math.round((b - a) / 60000));
}

/** Add or edit an event in Google Calendar. */
export function GEventSheet({ event, date, open, onClose }: { event: GEvent | null; date: string; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const me = useSession((s) => s.user);
  const partner = usePartnerStore((s) => s.partner);
  const status = useGoogleStatus();
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('📅');
  const [day, setDay] = useState(date);
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState('18:00');
  const [len, setLen] = useState(60);
  const [who, setWho] = useState('both');
  const [repeat, setRepeat] = useState<GEvent['repeat']>('none');
  const [note, setNote] = useState('');
  const [series, setSeries] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = open ? (event ? `${event.owner}|${event.id}` : `new-${date}`) : null;
  if (key !== seeded) {
    setSeeded(key);
    if (open) {
      setTitle(event?.title ?? '');
      setEmoji(event?.emoji || '📅');
      setDay(event?.date ?? date);
      setAllDay(event ? event.time === null : false);
      setTime(event?.time ?? '18:00');
      setLen(event ? minutesBetween(event) : 60);
      setWho(event?.who ?? 'both');
      setRepeat(event?.repeat ?? 'none');
      setNote(event?.note ?? '');
      setSeries(false);
    }
  }
  const readOnly = Boolean(event && !event.editable);
  const isRepeat = Boolean(event?.recurringId);
  const whoOptions = [
    { value: 'both', label: t('Both of us') },
    ...(me ? [{ value: me.id, label: t('Me') }] : []),
    ...(partner && status.data?.partner ? [{ value: partner.id, label: partner.name }] : []),
  ];
  const refresh = () => qc.invalidateQueries({ queryKey: ['google-events'] });
  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await saveGoogleEvent({
        id: event?.id,
        owner: event?.owner,
        recurringId: event?.recurringId ?? null,
        series: isRepeat ? series : true,
        title: title.trim().slice(0, 120),
        emoji,
        date: day,
        time: allDay ? null : time,
        durationMin: len,
        who: event ? event.who : who,
        repeat,
        note: note.trim(),
      });
      if (!event) sendActivity('event', { title: title.trim(), when: `${shortDate(day)}${allDay ? '' : ` ${time}`}` });
      toast.success(event ? t('Saved to Google Calendar') : t('Added to Google Calendar'));
      await refresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not save'));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!event) return;
    setBusy(true);
    try {
      await deleteGoogleEvent(event, isRepeat && series);
      toast.success(t('Deleted from Google Calendar'));
      await refresh();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not delete'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={readOnly ? event!.title : event ? t('Edit event') : t('New event')}
      footer={
        readOnly ? (
          <a href={event!.link} target="_blank" rel="noreferrer" className="press flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/[0.06] text-sm font-semibold">
            <ExternalLink size={16} /> {t('Open in Google Calendar')}
          </a>
        ) : (
          <div className="flex gap-2">
            {event && (
              <IconButton label={t('Delete')} className="size-12 bg-danger/12 text-danger" disabled={busy} onClick={() => void remove()}>
                <Trash2 size={18} />
              </IconButton>
            )}
            <Button variant="primary" accent="var(--color-todo)" size="lg" className="flex-1" disabled={!title.trim() || busy} onClick={() => void save()}>
              {busy ? <Loader2 size={18} className="animate-spin" /> : event ? t('Save') : t('Add event')}
            </Button>
          </div>
        )
      }
    >
      {readOnly ? (
        <div className="space-y-2 text-sm text-ink-2">
          <p>
            {shortDate(event!.date)} · {event!.time ? `${event!.time}–${event!.endTime}` : t('All day')}
          </p>
          {event!.note && <p className="whitespace-pre-wrap">{event!.note}</p>}
          <p className="text-xs text-ink-3">{t('You were invited to this event, so only the person who created it can change it.')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label={t('What')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Dinner with family')} maxLength={120} />
          <div className="flex flex-wrap gap-1.5">
            {EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={emoji === e}
                onClick={() => setEmoji(e)}
                className={cn('press grid size-10 place-items-center rounded-xl text-lg', emoji === e ? 'bg-todo/25 ring-2 ring-todo' : 'bg-white/[0.05]')}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('Date')} type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
            {allDay ? (
              <div className="flex items-end">
                <div className="flex h-12 w-full items-center justify-center rounded-2xl bg-white/[0.04] text-sm text-ink-3">{t('All day')}</div>
              </div>
            ) : (
              <Field label={t('Time')} type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-2">{t('All day')}</span>
            <Toggle checked={allDay} label={t('All day')} accent="var(--color-todo)" onChange={setAllDay} />
          </div>
          {!allDay && (
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('How long')}</span>
              <Segmented
                value={LENGTHS.includes(len) ? len : 60}
                accent="var(--color-todo)"
                onChange={setLen}
                options={LENGTHS.map((m) => ({ value: m, label: m < 60 ? `${m}m` : `${m / 60}h`.replace('.5h', '½h') }))}
              />
            </div>
          )}
          {!event && (
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('For')}</span>
              <Segmented value={who} accent="var(--color-todo)" onChange={setWho} options={whoOptions} />
              <p className="mt-1.5 text-xs text-ink-3">
                {who === 'both'
                  ? t('Goes in your Google Calendar with {name} invited, so it’s in both.', { name: partner?.name ?? t('your partner') })
                  : who === me?.id
                    ? t('Goes in your Google Calendar.')
                    : t('Goes in {name}’s Google Calendar.', { name: partner?.name ?? '' })}
              </p>
            </div>
          )}
          {(!isRepeat || series) && (
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Repeat')}</span>
              <Segmented value={repeat} accent="var(--color-todo)" onChange={setRepeat} options={REPEAT.map((r) => ({ value: r.value, label: t(r.label) }))} />
            </div>
          )}
          {isRepeat && (
            <div className="flex items-center justify-between rounded-2xl bg-white/[0.035] px-3 py-2.5">
              <div>
                <div className="text-sm font-medium">{t('Change all repeats')}</div>
                <div className="text-xs text-ink-3">{series ? t('Saving or deleting affects every time it repeats.') : t('Only this day is changed or deleted.')}</div>
              </div>
              <Toggle checked={series} label={t('Change all repeats')} accent="var(--color-todo)" onChange={setSeries} />
            </div>
          )}
          <Field label={t('Note')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional')} />
        </div>
      )}
    </Sheet>
  );
}
