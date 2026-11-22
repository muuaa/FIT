import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, BellRing, Plus, Send, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/States';
import { Toggle } from '@/components/ui/Toggle';
import { WeekdayPicker } from '@/components/ui/WeekdayPicker';

import { t } from '@/lib/i18n';
import { disablePush, enablePush, pushStatus, sendTestPush, type PushStatus } from '@/lib/push';
import { cloudEnabled, supabase } from '@/lib/supabase';
import { toast } from '@/stores/toastStore';

type Kind = 'water' | 'supplements' | 'weighin' | 'workout' | 'journal' | 'bedtime' | 'habits' | 'custom';

interface Reminder {
  id: string;
  kind: Kind;
  title: string;
  times: string[];
  days: number[];
  enabled: boolean;
  smart: boolean;
  tz: string;
}

const PRESETS: { kind: Exclude<Kind, 'custom'>; emoji: string; label: string; times: string[]; smart: string | null }[] = [
  { kind: 'water', emoji: '💧', label: 'Drink water', times: ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'], smart: 'Stop once you hit your water goal' },
  { kind: 'supplements', emoji: '💊', label: 'Supplements', times: ['09:00'], smart: 'Skip once all are ticked' },
  { kind: 'weighin', emoji: '⚖️', label: 'Morning weigh-in', times: ['08:00'], smart: 'Skip if you already weighed in' },
  { kind: 'workout', emoji: '🏋️', label: 'Workout', times: ['17:00'], smart: 'Skip if you already trained today' },
  { kind: 'habits', emoji: '🎯', label: 'Habits', times: ['20:00'], smart: 'Skip when all habits are done' },
  { kind: 'journal', emoji: '📓', label: 'Journal', times: ['21:30'], smart: 'Skip if you already wrote today' },
  { kind: 'bedtime', emoji: '😴', label: 'Bedtime', times: ['22:30'], smart: null },
];

const KEY = ['reminders'];
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function db() {
  if (!supabase) throw new Error(t('Sign in to use reminders.'));
  return supabase;
}

async function fetchReminders(): Promise<Reminder[]> {
  const { data, error } = await db().from('reminders').select('id,kind,title,times,days,enabled,smart,tz').order('created_at');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Reminder[];
  // Keep reminders on the phone's current time zone (e.g. after travelling).
  const zone = tz();
  if (rows.some((r) => r.tz !== zone)) await db().from('reminders').update({ tz: zone }).neq('tz', zone);
  return rows;
}

function useReminders() {
  return useQuery({ queryKey: KEY, queryFn: fetchReminders, enabled: cloudEnabled, staleTime: 0, retry: 1 });
}

function useSave() {
  const qc = useQueryClient();
  return async (patch: Partial<Reminder> & { kind: Kind; title?: string }, id?: string) => {
    const row = { ...patch, tz: tz(), updated_at: new Date().toISOString() };
    qc.setQueryData<Reminder[]>(KEY, (list = []) =>
      id ? list.map((r) => (r.id === id ? { ...r, ...patch } : r)) : list,
    );
    const q = id
      ? db().from('reminders').update(row).eq('id', id)
      : db().from('reminders').upsert({ title: '', ...row }, { onConflict: 'user_id,kind,title' });
    const { error } = await q;
    if (error) toast.error(error.message);
    await qc.invalidateQueries({ queryKey: KEY });
  };
}

function Times({ times, onChange, accent }: { times: string[]; onChange: (t: string[]) => void; accent: string }) {
  const [adding, setAdding] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[...times].sort().map((tm) => (
        <span key={tm} className="tabular flex h-8 items-center gap-1 rounded-full ps-3 pe-1 text-sm font-semibold" style={{ background: `color-mix(in oklab, ${accent} 18%, transparent)` }}>
          {tm}
          <button
            type="button"
            aria-label={t('Remove {time}', { time: tm })}
            disabled={times.length === 1}
            onClick={() => onChange(times.filter((x) => x !== tm))}
            className="grid size-6 place-items-center rounded-full text-ink-2 disabled:opacity-30"
          >
            <X size={13} />
          </button>
        </span>
      ))}
      <label className="flex h-8 items-center gap-1 rounded-full bg-surface-3 px-2 text-sm text-ink-2">
        <Plus size={14} />
        <input
          type="time"
          aria-label={t('Add a time')}
          value={adding}
          onChange={(e) => {
            const v = e.target.value;
            setAdding('');
            if (v && !times.includes(v)) onChange([...times, v].sort());
          }}
          className="w-[5.5rem] bg-transparent text-ink outline-none"
        />
      </label>
    </div>
  );
}

function PresetRow({ preset, row }: { preset: (typeof PRESETS)[number]; row: Reminder | undefined }) {
  const save = useSave();
  const on = Boolean(row?.enabled);
  const accent = 'var(--color-life)';
  return (
    <li className="rounded-2xl bg-surface-2 p-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{preset.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{t(preset.label)}</div>
          {!on && <div className="tabular truncate text-xs text-ink-3">{(row?.times ?? preset.times).join(' · ')}</div>}
        </div>
        <Toggle
          checked={on}
          label={t(preset.label)}
          accent={accent}
          onChange={(v) =>
            row ? void save({ kind: preset.kind, enabled: v }, row.id) : void save({ kind: preset.kind, title: '', times: preset.times, days: [], enabled: true, smart: true })
          }
        />
      </div>
      {on && row && (
        <div className="mt-3 space-y-3 border-t border-line/60 pt-3">
          <Times times={row.times} accent={accent} onChange={(times) => void save({ kind: row.kind, times }, row.id)} />
          {preset.kind === 'workout' && !row.days.length ? (
            <p className="text-xs text-ink-3">
              {t('On your training days (Thu, Fri, Sat, Mon, Tue).')}{' '}
              <button type="button" className="font-semibold text-life" onClick={() => void save({ kind: row.kind, days: [4, 5, 6, 1, 2] }, row.id)}>
                {t('Change days')}
              </button>
            </p>
          ) : (
            <WeekdayPicker value={row.days} accent={accent} onChange={(days) => void save({ kind: row.kind, days }, row.id)} />
          )}
          {preset.smart && (
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink-2">{t(preset.smart)}</span>
              <Toggle checked={row.smart} label={t(preset.smart)} accent={accent} onChange={(smart) => void save({ kind: row.kind, smart }, row.id)} />
            </label>
          )}
        </div>
      )}
    </li>
  );
}

function CustomReminders({ rows }: { rows: Reminder[] }) {
  const save = useSave();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const add = () => {
    if (!title.trim()) return;
    if (rows.some((r) => r.title.toLowerCase() === title.trim().toLowerCase())) {
      toast.error(t('You already have a reminder with that name.'));
      return;
    }
    void save({ kind: 'custom', title: title.trim().slice(0, 80), times: [time], days: [], enabled: true, smart: false });
    setTitle('');
  };
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-2xl bg-surface-2 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
            <Toggle checked={r.enabled} label={r.title} accent="var(--color-life)" onChange={(v) => void save({ kind: 'custom', enabled: v }, r.id)} />
            <IconButton
              label={t('Delete')}
              className="size-9"
              onClick={async () => {
                await db().from('reminders').delete().eq('id', r.id);
                void qc.invalidateQueries({ queryKey: KEY });
              }}
            >
              <Trash2 size={15} />
            </IconButton>
          </div>
          {r.enabled && (
            <div className="space-y-3">
              <Times times={r.times} accent="var(--color-life)" onChange={(times) => void save({ kind: 'custom', times }, r.id)} />
              <WeekdayPicker value={r.days} accent="var(--color-life)" onChange={(days) => void save({ kind: 'custom', days }, r.id)} />
            </div>
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <Field label={t('New reminder')} className="min-w-0 flex-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Stretch for 10 minutes')} maxLength={80} />
        <Field label={t('Time')} type="time" className="w-28" value={time} onChange={(e) => setTime(e.target.value || '09:00')} />
      </div>
      <Button block variant="secondary" disabled={!title.trim()} onClick={add}>
        <Plus size={16} /> {t('Add reminder')}
      </Button>
    </div>
  );
}

function DeviceCard() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void pushStatus().then(setStatus);
  }, []);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Something went wrong'));
    } finally {
      setStatus(await pushStatus());
      setBusy(false);
    }
  };
  const Icon = status === 'on' ? BellRing : status === 'blocked' || status === 'unsupported' ? BellOff : Bell;
  return (
    <Card title={t('Notifications on this phone')} icon={Icon} accent={status === 'on' ? 'var(--color-fuel)' : 'var(--color-life)'}>
      {status === null ? (
        <Spinner />
      ) : status === 'on' ? (
        <div className="space-y-2">
          <p className="text-sm text-ink-2">{t('On. Reminders you switch on below will pop up on this phone, even when the app is closed.')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const n = await sendTestPush();
                  toast.success(n ? t('Test sent. It should arrive in a few seconds.') : t('No phone is set up to receive it yet.'));
                })
              }
            >
              <Send size={16} /> {t('Send a test')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void run(disablePush)}>
              {t('Turn off here')}
            </Button>
          </div>
        </div>
      ) : status === 'needs-install' ? (
        <p className="text-sm text-ink-2">
          {t('On iPhone and iPad, notifications only work in the installed app. Add Replete to your Home Screen (Settings → Install on your phone), open it from there, then come back here.')}
        </p>
      ) : status === 'blocked' ? (
        <p className="text-sm text-ink-2">
          {t('Notifications are blocked for this app. Allow them in your phone’s settings (Settings → Notifications → Replete, or the browser’s site settings), then come back here.')}
        </p>
      ) : status === 'unsupported' ? (
        <p className="text-sm text-ink-2">{t('This browser can’t show notifications. On iPhone, use the app installed from Safari; on Android, use Chrome.')}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-ink-2">{t('Allow notifications so reminders can reach you when the app is closed.')}</p>
          <Button variant="primary" accent="var(--color-life)" size="lg" block disabled={busy} onClick={() => void run(enablePush)}>
            <Bell size={18} /> {t('Turn on notifications')}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function RemindersPage() {
  const { data, isLoading, error } = useReminders();
  if (!cloudEnabled)
    return (
      <>
        <PageHeader title={t('Reminders')} back="/settings" />
        <p className="text-sm text-ink-3">{t('Sign in to use reminders.')}</p>
      </>
    );
  const rows = data ?? [];
  return (
    <>
      <PageHeader title={t('Reminders')} back="/settings" />
      <div className="space-y-3">
        <DeviceCard />
        <Card title={t('Reminders')} icon={Bell} accent="var(--color-life)">
          <p className="mb-3 text-xs text-ink-3">
            {t('Saved to your account, so they reach every phone where notifications are on. Times follow this phone’s time zone.')}
          </p>
          {isLoading ? (
            <Spinner />
          ) : error ? (
            <p className="text-sm text-danger">{error instanceof Error ? error.message : t('Could not load reminders')}</p>
          ) : (
            <ul className="space-y-2">
              {PRESETS.map((p) => (
                <PresetRow key={p.kind} preset={p} row={rows.find((r) => r.kind === p.kind)} />
              ))}
            </ul>
          )}
        </Card>
        <Card title={t('Your own reminders')} icon={Plus} accent="var(--color-life)">
          <CustomReminders rows={rows.filter((r) => r.kind === 'custom')} />
        </Card>
      </div>
    </>
  );
}

/** Small summary for the Settings card. */
export function useRemindersSummary(): string {
  const { data } = useReminders();
  const n = data?.filter((r) => r.enabled).length ?? 0;
  return n ? t('{n} on', { n }) : t('Off');
}

