/** Things you two collect together: a wishlist & bucket list, date ideas, and your memories. */
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Camera, Dices, EyeOff, Gift, Heart, ImagePlus, Link2, Loader2, Plus, Sparkles, Star, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useSession } from '@/features/auth/session';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { sendActivity } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { parseISODate, shortDate } from '@/lib/date';
import { deleteFile, fileUrl, uploadFile } from '@/lib/files';
import { saveGoogleEvent, useGoogleStatus } from '@/lib/google';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import { usePartnerStore } from '@/lib/partner';
import { toast } from '@/stores/toastStore';
import type { DateCategory, DateIdea, IdeaStatus, Memory, MemoryType, Wish, WishType } from '@/types/db';
import { useQueryClient } from '@tanstack/react-query';

const ACCENT = 'var(--color-us)';

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(80, el.scrollHeight)}px`;
  }, [value]);
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{label}</span>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={3000}
        rows={3}
        className="w-full resize-none rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3 focus:border-us/60"
      />
    </label>
  );
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('press h-9 rounded-full px-3 text-sm', value === o.value ? 'bg-us/20 font-semibold text-ink ring-1 ring-us/60' : 'bg-white/[0.05] text-ink-2')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{children}</span>;
}

const STATUS: { value: IdeaStatus; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'planned', label: 'Planned' },
  { value: 'done', label: 'Done' },
];

function useWhoOptions() {
  const me = useSession((s) => s.user);
  const partner = usePartnerStore((s) => s.partner);
  return [
    { value: 'both', label: t('Both of us') },
    ...(me ? [{ value: me.id, label: t('Me') }] : []),
    ...(partner ? [{ value: partner.id, label: partner.name }] : []),
  ];
}

function useNameOf() {
  const me = useSession((s) => s.user);
  const { partner, self } = usePartnerStore();
  return (id: string) => (id === 'both' ? t('Both of us') : id === me?.id ? (self?.name ?? t('Me')) : id === partner?.id ? partner.name : '');
}

// ================================================================ wishlist & bucket list

const WISH_TYPES: { value: WishType; label: string; emoji: string }[] = [
  { value: 'get', label: 'Want to get', emoji: '🛍️' },
  { value: 'do', label: 'Want to do', emoji: '✨' },
  { value: 'place', label: 'Place to go', emoji: '📍' },
];
const WISH_TABS: { value: WishType; tab: string; emoji: string; empty: string }[] = [
  { value: 'get', tab: 'To get', emoji: '🛍️', empty: 'Things you’d like to buy or own: add the first one.' },
  { value: 'do', tab: 'To do', emoji: '✨', empty: 'Things you want to try or do together: add the first one.' },
  { value: 'place', tab: 'Places', emoji: '📍', empty: 'Places you want to go, near or far: add the first one.' },
];
const wishEmoji = (w: WishType) => WISH_TYPES.find((x) => x.value === w)?.emoji ?? '✨';

/** A surprise is hidden from the person it's for (unless they made it). */
export function visibleWishes(rows: Wish[], me: string | undefined): Wish[] {
  return rows.filter((w) => !(w.type === 'surprise' && w.created_by !== me && (w.for === me || w.for === 'both')));
}

export function WishlistPage() {
  const me = useSession((s) => s.user);
  const partner = usePartnerStore((s) => s.partner);
  const { data: rows = [] } = useTable('wishes');
  const [filter, setFilterState] = useState<WishType>(() => {
    try {
      const v = localStorage.getItem('fit.wish.tab') as WishType | null;
      return v && WISH_TABS.some((x) => x.value === v) ? v : 'get';
    } catch {
      return 'get';
    }
  });
  const setFilter = (v: WishType) => {
    setFilterState(v);
    try {
      localStorage.setItem('fit.wish.tab', v);
    } catch {
      /* fine */
    }
  };
  const visible = visibleWishes(rows, me?.id);
  const tab = WISH_TABS.find((x) => x.value === filter)!;
  const [sheet, setSheet] = useState<{ wish: Wish | null } | null>(null);
  const nameOf = useNameOf();
  const list = visible.filter((w) => w.type === filter).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const groups: { status: IdeaStatus; title: string }[] = [
    { status: 'planned', title: t('Planned') },
    { status: 'idea', title: t('Ideas') },
    { status: 'done', title: t('Done') },
  ];
  return (
    <>
      <PageHeader
        title={t('Wishlist')}
        subtitle={t('Things to get, do and places to go')}
        right={
          <IconButton label={t('Add')} onClick={() => setSheet({ wish: null })}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-[22px] border border-white/[0.06] bg-white/[0.04] p-1" role="tablist">
        {WISH_TABS.map((x) => {
          const on = x.value === filter;
          const n = visible.filter((w) => w.type === x.value && w.status !== 'done').length;
          return (
            <button
              key={x.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(x.value)}
              className={cn('press flex flex-col items-center gap-0.5 rounded-[18px] py-2 transition-colors', on ? 'bg-us/20 text-ink' : 'text-ink-3')}
            >
              <span className="text-xl leading-none">{x.emoji}</span>
              <span className={cn('text-[12px] leading-tight', on ? 'font-semibold' : 'font-medium')}>{t(x.tab)}</span>
              <span className="tabular text-[10px] text-ink-3">{n}</span>
            </button>
          );
        })}
      </div>
      <div className="space-y-3">
        {!list.length && (
          <Card title={t('Nothing here yet')} icon={Gift} accent={ACCENT}>
            <p className="text-sm text-ink-2">{t(tab.empty)}</p>
            <Button variant="primary" accent={ACCENT} block className="mt-3" onClick={() => setSheet({ wish: null })}>
              <Plus size={16} /> {t('Add to the list')}
            </Button>
          </Card>
        )}
        {groups.map(({ status, title }) => {
          const items = list.filter((w) => w.status === status);
          if (!items.length) return null;
          return (
            <Card key={status} title={`${title} · ${items.length}`} icon={status === 'done' ? Sparkles : Gift} accent={ACCENT}>
              <ul className="space-y-1.5">
                {items.map((w) => {
                  const secret = w.type === 'surprise' && w.created_by === me?.id;
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => setSheet({ wish: w })}
                        className={cn('press flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5 text-start', status === 'done' && 'opacity-60')}
                      >
                        <span className="text-xl">{wishEmoji(w.type)}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-[15px] font-medium', status === 'done' && 'line-through')}>{w.title}</span>
                          <span className="flex items-center gap-1 truncate text-xs text-ink-3">
                            {secret && <EyeOff size={11} className="shrink-0 text-us" />}
                            {[
                              secret ? t('Hidden from {name}', { name: partner?.name ?? t('your partner') }) : null,
                              w.for !== 'both' ? t('For {name}', { name: nameOf(w.for) }) : null,
                              w.cost ? `~${w.cost.toLocaleString()} JD` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        {w.link && <Link2 size={15} className="shrink-0 text-ink-3" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>
      <WishSheet open={sheet !== null} wish={sheet?.wish ?? null} defaultType={filter} onClose={() => setSheet(null)} />
    </>
  );
}

function WishSheet({ open, wish, defaultType, onClose }: { open: boolean; wish: Wish | null; defaultType: WishType; onClose: () => void }) {
  const me = useSession((s) => s.user);
  const actions = useTableActions('wishes');
  const whoOptions = useWhoOptions();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<WishType>('get');
  const [forWho, setFor] = useState('both');
  const [status, setStatus] = useState<IdeaStatus>('idea');
  const [cost, setCost] = useState('');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = open ? (wish?.id ?? 'new') : null;
  if (key !== seeded) {
    setSeeded(key);
    if (open) {
      setTitle(wish?.title ?? '');
      setType(wish?.type ?? defaultType);
      setFor(wish?.for ?? 'both');
      setStatus(wish?.status ?? 'idea');
      setCost(wish?.cost ? String(wish.cost) : '');
      setLink(wish?.link ?? '');
      setNote(wish?.note ?? '');
    }
  }
  const save = () => {
    if (!title.trim()) return;
    const n = Number(cost);
    const row: Wish = {
      id: wish?.id ?? uid(),
      title: title.trim().slice(0, 120),
      type,
      for: forWho,
      status,
      cost: n > 0 ? n : null,
      link: link.trim().slice(0, 500),
      note: note.trim(),
      created_by: wish?.created_by ?? me?.id ?? '',
      created_at: wish?.created_at ?? new Date().toISOString(),
    };
    actions.put(row);
    // Never tell the other person about a surprise.
    if (!wish && type !== 'surprise') sendActivity('list', { item: row.title, list: t('Wishlist') });
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={wish ? t('Edit') : t('Add to the wishlist')}
      footer={
        <div className="flex gap-2">
          {wish && (
            <IconButton
              label={t('Delete')}
              className="size-12 bg-danger/12 text-danger"
              onClick={() => {
                actions.remove(wish.id, t('Deleted “{title}”', { title: wish.title }));
                onClose();
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          )}
          <Button variant="primary" accent={ACCENT} size="lg" className="flex-1" disabled={!title.trim()} onClick={save}>
            {wish ? t('Save') : t('Add')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t('What')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Polaroid camera, Visit Petra')} maxLength={120} />
        <div>
          <Label>{t('Type')}</Label>
          <Chips value={type} onChange={setType} options={WISH_TYPES.map((w) => ({ value: w.value, label: `${w.emoji} ${t(w.label)}` }))} />
        </div>
        <div>
          <Label>{t('For')}</Label>
          <Segmented value={forWho} accent={ACCENT} onChange={setFor} options={whoOptions} />
        </div>
        {wish && (
          <div>
            <Label>{t('Status')}</Label>
            <Segmented value={status} accent={ACCENT} onChange={setStatus} options={STATUS.map((s) => ({ value: s.value, label: t(s.label) }))} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('About how much')} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0" suffix="JD" />
          <Field label={t('Link')} type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
        </div>
        {wish?.link && (
          <a href={wish.link} target="_blank" rel="noreferrer" className="press flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/[0.05] text-sm font-semibold">
            <Link2 size={15} /> {t('Open link')}
          </a>
        )}
        <TextArea label={t('Note')} value={note} onChange={setNote} placeholder={t('Optional')} />
      </div>
    </Sheet>
  );
}

// ================================================================ date ideas

const CATEGORIES: { value: DateCategory; label: string; emoji: string }[] = [
  { value: 'movie', label: 'Movie night', emoji: '🎬' },
  { value: 'game', label: 'Game night', emoji: '🎮' },
  { value: 'cook', label: 'Cook together', emoji: '🍳' },
  { value: 'study', label: 'Study together', emoji: '📚' },
  { value: 'creative', label: 'Creative', emoji: '🎨' },
  { value: 'talk', label: 'Deep talk', emoji: '💬' },
  { value: 'out', label: 'Going out', emoji: '🌆' },
  { value: 'other', label: 'Other', emoji: '💕' },
];
const catEmoji = (c: DateCategory) => CATEGORIES.find((x) => x.value === c)?.emoji ?? '💕';

function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          aria-label={t('{n} stars', { n })}
          onClick={() => onChange?.(value === n ? 0 : n)}
          className={cn(onChange && 'press', 'grid place-items-center')}
        >
          <Star size={size} className={n <= value ? 'fill-[#ffc857] text-[#ffc857]' : 'text-ink-3'} />
        </button>
      ))}
    </div>
  );
}

export function DatesPage() {
  const { data: rows = [] } = useTable('date_ideas');
  const [sheet, setSheet] = useState<{ idea: DateIdea | null } | null>(null);
  const [picked, setPicked] = useState<DateIdea | null>(null);
  const ideas = rows.filter((r) => r.status === 'idea').sort((a, b) => b.created_at.localeCompare(a.created_at));
  const planned = rows.filter((r) => r.status === 'planned').sort((a, b) => (a.planned ?? '9').localeCompare(b.planned ?? '9'));
  const done = rows.filter((r) => r.status === 'done').sort((a, b) => (b.planned ?? '').localeCompare(a.planned ?? ''));
  const surprise = () => {
    if (!ideas.length) return;
    let next = ideas[Math.floor(Math.random() * ideas.length)];
    if (ideas.length > 1) while (next.id === picked?.id) next = ideas[Math.floor(Math.random() * ideas.length)];
    setPicked(next);
  };
  const Row = ({ d }: { d: DateIdea }) => (
    <li>
      <button type="button" onClick={() => setSheet({ idea: d })} className="press flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5 text-start">
        <span className="text-xl">{catEmoji(d.category)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{d.title}</span>
          <span className="block truncate text-xs text-ink-3">
            {[t(CATEGORIES.find((c) => c.value === d.category)?.label ?? 'Other'), d.planned ? shortDate(d.planned) : null].filter(Boolean).join(' · ')}
          </span>
        </span>
        {d.status === 'done' && d.rating > 0 && <Stars value={d.rating} size={12} />}
      </button>
    </li>
  );
  return (
    <>
      <PageHeader
        title={t('Date ideas')}
        subtitle={t('Plan them, go, and rate them')}
        right={
          <IconButton label={t('Add')} onClick={() => setSheet({ idea: null })}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <div className="space-y-3">
        {ideas.length > 1 && (
          <Card title={t('Can’t decide?')} icon={Dices} accent={ACCENT}>
            {picked ? (
              <button type="button" onClick={() => setSheet({ idea: picked })} className="press flex w-full items-center gap-3 rounded-2xl bg-us/12 px-3 py-3 text-start">
                <span className="text-3xl">{catEmoji(picked.category)}</span>
                <span className="text-lg font-semibold">{picked.title}</span>
              </button>
            ) : (
              <p className="text-sm text-ink-2">{t('Let the app pick one of your ideas.')}</p>
            )}
            <Button variant="secondary" block className="mt-3" onClick={surprise}>
              <Dices size={16} /> {picked ? t('Pick another') : t('Pick one for us')}
            </Button>
          </Card>
        )}
        {!rows.length && (
          <Card title={t('No date ideas yet')} icon={Heart} accent={ACCENT}>
            <p className="text-sm text-ink-2">{t('Movie night, cooking together, a deep talk… add ideas whenever you think of one.')}</p>
            <Button variant="primary" accent={ACCENT} block className="mt-3" onClick={() => setSheet({ idea: null })}>
              <Plus size={16} /> {t('Add a date idea')}
            </Button>
          </Card>
        )}
        {planned.length > 0 && (
          <Card title={t('Planned')} icon={CalendarPlus} accent={ACCENT}>
            <ul className="space-y-1.5">{planned.map((d) => <Row key={d.id} d={d} />)}</ul>
          </Card>
        )}
        {ideas.length > 0 && (
          <Card title={`${t('Ideas')} · ${ideas.length}`} icon={Sparkles} accent={ACCENT}>
            <ul className="space-y-1.5">{ideas.map((d) => <Row key={d.id} d={d} />)}</ul>
          </Card>
        )}
        {done.length > 0 && (
          <Card title={`${t('Done')} · ${done.length}`} icon={Heart} accent={ACCENT}>
            <ul className="space-y-1.5">{done.map((d) => <Row key={d.id} d={d} />)}</ul>
          </Card>
        )}
      </div>
      <DateSheet open={sheet !== null} idea={sheet?.idea ?? null} onClose={() => setSheet(null)} />
    </>
  );
}

function DateSheet({ open, idea, onClose }: { open: boolean; idea: DateIdea | null; onClose: () => void }) {
  const today = useToday();
  const qc = useQueryClient();
  const actions = useTableActions('date_ideas');
  const events = useTableActions('events');
  const google = useGoogleStatus();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DateCategory>('movie');
  const [status, setStatus] = useState<IdeaStatus>('idea');
  const [planned, setPlanned] = useState('');
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = open ? (idea?.id ?? 'new') : null;
  if (key !== seeded) {
    setSeeded(key);
    if (open) {
      setTitle(idea?.title ?? '');
      setCategory(idea?.category ?? 'movie');
      setStatus(idea?.status ?? 'idea');
      setPlanned(idea?.planned ?? '');
      setRating(idea?.rating ?? 0);
      setNote(idea?.note ?? '');
    }
  }
  const row = (): DateIdea => ({
    id: idea?.id ?? uid(),
    title: title.trim().slice(0, 120),
    category,
    status: status === 'idea' && planned ? 'planned' : status,
    planned: planned || null,
    rating: status === 'done' ? rating : 0,
    note: note.trim(),
    created_at: idea?.created_at ?? new Date().toISOString(),
  });
  const save = () => {
    if (!title.trim()) return;
    actions.put(row());
    if (!idea) sendActivity('list', { item: title.trim(), list: t('Date ideas') });
    onClose();
  };
  // Put it on both calendars: Google when connected, otherwise the app's own calendar.
  const toCalendar = async () => {
    if (!title.trim() || !planned) return;
    setBusy(true);
    try {
      const name = `${catEmoji(category)} ${title.trim()}`;
      if (google.data?.mine) {
        await saveGoogleEvent({ title: name, emoji: '', date: planned, time: '20:00', durationMin: 120, who: 'both', repeat: 'none', note: note.trim() });
        await qc.invalidateQueries({ queryKey: ['google-events'] });
      } else {
        events.put({ id: uid(), title: name, emoji: catEmoji(category), date: planned, time: '20:00', who: 'both', repeat: 'none', note: note.trim(), created_at: new Date().toISOString() });
      }
      actions.put({ ...row(), status: 'planned' });
      toast.success(t('Added to your calendar for {date}', { date: shortDate(planned) }));
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Could not save'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={idea ? idea.title : t('New date idea')}
      footer={
        <div className="flex gap-2">
          {idea && (
            <IconButton
              label={t('Delete')}
              className="size-12 bg-danger/12 text-danger"
              onClick={() => {
                actions.remove(idea.id, t('Deleted “{title}”', { title: idea.title }));
                onClose();
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          )}
          <Button variant="primary" accent={ACCENT} size="lg" className="flex-1" disabled={!title.trim()} onClick={save}>
            {idea ? t('Save') : t('Add')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t('Date idea')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Bake a cake together')} maxLength={120} />
        <div>
          <Label>{t('Kind')}</Label>
          <Chips value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c.value, label: `${c.emoji} ${t(c.label)}` }))} />
        </div>
        {idea && (
          <div>
            <Label>{t('Status')}</Label>
            <Segmented value={status} accent={ACCENT} onChange={setStatus} options={STATUS.map((s) => ({ value: s.value, label: t(s.label) }))} />
          </div>
        )}
        <div>
          <Field label={t('When')} type="date" min={status === 'done' ? undefined : today} value={planned} onChange={(e) => setPlanned(e.target.value)} />
          {planned && status !== 'done' && (
            <Button variant="secondary" block className="mt-2" disabled={busy || !title.trim()} onClick={() => void toCalendar()}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />} {t('Add to both calendars at 8 pm')}
            </Button>
          )}
        </div>
        {status === 'done' && (
          <div>
            <Label>{t('How was it?')}</Label>
            <Stars value={rating} onChange={setRating} />
          </div>
        )}
        <TextArea label={t('Note')} value={note} onChange={setNote} placeholder={t('Optional')} />
      </div>
    </Sheet>
  );
}

// ================================================================ memories

const MEMORY_TYPES: { value: MemoryType; label: string; emoji: string }[] = [
  { value: 'milestone', label: 'Milestone', emoji: '🏆' },
  { value: 'first', label: 'A first', emoji: '🌱' },
  { value: 'sweet', label: 'Sweet', emoji: '💗' },
  { value: 'funny', label: 'Funny', emoji: '😂' },
  { value: 'trip', label: 'Trip', emoji: '✈️' },
  { value: 'photo', label: 'Photo', emoji: '📸' },
];
const memEmoji = (m: MemoryType) => MEMORY_TYPES.find((x) => x.value === m)?.emoji ?? '💗';

type MemoryRow = Memory & { photos?: string[] };

function Photo({ path, className, onClick }: { path: string; className?: string; onClick?: () => void }) {
  const q = useQuery({ queryKey: ['file-url', path], queryFn: () => fileUrl(path), staleTime: 50 * 60_000, retry: 1 });
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={cn('overflow-hidden bg-white/[0.04]', className)}>
      {q.data ? <img src={q.data} alt="" className="size-full object-cover" loading="lazy" /> : <span className="grid size-full place-items-center text-ink-3"><Camera size={18} /></span>}
    </button>
  );
}

/** Memories from today's date in earlier years. */
export function onThisDay(rows: Memory[], today: string): Memory[] {
  return rows.filter((m) => m.date.slice(5) === today.slice(5) && m.date < today);
}

export function MemoriesPage() {
  const today = useToday();
  const { data: rows = [] } = useTable('memories');
  const [sheet, setSheet] = useState<{ memory: MemoryRow | null } | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [onlyFav, setOnlyFav] = useState(false);
  const list = (rows as MemoryRow[]).filter((m) => !onlyFav || m.favorite).sort((a, b) => b.date.localeCompare(a.date));
  const years = [...new Set(list.map((m) => m.date.slice(0, 4)))];
  const echoes = onThisDay(rows, today);
  return (
    <>
      <PageHeader
        title={t('Memories')}
        subtitle={t('Your story, in order')}
        right={
          <IconButton label={t('Add')} onClick={() => setSheet({ memory: null })}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/[0.035] px-3 py-2">
        <span className="text-sm text-ink-2">{t('Favourites only')}</span>
        <Toggle checked={onlyFav} onChange={setOnlyFav} label={t('Favourites only')} accent={ACCENT} />
      </div>
      <div className="space-y-3">
        {echoes.length > 0 && (
          <Card title={t('On this day')} icon={Sparkles} accent={ACCENT}>
            {echoes.map((m) => (
              <button key={m.id} type="button" onClick={() => setSheet({ memory: m as MemoryRow })} className="press block w-full text-start">
                <span className="text-[15px] font-semibold">
                  {memEmoji(m.type)} {m.title}
                </span>
                <span className="block text-xs text-ink-3">{(() => {
                    const n = Number(today.slice(0, 4)) - Number(m.date.slice(0, 4));
                    return n === 1 ? t('1 year ago') : t('{n} years ago', { n });
                  })()}</span>
              </button>
            ))}
          </Card>
        )}
        {!list.length && (
          <Card title={t('Start your timeline')} icon={Camera} accent={ACCENT}>
            <p className="text-sm text-ink-2">{t('Firsts, trips, funny moments and milestones, with photos. Add the first one.')}</p>
            <Button variant="primary" accent={ACCENT} block className="mt-3" onClick={() => setSheet({ memory: null })}>
              <Plus size={16} /> {t('Add a memory')}
            </Button>
          </Card>
        )}
        {years.map((y) => (
          <div key={y}>
            <div className="mb-2 mt-1 px-1 text-xs font-bold uppercase tracking-[0.16em] text-ink-3">{y}</div>
            <div className="space-y-3 border-s border-us/30 ps-3">
              {list
                .filter((m) => m.date.startsWith(y))
                .map((m) => (
                  <article key={m.id} className="glass relative overflow-hidden rounded-[22px]">
                    <span className="absolute -start-[19px] top-5 size-2.5 rounded-full bg-us" aria-hidden />
                    {m.photos?.[0] && <Photo path={m.photos[0]} className="block aspect-[16/10] w-full" onClick={() => setViewer(m.photos![0])} />}
                    <button type="button" onClick={() => setSheet({ memory: m })} className="press block w-full p-3.5 text-start">
                      <div className="flex items-center gap-2 text-xs text-ink-3">
                        <span>{memEmoji(m.type)}</span>
                        <span>{parseISODate(m.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</span>
                        {(m.photos?.length ?? 0) > 1 && <span>· {t('{n} photos', { n: m.photos!.length })}</span>}
                        {m.favorite && <Star size={12} className="ms-auto fill-[#ffc857] text-[#ffc857]" />}
                      </div>
                      <div className="mt-1 text-[16px] font-semibold">{m.title}</div>
                      {m.story && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{m.story}</p>}
                    </button>
                  </article>
                ))}
            </div>
          </div>
        ))}
      </div>
      <MemorySheet open={sheet !== null} memory={sheet?.memory ?? null} onClose={() => setSheet(null)} onPhoto={setViewer} />
      {viewer && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/90 p-3" onClick={() => setViewer(null)}>
          <IconButton label={t('Close')} className="absolute end-3 top-[calc(env(safe-area-inset-top)+0.75rem)] bg-white/10" onClick={() => setViewer(null)}>
            <X size={20} />
          </IconButton>
          <ViewerImage path={viewer} />
        </div>
      )}
    </>
  );
}

function ViewerImage({ path }: { path: string }) {
  const q = useQuery({ queryKey: ['file-url', path], queryFn: () => fileUrl(path), staleTime: 50 * 60_000 });
  return q.data ? <img src={q.data} alt="" className="max-h-full max-w-full rounded-2xl object-contain" /> : <Loader2 className="animate-spin text-ink-3" />;
}

function MemorySheet({ open, memory, onClose, onPhoto }: { open: boolean; memory: MemoryRow | null; onClose: () => void; onPhoto: (p: string) => void }) {
  const today = useToday();
  const me = useSession((s) => s.user);
  const actions = useTableActions('memories');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [type, setType] = useState<MemoryType>('sweet');
  const [story, setStory] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const added = useRef<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [seeded, setSeeded] = useState<string | null>(null);
  const key = open ? (memory?.id ?? 'new') : null;
  if (key !== seeded) {
    setSeeded(key);
    if (open) {
      setTitle(memory?.title ?? '');
      setDate(memory?.date ?? today);
      setType(memory?.type ?? 'sweet');
      setStory(memory?.story ?? '');
      setFavorite(memory?.favorite ?? false);
      setPhotos(memory?.photos ?? []);
      added.current = [];
    }
  }
  const upload = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      setUploading((n) => n + 1);
      try {
        const up = await uploadFile(f, f.name);
        added.current.push(up.path);
        setPhotos((p) => [...p, up.path]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('Upload failed'));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  const close = () => {
    // Photos uploaded for a memory that was never saved: tidy them away.
    for (const p of added.current) void deleteFile(p).catch(() => undefined);
    added.current = [];
    onClose();
  };
  const save = () => {
    if (!title.trim()) return;
    const row: MemoryRow = {
      id: memory?.id ?? uid(),
      title: title.trim().slice(0, 120),
      date,
      type,
      story: story.trim(),
      favorite,
      photos,
      created_by: memory?.created_by ?? me?.id ?? '',
      created_at: memory?.created_at ?? new Date().toISOString(),
    };
    actions.put(row);
    // Photos removed from a saved memory: delete the ones you uploaded.
    for (const p of memory?.photos ?? []) if (!photos.includes(p) && me && p.startsWith(`${me.id}/`)) void deleteFile(p).catch(() => undefined);
    added.current = [];
    if (!memory) sendActivity('list', { item: row.title, list: t('Memories') });
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      title={memory ? t('Memory') : t('New memory')}
      footer={
        <div className="flex gap-2">
          {memory && (
            <IconButton
              label={t('Delete')}
              className="size-12 bg-danger/12 text-danger"
              onClick={() => {
                actions.remove(memory.id, t('Deleted “{title}”', { title: memory.title }));
                onClose();
              }}
            >
              <Trash2 size={18} />
            </IconButton>
          )}
          <Button variant="primary" accent={ACCENT} size="lg" className="flex-1" disabled={!title.trim() || uploading > 0} onClick={save}>
            {uploading > 0 ? <Loader2 size={18} className="animate-spin" /> : memory ? t('Save') : t('Add memory')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t('The moment')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('e.g. Our first trip to Aqaba')} maxLength={120} />
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label={t('Date')} type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <label className="flex h-12 items-center gap-2 rounded-2xl bg-white/[0.04] px-3">
            <Star size={16} className={favorite ? 'fill-[#ffc857] text-[#ffc857]' : 'text-ink-3'} />
            <Toggle checked={favorite} onChange={setFavorite} label={t('Favourite')} accent="#ffc857" />
          </label>
        </div>
        <div>
          <Label>{t('Kind')}</Label>
          <Chips value={type} onChange={setType} options={MEMORY_TYPES.map((m) => ({ value: m.value, label: `${m.emoji} ${t(m.label)}` }))} />
        </div>
        <div>
          <Label>{t('Photos')}</Label>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p} className="relative">
                <Photo path={p} className="block aspect-square w-full rounded-xl" onClick={() => onPhoto(p)} />
                <button
                  type="button"
                  aria-label={t('Remove photo')}
                  onClick={() => setPhotos((list) => list.filter((x) => x !== p))}
                  className="press absolute end-1 top-1 grid size-6 place-items-center rounded-full bg-black/70"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="press grid aspect-square place-items-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-ink-3"
            >
              {uploading > 0 ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={22} />}
            </button>
          </div>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files).then(() => (e.target.value = ''))} />
        </div>
        <TextArea label={t('The story')} value={story} onChange={setStory} placeholder={t('What happened, how it felt…')} />
      </div>
    </Sheet>
  );
}

// ================================================================ the Us tab's entry point

export function TogetherTiles() {
  const today = useToday();
  const me = useSession((s) => s.user);
  const { data: wishes = [] } = useTable('wishes');
  const { data: dates = [] } = useTable('date_ideas');
  const { data: memories = [] } = useTable('memories');
  const echoes = onThisDay(memories, today);
  const nextDate = dates
    .filter((d) => d.status === 'planned' && d.planned && d.planned >= today)
    .sort((a, b) => a.planned!.localeCompare(b.planned!))[0];
  const tiles = [
    { to: '/us/wishlist', emoji: '🎁', title: t('Wishlist'), sub: t('{n} on the list', { n: visibleWishes(wishes, me?.id).filter((w) => w.status !== 'done').length }) },
    {
      to: '/us/dates',
      emoji: '💕',
      title: t('Date ideas'),
      sub: nextDate ? t('Next: {date}', { date: shortDate(nextDate.planned!) }) : t('{n} ideas', { n: dates.filter((d) => d.status === 'idea').length }),
    },
    { to: '/us/memories', emoji: '📸', title: t('Memories'), sub: echoes.length ? t('On this day ✨') : t('{n} moments', { n: memories.length }) },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((x) => (
        <Link key={x.to} to={x.to} className="glass press flex flex-col gap-1 rounded-[22px] p-3">
          <span className="text-2xl">{x.emoji}</span>
          <span className="text-sm font-semibold">{x.title}</span>
          <span className="truncate text-[11px] text-ink-3">{x.sub}</span>
        </Link>
      ))}
    </div>
  );
}
