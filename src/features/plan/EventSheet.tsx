import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useSession } from '@/features/auth/session';
import { useTableActions } from '@/hooks/useTable';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import { usePartnerStore } from '@/lib/partner';
import type { CalEvent, EventRepeat } from '@/types/db';

const EMOJI = ['📅', '🍽️', '🎉', '✈️', '🏥', '🦷', '💼', '🎂', '❤️', '🏋️', '🛒', '🎬', '📞', '🧹', '🚗', '🕌'];
const REPEAT: { value: EventRepeat; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export function EventSheet({ event, date, open, onClose }: { event: CalEvent | null; date: string; open: boolean; onClose: () => void }) {
  const actions = useTableActions('events');
  const me = useSession((s) => s.user);
  const partner = usePartnerStore((s) => s.partner);
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('📅');
  const [day, setDay] = useState(date);
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState('18:00');
  const [who, setWho] = useState('both');
  const [repeat, setRepeat] = useState<EventRepeat>('none');
  const [note, setNote] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = open ? (event?.id ?? `new-${date}`) : null;
  if (key !== seeded) {
    setSeeded(key);
    if (open) {
      setTitle(event?.title ?? '');
      setEmoji(event?.emoji ?? '📅');
      setDay(event?.date ?? date);
      setAllDay(event ? event.time === null : false);
      setTime(event?.time ?? '18:00');
      setWho(event?.who ?? 'both');
      setRepeat(event?.repeat ?? 'none');
      setNote(event?.note ?? '');
    }
  }
  const whoOptions = [
    { value: 'both', label: t('Both of us') },
    ...(me ? [{ value: me.id, label: t('Me') }] : []),
    ...(partner ? [{ value: partner.id, label: partner.name }] : []),
  ];
  const save = () => {
    if (!title.trim()) return;
    const row: CalEvent = {
      id: event?.id ?? uid(),
      title: title.trim().slice(0, 120),
      emoji,
      date: day,
      time: allDay ? null : time,
      who,
      repeat,
      note: note.trim(),
      created_at: event?.created_at ?? new Date().toISOString(),
    };
    actions.put(row);
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={event ? t('Edit event') : t('New event')}
      footer={
        <div className="flex gap-2">
          {event && (
            <IconButton
              label={t('Delete')}
              className="size-12 bg-danger/12 text-danger"
              onClick={() => {
                actions.remove(event.id, t('Deleted “{title}”', { title: event.title }));
                onClose();
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          )}
          <Button variant="primary" accent="var(--color-todo)" size="lg" className="flex-1" disabled={!title.trim()} onClick={save}>
            {event ? t('Save') : t('Add event')}
          </Button>
        </div>
      }
    >
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
        <label className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3">
          <span className="text-sm font-medium">{t('All day')}</span>
          <Toggle checked={allDay} onChange={setAllDay} label={t('All day')} accent="var(--color-todo)" />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('For')}</span>
          <Segmented size="sm" value={who} onChange={setWho} accent="var(--color-us)" options={whoOptions} />
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Repeat')}</span>
          <Segmented<EventRepeat> size="sm" value={repeat} onChange={setRepeat} accent="var(--color-todo)" options={REPEAT.map((r) => ({ value: r.value, label: t(r.label) }))} />
        </div>
        <Field label={t('Note')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional')} />
      </div>
    </Sheet>
  );
}
