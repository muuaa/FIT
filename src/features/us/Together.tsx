import { useQuery } from '@tanstack/react-query';
import { sendActivity } from '@/lib/activity';
import { CalendarHeart, Minus, Plus, Send, Target, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useSession } from '@/features/auth/session';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { tick } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { shortDate } from '@/lib/date';
import { round1 } from '@/lib/format';
import { t } from '@/lib/i18n';
import { hm } from '@/lib/life';
import { uid } from '@/lib/localDb';
import { fetchDaySnapshot, usePartnerStore, type DaySnapshot } from '@/lib/partner';
import { nextCountdown } from '@/lib/plan';
import { sendNudge } from '@/lib/push';
import { toast } from '@/stores/toastStore';
import type { Countdown, Goal } from '@/types/db';

const MOOD = ['😞', '😕', '😐', '🙂', '😄'];

// ---------------------------------------------------------------- nudges

const NUDGES = [
  { emoji: '❤️', text: 'Thinking of you' },
  { emoji: '💧', text: 'Drink some water!' },
  { emoji: '🏋️', text: 'Time to train. You’ve got this!' },
  { emoji: '😴', text: 'Bedtime. Come sleep!' },
  { emoji: '🛒', text: 'Check the shopping list' },
  { emoji: '📞', text: 'Call me when you can' },
];

export function NudgeBar() {
  const partner = usePartnerStore((s) => s.partner);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState('');
  if (!partner) return null;
  const send = async (msg: string) => {
    tick();
    setBusy(true);
    try {
      const n = await sendNudge(msg);
      toast.success(n ? t('Sent to {name}', { name: partner.name }) : t('{name} hasn’t turned on notifications yet.', { name: partner.name }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not send'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{t('Nudge {name}', { name: partner.name })}</div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {NUDGES.map((n) => (
          <button
            key={n.text}
            type="button"
            disabled={busy}
            onClick={() => void send(`${n.emoji} ${t(n.text)}`)}
            className="press flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.05] px-3.5 text-sm disabled:opacity-50"
          >
            <span>{n.emoji}</span>
            <span className="text-ink-2">{t(n.text)}</span>
          </button>
        ))}
        <button type="button" onClick={() => setCustom(true)} className="press flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-us/20 px-3.5 text-sm font-semibold text-us">
          <Send size={14} /> {t('Write…')}
        </button>
      </div>
      <Sheet
        open={custom}
        onClose={() => setCustom(false)}
        title={t('Message {name}', { name: partner.name })}
        footer={
          <Button
            variant="primary"
            accent="var(--color-us)"
            size="lg"
            block
            disabled={!text.trim() || busy}
            onClick={() => {
              void send(text.trim());
              setText('');
              setCustom(false);
            }}
          >
            <Send size={18} /> {t('Send')}
          </Button>
        }
      >
        <Field label={t('Message')} value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder={t('e.g. Pick up bread on the way home?')} autoFocus />
        <p className="mt-2 text-xs text-ink-3">{t('Arrives as a notification on their phone.')}</p>
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- side by side

function Stat({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2">
      <div className="tabular text-end text-[15px] font-semibold">{a}</div>
      <div className="w-20 text-center text-[11px] font-medium uppercase tracking-wider text-ink-3">{label}</div>
      <div className="tabular text-[15px] font-semibold">{b}</div>
    </div>
  );
}

const fmt = {
  water: (s?: DaySnapshot) => (s ? `${round1(s.waterMl / 1000)} L` : '…'),
  habits: (s?: DaySnapshot) => (s ? (s.habitsDue ? `${s.habitsDone}/${s.habitsDue}` : '—') : '…'),
  mood: (s?: DaySnapshot) => (s ? (s.mood ? MOOD[s.mood - 1] : '—') : '…'),
  sleep: (s?: DaySnapshot) => (s ? (s.sleepMin !== null ? hm(s.sleepMin) : '—') : '…'),
  trained: (s?: DaySnapshot) => (s ? (s.trained ? '✓' : '—') : '…'),
  steps: (s?: DaySnapshot) => (s ? (s.steps ? s.steps.toLocaleString() : '—') : '…'),
};

export function SideBySide() {
  const today = useToday();
  const me = useSession((s) => s.user);
  const partner = usePartnerStore((s) => s.partner);
  const opts = { staleTime: 0, refetchInterval: 60_000, refetchOnWindowFocus: true, retry: 1 } as const;
  const mine = useQuery({ queryKey: ['snap', me?.id, today], queryFn: () => fetchDaySnapshot(me!.id, today), enabled: Boolean(me && partner), ...opts });
  const theirs = useQuery({ queryKey: ['snap', partner?.id, today], queryFn: () => fetchDaySnapshot(partner!.id, today), enabled: Boolean(partner), ...opts });
  if (!partner) return null;
  const a = mine.data;
  const b = theirs.data;
  return (
    <Card title={t('Today, side by side')} icon={CalendarHeart} accent="var(--color-us)">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/[0.06] pb-2 text-sm font-semibold">
        <div className="text-end text-accent">{t('You')}</div>
        <div className="w-20" />
        <div className="text-us">{partner.name}</div>
      </div>
      <div className="divide-y divide-white/[0.05]">
        <Stat label={t('Water')} a={fmt.water(a)} b={fmt.water(b)} />
        <Stat label={t('Habits')} a={fmt.habits(a)} b={fmt.habits(b)} />
        <Stat label={t('Mood')} a={fmt.mood(a)} b={fmt.mood(b)} />
        <Stat label={t('Sleep')} a={fmt.sleep(a)} b={fmt.sleep(b)} />
        <Stat label={t('Workout')} a={fmt.trained(a)} b={fmt.trained(b)} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- countdowns

const CD_EMOJI = ['✈️', '❤️', '🎂', '💍', '🏖️', '🎉', '🏠', '🎓', '🕋', '🌙'];

export function Countdowns() {
  const today = useToday();
  const { data: rows = [] } = useTable('countdowns');
  const actions = useTableActions('countdowns');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('✈️');
  const [date, setDate] = useState('');
  const [yearly, setYearly] = useState(false);
  const list = rows
    .map((c) => ({ c, ...nextCountdown(c, today) }))
    .filter((x) => x.days >= 0)
    .sort((a, b) => a.days - b.days);
  const add = () => {
    if (!title.trim() || !date) return;
    const row: Countdown = { id: uid(), title: title.trim().slice(0, 80), emoji, date, yearly, created_at: new Date().toISOString() };
    actions.insert(row);
    setTitle('');
    setDate('');
    setYearly(false);
    setOpen(false);
  };
  return (
    <Card
      title={t('Countdowns')}
      icon={CalendarHeart}
      accent="var(--color-us)"
      action={
        <IconButton label={t('New countdown')} onClick={() => setOpen(true)}>
          <Plus size={20} />
        </IconButton>
      }
    >
      {list.length === 0 ? (
        <button type="button" onClick={() => setOpen(true)} className="press w-full rounded-2xl border border-dashed border-white/10 p-4 text-sm text-ink-3">
          {t('Count down to a trip, an anniversary or a birthday.')}
        </button>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {list.map(({ c, days, date: d }) => (
            <li key={c.id} className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.04] p-3">
              <div className="text-2xl">{c.emoji}</div>
              <div className="tabular mt-1 text-[26px] font-bold leading-none tracking-tight">{days === 0 ? t('Today!') : days}</div>
              {days > 0 && <div className="text-[11px] font-medium uppercase tracking-wider text-ink-3">{days === 1 ? t('day') : t('days')}</div>}
              <div className="mt-1 truncate text-sm font-medium">{c.title}</div>
              <div className="text-[11px] text-ink-3">{shortDate(d)}</div>
              <button
                type="button"
                aria-label={t('Delete')}
                onClick={() => actions.remove(c.id, t('Deleted “{title}”', { title: c.title }))}
                className="absolute end-2 top-2 grid size-8 place-items-center rounded-full text-ink-3"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('New countdown')}
        footer={
          <Button variant="primary" accent="var(--color-us)" size="lg" block disabled={!title.trim() || !date} onClick={add}>
            {t('Add countdown')}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t('What')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Trip to Aqaba')} maxLength={80} />
          <div className="flex flex-wrap gap-1.5">
            {CD_EMOJI.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)} className={cn('press grid size-10 place-items-center rounded-xl text-lg', emoji === e ? 'bg-us/25 ring-2 ring-us' : 'bg-white/[0.05]')}>
                {e}
              </button>
            ))}
          </div>
          <Field label={t('Date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3">
            <span className="text-sm font-medium">{t('Every year (birthday, anniversary)')}</span>
            <Toggle checked={yearly} onChange={setYearly} label={t('Every year')} accent="var(--color-us)" />
          </label>
        </div>
      </Sheet>
    </Card>
  );
}

// ---------------------------------------------------------------- shared goals

export function Goals() {
  const { data: rows = [] } = useTable('goals');
  const actions = useTableActions('goals');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const active = rows.filter((g) => !g.done_at).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const done = rows.filter((g) => g.done_at);
  const bump = (g: Goal, d: number) => {
    tick();
    const progress = Math.max(0, Math.round((g.progress + d) * 100) / 100);
    actions.put({ ...g, progress, done_at: progress >= g.target ? new Date().toISOString() : null });
    if (progress >= g.target && g.progress < g.target) {
      toast.success(t('Goal reached: {title} 🎉', { title: g.title }));
      sendActivity('goal', { title: g.title });
    }
  };
  const add = () => {
    const n = Number(target);
    if (!title.trim() || !(n > 0)) return;
    actions.insert({ id: uid(), title: title.trim().slice(0, 80), emoji: '🎯', target: n, progress: 0, unit: unit.trim().slice(0, 16), due: null, done_at: null, created_at: new Date().toISOString() });
    setTitle('');
    setTarget('');
    setUnit('');
    setOpen(false);
  };
  return (
    <Card
      title={t('Shared goals')}
      icon={Target}
      accent="var(--color-accent)"
      action={
        <IconButton label={t('New goal')} onClick={() => setOpen(true)}>
          <Plus size={20} />
        </IconButton>
      }
    >
      {active.length === 0 ? (
        <button type="button" onClick={() => setOpen(true)} className="press w-full rounded-2xl border border-dashed border-white/10 p-4 text-sm text-ink-3">
          {t('Save for a trip, walk 100 km, read 12 books… a goal you both add to.')}
        </button>
      ) : (
        <ul className="space-y-3">
          {active.map((g) => {
            const step = g.target >= 100 ? Math.round(g.target / 20) : 1;
            return (
              <li key={g.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{g.title}</span>
                  <span className="tabular text-xs text-ink-3">
                    {g.progress.toLocaleString()} / {g.target.toLocaleString()} {g.unit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <IconButton label={t('Less')} className="size-9 bg-white/[0.05]" onClick={() => bump(g, -step)}>
                    <Minus size={15} />
                  </IconButton>
                  <ProgressBar value={g.progress} max={g.target} accent="var(--color-accent)" className="h-2.5 flex-1" />
                  <IconButton label={t('More')} className="size-9 bg-accent/20 text-accent" onClick={() => bump(g, step)}>
                    <Plus size={15} />
                  </IconButton>
                  <IconButton label={t('Delete')} className="size-9" onClick={() => actions.remove(g.id, t('Deleted “{title}”', { title: g.title }))}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && <p className="mt-3 text-xs text-ink-3">{t('{n} goal(s) reached together 🎉', { n: done.length })}</p>}
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('New shared goal')}
        footer={
          <Button variant="primary" accent="var(--color-accent)" size="lg" block disabled={!title.trim() || !(Number(target) > 0)} onClick={add}>
            {t('Add goal')}
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label={t('Goal')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Save for Turkey trip')} maxLength={80} />
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('Target')} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ''))} placeholder="2000" />
            <Field label={t('Unit')} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t('e.g. $, km, books')} />
          </div>
        </div>
      </Sheet>
    </Card>
  );
}
