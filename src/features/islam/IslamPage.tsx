/** Islam tracking for both of you: prayers, azkar done, Quran memorization and pages read, tasbih. */
import { BookOpen, Check, ChevronRight, Minus, Plus, RotateCcw, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { useSession } from '@/features/auth/session';
import { useTableActions, useTableEveryone } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { tick } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { addDays } from '@/lib/date';
import { t } from '@/lib/i18n';
import { AZKAR, AZKAR_SETS, JUZ_AMMA_FROM, PRAYERS, SURAHS, TOTAL_AYAHS, hijri } from '@/lib/islam';
import { usePartnerStore } from '@/lib/partner';
import { toast } from '@/stores/toastStore';
import type { IslamDay, QuranProgress, QuranStatus } from '@/types/db';

const ACCENT = 'var(--color-islam)';

/** You and your partner, in screen order (your partner first while you're viewing their side). */
function usePeople() {
  const me = useSession((s) => s.user);
  const { partner, viewing, self } = usePartnerStore();
  const meP = me ? { id: me.id, name: viewing ? (self?.name ?? t('You')) : t('You') } : null;
  const left = viewing ? partner : meP;
  const right = viewing ? meP : partner;
  return { left, right, canWrite: !viewing };
}

const blank = (date: string): Omit<IslamDay, 'by'> => ({ date, prayers: {}, azkar: {}, counts: {}, pages: 0, tasbih: 0, updated_at: '' });

/** A day's worship for both of you, and a way to update yours. */
function useIslamDay(date: string) {
  const { left, right, canWrite } = usePeople();
  const { data: rows = [] } = useTableEveryone('islam_days');
  const actions = useTableActions('islam_days');
  const mine = rows.find((r) => r.date === date && r.by === left?.id);
  const theirs = rows.find((r) => r.date === date && r.by === right?.id);
  const update = (patch: Partial<Omit<IslamDay, 'by' | 'date'>>) => {
    if (!canWrite) return;
    const { by: _by, ...base } = mine ?? { ...blank(date), by: '' };
    void _by;
    actions.put({ ...base, ...patch, date, updated_at: new Date().toISOString() });
  };
  return { mine, theirs, update, rows, left, right, canWrite };
}

function Dots({ n, of, accent = ACCENT }: { n: number; of: number; accent?: string }) {
  return (
    <span className="flex gap-1">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className="size-2 rounded-full" style={{ background: i < n ? accent : 'rgba(255,255,255,0.12)' }} />
      ))}
    </span>
  );
}

// ================================================================ the tab

export function IslamPage() {
  const today = useToday();
  const { mine, theirs, update, rows, left, right, canWrite } = useIslamDay(today);
  const prayed = (d?: IslamDay) => PRAYERS.filter((p) => d?.prayers[p.key]).length;
  // Pages read in the last 7 days, each.
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const weekPages = (id?: string) => rows.filter((r) => r.by === id && week.includes(r.date)).reduce((a, r) => a + (r.pages || 0), 0);
  return (
    <>
      <PageHeader title={t('Islam')} subtitle={hijri()} />
      <div className="space-y-3">
        {/* prayers */}
        <Card title={t('Prayers today')} icon={Sparkles} accent={ACCENT} action={<span className="tabular text-xs font-semibold text-ink-3">{prayed(mine)}/5</span>}>
          <div className="grid grid-cols-5 gap-1.5">
            {PRAYERS.map((p) => {
              const on = Boolean(mine?.prayers[p.key]);
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={!canWrite}
                  aria-pressed={on}
                  onClick={() => {
                    tick();
                    update({ prayers: { ...(mine?.prayers ?? {}), [p.key]: !on } });
                  }}
                  className={cn('press flex flex-col items-center gap-1 rounded-2xl py-2.5', on ? 'bg-islam/20 text-ink ring-1 ring-islam/60' : 'bg-white/[0.04] text-ink-2')}
                >
                  <span className={cn('grid size-7 place-items-center rounded-full', on ? 'bg-islam text-bg' : 'border border-white/20')}>{on && <Check size={15} strokeWidth={3} />}</span>
                  <span className="text-[11.5px] font-semibold">{t(p.label)}</span>
                  <span className="text-[10px] text-ink-3" lang="ar">
                    {p.ar}
                  </span>
                </button>
              );
            })}
          </div>
          {/* sunnah with each prayer */}
          <div className="mt-1.5 grid grid-cols-5 gap-1.5">
            {PRAYERS.map((p) => {
              const on = Boolean(mine?.sunnah?.[p.key]);
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={!canWrite}
                  aria-pressed={on}
                  aria-label={t('{prayer} sunnah', { prayer: t(p.label) })}
                  onClick={() => {
                    tick();
                    update({ sunnah: { ...(mine?.sunnah ?? {}), [p.key]: !on } });
                  }}
                  className={cn('press flex flex-col items-center gap-0.5 rounded-xl py-1.5', on ? 'bg-islam/12 text-ink ring-1 ring-islam/40' : 'bg-white/[0.03] text-ink-3')}
                >
                  <span className="flex items-center gap-1 text-[10.5px] font-semibold">
                    <span className={cn('grid size-3.5 place-items-center rounded-full', on ? 'bg-islam text-bg' : 'border border-white/25')}>{on && <Check size={9} strokeWidth={3.5} />}</span>
                    {t('Sunnah')}
                  </span>
                  <span className="text-[9.5px] text-ink-3">{t(p.sunnah)}</span>
                </button>
              );
            })}
          </div>
          {/* night prayer */}
          <button
            type="button"
            disabled={!canWrite}
            aria-pressed={Boolean(mine?.qiyam)}
            onClick={() => {
              tick();
              update({ qiyam: !mine?.qiyam });
            }}
            className={cn('press mt-2 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-start', mine?.qiyam ? 'bg-islam/15 ring-1 ring-islam/60' : 'bg-white/[0.04]')}
          >
            <span className="text-xl">🌌</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t('Qiyam al-Layl')}</span>
              <span className="block text-xs text-ink-3" lang="ar">
                قيام الليل
              </span>
            </span>
            <span className={cn('grid size-6 place-items-center rounded-full', mine?.qiyam ? 'bg-islam text-bg' : 'border border-white/20')}>{mine?.qiyam && <Check size={14} strokeWidth={3} />}</span>
          </button>
          {right && (
            <div className="mt-3 space-y-1 rounded-2xl bg-white/[0.035] px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-2">{right.name}</span>
                <span className="flex items-center gap-2">
                  <Dots n={prayed(theirs)} of={5} accent="var(--color-us)" />
                  <span className="tabular text-xs text-ink-3">{prayed(theirs)}/5</span>
                </span>
              </div>
              <div className="tabular text-xs text-ink-3">
                {t('Sunnah {n}/5', { n: PRAYERS.filter((p) => theirs?.sunnah?.[p.key]).length })} · {t('Qiyam')} {theirs?.qiyam ? <span className="text-us">✓</span> : '—'}
              </div>
            </div>
          )}
        </Card>

        {/* azkar */}
        <Card title={t('Azkar')} icon={Sparkles} accent={ACCENT}>
          <div className="grid grid-cols-2 gap-2">
            {AZKAR_SETS.map((s) => {
              const a = AZKAR[s];
              const on = Boolean(mine?.azkar[s]);
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!canWrite}
                  aria-pressed={on}
                  onClick={() => {
                    tick();
                    update({ azkar: { ...(mine?.azkar ?? {}), [s]: !on } });
                  }}
                  className={cn('press rounded-2xl p-3 text-start', on ? 'bg-islam/15 ring-1 ring-islam/60' : 'bg-white/[0.04]')}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-2xl">{a.emoji}</span>
                    <span className={cn('grid size-6 place-items-center rounded-full', on ? 'bg-islam text-bg' : 'border border-white/20')}>{on && <Check size={14} strokeWidth={3} />}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold">{t(a.title)}</div>
                  <div className="text-xs text-ink-3" lang="ar">
                    {a.ar}
                  </div>
                  {right && (
                    <div className={cn('mt-1.5 text-[11px]', theirs?.azkar[s] ? 'text-us' : 'text-ink-3')}>
                      {right.name} {theirs?.azkar[s] ? '✓' : '…'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <QuranCard />

        {/* reading */}
        <Card title={t('Quran reading')} icon={BookOpen} accent={ACCENT}>
          <div className="flex items-center gap-3">
            <IconButton label={t('One page less')} className="size-11 bg-white/[0.05]" disabled={!canWrite || !(mine?.pages ?? 0)} onClick={() => update({ pages: Math.max(0, (mine?.pages ?? 0) - 1) })}>
              <Minus size={18} />
            </IconButton>
            <div className="flex-1 text-center">
              <div className="tabular text-3xl font-bold">{mine?.pages ?? 0}</div>
              <div className="text-xs text-ink-3">{t('pages today')}</div>
            </div>
            <IconButton
              label={t('One page more')}
              className="size-11 bg-islam/20 text-islam"
              disabled={!canWrite}
              onClick={() => {
                tick();
                update({ pages: (mine?.pages ?? 0) + 1 });
              }}
            >
              <Plus size={18} />
            </IconButton>
          </div>
          <div className="mt-3 flex gap-2">
            {[5, 10, 20].map((n) => (
              <button key={n} type="button" disabled={!canWrite} onClick={() => update({ pages: (mine?.pages ?? 0) + n })} className="press h-9 flex-1 rounded-xl bg-white/[0.05] text-sm font-semibold text-ink-2">
                +{n}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs text-ink-3">
            <div className="rounded-2xl bg-white/[0.035] py-2">
              <div className="tabular text-base font-bold text-ink">{weekPages(left?.id)}</div>
              {left?.name} · {t('this week')}
            </div>
            {right && (
              <div className="rounded-2xl bg-white/[0.035] py-2">
                <div className="tabular text-base font-bold text-us">{weekPages(right.id)}</div>
                {right.name} · {t('this week')}
              </div>
            )}
          </div>
        </Card>

        <Tasbih />
      </div>
    </>
  );
}

function Tasbih() {
  const today = useToday();
  const { mine, theirs, update, right, canWrite } = useIslamDay(today);
  const n = mine?.tasbih ?? 0;
  return (
    <Card title={t('Tasbih')} icon={Sparkles} accent={ACCENT} action={
      <IconButton label={t('Reset')} disabled={!canWrite || !n} onClick={() => update({ tasbih: 0 })}>
        <RotateCcw size={16} />
      </IconButton>
    }>
      <div className="flex flex-col items-center">
        <button
          type="button"
          disabled={!canWrite}
          onClick={() => {
            tick();
            update({ tasbih: n + 1 });
          }}
          className="press grid size-40 place-items-center rounded-full border border-islam/40 bg-islam/10 shadow-[0_0_40px_-12px_var(--color-islam)] active:scale-95"
          aria-label={t('Count')}
        >
          <span>
            <span className="tabular block text-5xl font-bold">{n}</span>
            <span className="block text-xs text-ink-3">{n % 33 === 0 && n ? t('{n} × 33', { n: n / 33 }) : t('Tap to count')}</span>
          </span>
        </button>
        {right && <p className="mt-3 text-xs text-ink-3">{t('{name} today: {n}', { name: right.name, n: theirs?.tasbih ?? 0 })}</p>}
      </div>
    </Card>
  );
}

// ================================================================ Quran memorization

function memorizedAyahs(rows: QuranProgress[], id?: string) {
  return rows
    .filter((r) => r.by === id)
    .reduce((a, r) => a + (r.status === 'memorized' ? SURAHS[r.surah - 1][2] : Math.min(r.ayahs, SURAHS[r.surah - 1][2])), 0);
}

function QuranCard() {
  const { left, right } = usePeople();
  const { data: rows = [] } = useTableEveryone('quran');
  const person = (p: { id: string; name: string } | null, color: string) => {
    if (!p) return null;
    const ay = memorizedAyahs(rows, p.id);
    const surahs = rows.filter((r) => r.by === p.id && r.status === 'memorized').length;
    return (
      <div key={p.id}>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium">{p.name}</span>
          <span className="tabular text-xs text-ink-3">{t('{s} surahs · {a} ayahs', { s: surahs, a: ay.toLocaleString() })}</span>
        </div>
        <ProgressBar value={ay} max={TOTAL_AYAHS} accent={color} className="h-2" />
      </div>
    );
  };
  return (
    <Card
      title={t('Quran memorization')}
      icon={BookOpen}
      accent={ACCENT}
      action={
        <Link to="/islam/quran" className="text-xs font-semibold text-islam">
          {t('Open')}
        </Link>
      }
    >
      <div className="space-y-3">
        {person(left, ACCENT)}
        {person(right, 'var(--color-us)')}
      </div>
      <Link to="/islam/quran" className="press mt-3 flex h-11 items-center justify-center gap-1 rounded-2xl bg-islam/15 text-sm font-semibold text-islam">
        {t('Track a surah')} <ChevronRight size={16} className="rtl:-scale-x-100" />
      </Link>
    </Card>
  );
}

type Filter = 'amma' | 'all' | 'learning' | 'memorized';

export function QuranPage() {
  const { left, right } = usePeople();
  const { data: rows = [] } = useTableEveryone('quran');
  const [filter, setFilter] = useState<Filter>('amma');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const of = (surah: number, id?: string) => rows.find((r) => r.surah === surah && r.by === id);
  const list = useMemo(() => {
    const all = SURAHS.map((s, i) => ({ n: i + 1, ar: s[0], en: s[1], ayahs: s[2] }));
    const term = q.trim().toLowerCase();
    return all.filter((s) => {
      if (term) return s.en.toLowerCase().includes(term) || s.ar.includes(term) || String(s.n) === term;
      const mine = of(s.n, left?.id);
      if (filter === 'amma') return s.n >= JUZ_AMMA_FROM;
      if (filter === 'learning') return mine?.status === 'learning';
      if (filter === 'memorized') return mine?.status === 'memorized';
      return true;
    });
  }, [rows, filter, q, left?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const badge = (p?: QuranProgress, ayahs = 0, color = ACCENT) =>
    !p ? (
      <span className="text-[11px] text-ink-3">—</span>
    ) : p.status === 'memorized' ? (
      <span className="grid size-6 place-items-center rounded-full text-bg" style={{ background: color }}>
        <Check size={13} strokeWidth={3} />
      </span>
    ) : (
      <span className="tabular text-[11px] font-semibold" style={{ color }}>
        {Math.min(p.ayahs, ayahs)}/{ayahs}
      </span>
    );
  return (
    <>
      <PageHeader title={t('Quran memorization')} subtitle={t('{a} of {b} ayahs memorized', { a: memorizedAyahs(rows, left?.id).toLocaleString(), b: TOTAL_AYAHS.toLocaleString() })} />
      <div className="mb-2 flex h-11 items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-3">
        <Search size={16} className="text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search a surah')} className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3" />
      </div>
      {!q && (
        <Segmented
          size="sm"
          className="mb-3"
          value={filter}
          accent={ACCENT}
          onChange={setFilter}
          options={[
            { value: 'amma', label: t('Juz’ Amma') },
            { value: 'all', label: t('All') },
            { value: 'learning', label: t('Learning') },
            { value: 'memorized', label: t('Memorized') },
          ]}
        />
      )}
      <div className="glass overflow-hidden rounded-[24px]">
        <div className="grid grid-cols-[1fr_3.2rem_3.2rem] items-center gap-2 border-b border-white/[0.06] px-3 py-2 text-[11px] font-semibold text-ink-3">
          <span>{t('Surah')}</span>
          <span className="truncate text-center text-islam">{left?.name}</span>
          <span className="truncate text-center text-us">{right?.name ?? ''}</span>
        </div>
        {list.length === 0 && <p className="p-4 text-sm text-ink-3">{filter === 'learning' ? t('Nothing in progress yet.') : t('Nothing here yet.')}</p>}
        <ul className="divide-y divide-white/[0.05]">
          {list.map((s) => (
            <li key={s.n}>
              <button type="button" onClick={() => setOpen(s.n)} className="press grid w-full grid-cols-[1fr_3.2rem_3.2rem] items-center gap-2 px-3 py-2.5 text-start">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="tabular grid size-7 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-[11px] font-semibold text-ink-3">{s.n}</span>
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[15px] font-medium">{s.en}</span>
                      <span className="text-sm text-ink-2" lang="ar">
                        {s.ar}
                      </span>
                    </span>
                    <span className="block text-[11px] text-ink-3">{t('{n} ayahs', { n: s.ayahs })}</span>
                  </span>
                </span>
                <span className="grid place-items-center">{badge(of(s.n, left?.id), s.ayahs)}</span>
                <span className="grid place-items-center">{right ? badge(of(s.n, right.id), s.ayahs, 'var(--color-us)') : null}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <SurahSheet surah={open} onClose={() => setOpen(null)} />
    </>
  );
}

function SurahSheet({ surah, onClose }: { surah: number | null; onClose: () => void }) {
  const today = useToday();
  const { left, right, canWrite } = usePeople();
  const { data: rows = [] } = useTableEveryone('quran');
  const actions = useTableActions('quran');
  const s = surah ? SURAHS[surah - 1] : null;
  const mine = rows.find((r) => r.surah === surah && r.by === left?.id);
  const theirs = rows.find((r) => r.surah === surah && r.by === right?.id);
  const [status, setStatus] = useState<QuranStatus | 'none'>('none');
  const [ayahs, setAyahs] = useState(0);
  const [seeded, setSeeded] = useState<number | null>(null);
  if (surah !== seeded) {
    setSeeded(surah);
    setStatus(mine?.status ?? 'none');
    setAyahs(mine?.ayahs ?? 0);
  }
  if (!s || !surah) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const total = s[2];
  const save = (reviewed = false) => {
    if (status === 'none') {
      if (mine) actions.remove(String(surah));
    } else {
      actions.put({
        surah,
        status,
        ayahs: status === 'memorized' ? total : Math.min(ayahs, total),
        reviewed: reviewed ? today : (mine?.reviewed ?? null),
        updated_at: new Date().toISOString(),
      });
      if (status === 'memorized' && mine?.status !== 'memorized') toast.success(t('{name} memorized. ما شاء الله 🤍', { name: s[1] }));
      else if (reviewed) toast.success(t('Revised today'));
    }
    onClose();
  };
  return (
    <Sheet
      open={surah !== null}
      onClose={onClose}
      title={`${surah}. ${s[1]} · ${s[0]}`}
      footer={
        canWrite ? (
          <div className="flex gap-2">
            {status !== 'none' && (
              <Button variant="secondary" size="lg" onClick={() => save(true)}>
                <RotateCcw size={16} /> {t('Revised today')}
              </Button>
            )}
            <Button variant="primary" accent={ACCENT} size="lg" className="flex-1" onClick={() => save()}>
              {t('Save')}
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-2">{t('{n} ayahs', { n: total })}</p>
        <Segmented
          value={status}
          accent={ACCENT}
          onChange={(v) => {
            setStatus(v);
            if (v === 'learning' && !ayahs) setAyahs(1);
          }}
          options={[
            { value: 'none', label: t('Not started') },
            { value: 'learning', label: t('Learning') },
            { value: 'memorized', label: t('Memorized') },
          ]}
        />
        {status === 'learning' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-ink-2">{t('Ayahs memorized')}</span>
              <span className="tabular font-semibold">
                {ayahs}/{total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <IconButton label={t('One less')} className="size-10 bg-white/[0.05]" onClick={() => setAyahs((a) => Math.max(0, a - 1))}>
                <Minus size={16} />
              </IconButton>
              <input
                type="range"
                min={0}
                max={total}
                value={ayahs}
                onChange={(e) => setAyahs(Number(e.target.value))}
                className="h-2 flex-1 accent-[var(--color-islam)]"
                aria-label={t('Ayahs memorized')}
              />
              <IconButton label={t('One more')} className="size-10 bg-islam/20 text-islam" onClick={() => setAyahs((a) => Math.min(total, a + 1))}>
                <Plus size={16} />
              </IconButton>
            </div>
          </div>
        )}
        {mine?.reviewed && <p className="text-xs text-ink-3">{t('Last revised {date}', { date: mine.reviewed })}</p>}
        {right && (
          <div className="rounded-2xl bg-white/[0.035] px-3 py-2.5 text-sm">
            <span className="text-ink-2">{right.name}: </span>
            <span className="font-medium text-us">
              {!theirs ? t('Not started') : theirs.status === 'memorized' ? t('Memorized') : t('Learning · {a}/{b}', { a: Math.min(theirs.ayahs, total), b: total })}
            </span>
          </div>
        )}
      </div>
    </Sheet>
  );
}
