/** Things you two want: a wishlist & bucket list (to get, to do, places to go). */
import { EyeOff, Gift, Link2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { useSession } from '@/features/auth/session';
import { useTable, useTableActions } from '@/hooks/useTable';
import { sendActivity } from '@/lib/activity';
import { cn } from '@/lib/cn';
import { t } from '@/lib/i18n';
import { uid } from '@/lib/localDb';
import { usePartnerStore } from '@/lib/partner';
import type { IdeaStatus, Wish, WishType } from '@/types/db';

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

// ================================================================ the Us tab's entry point

export function TogetherTiles() {
  const me = useSession((s) => s.user);
  const { data: wishes = [] } = useTable('wishes');
  const open = visibleWishes(wishes, me?.id).filter((w) => w.status !== 'done');
  const by = (k: WishType) => open.filter((w) => w.type === k).length;
  return (
    <Link to="/us/wishlist" className="glass press flex items-center gap-3 rounded-[22px] p-3.5">
      <span className="text-2xl">🎁</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{t('Wishlist')}</span>
        <span className="block truncate text-xs text-ink-3">
          {t('{a} to get · {b} to do · {c} places', { a: by('get'), b: by('do'), c: by('place') })}
        </span>
      </span>
      <span className="text-xs font-semibold text-us">{t('Open')}</span>
    </Link>
  );
}
