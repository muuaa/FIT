/** Google Calendar–style views for Plan: an hour grid (day, 3 days, week) and a month grid. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/lib/cn';
import { addDays, parseISODate, weekdayShort } from '@/lib/date';
import { t } from '@/lib/i18n';

/** One thing on the calendar, from Google or from the app. */
export interface CalItem {
  key: string;
  title: string;
  emoji: string;
  date: string;
  time: string | null; // null = all day
  endDate: string;
  endTime: string | null;
  color: string;
  /** Someone else's (shown a little lighter). */
  theirs: boolean;
  open: () => void;
}

export type CalView = 'day' | '3day' | 'week' | 'month' | 'list';

const HOUR = 52; // px per hour
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, '0');
const hm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Hex colour with transparency (Google colours are #rrggbb). */
function tint(color: string, alpha: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}

function hourLabel(h: number): string {
  const d = new Date(2000, 0, 1, h);
  return d.toLocaleTimeString(undefined, { hour: 'numeric' }).replace(':00', '');
}

function useNow(): number {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now.getHours() * 60 + now.getMinutes();
}

/** Horizontal swipe to move to the previous / next period. */
function useSwipe(onPrev: () => void, onNext: () => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const p = e.touches[0];
      start.current = { x: p.clientX, y: p.clientY, t: Date.now() };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - s.x;
      const dy = p.clientY - s.y;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - s.t > 700) return;
      const rtl = document.documentElement.dir === 'rtl';
      if ((dx > 0) !== rtl) onPrev();
      else onNext();
    },
  };
}

/** Where a timed item sits on a given day (minutes from midnight), or null if it doesn't. */
function span(it: CalItem, day: string): { a: number; b: number } | null {
  if (it.time === null) return null;
  if (day < it.date || day > it.endDate) return null;
  const a = day === it.date ? mins(it.time) : 0;
  let b = day === it.endDate && it.endTime ? mins(it.endTime) : 1440;
  if (day === it.date && it.date === it.endDate && !it.endTime) b = a + 60;
  if (b <= a) {
    if (day === it.endDate && day !== it.date) return null; // ends at midnight
    b = Math.min(1440, a + 30);
  }
  return { a, b };
}

const isAllDayOn = (it: CalItem, day: string) => it.time === null && it.date <= day && day < (it.endDate > it.date ? it.endDate : addDays(it.date, 1));

/** Side-by-side columns for overlapping items, like Google. */
function layout(list: { it: CalItem; a: number; b: number }[]) {
  const sorted = [...list].sort((x, y) => x.a - y.a || y.b - x.b);
  const out: { it: CalItem; a: number; b: number; col: number; cols: number }[] = [];
  let cluster: typeof out = [];
  let clusterEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) c.cols = n;
    out.push(...cluster);
    cluster = [];
  };
  for (const e of sorted) {
    if (e.a >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.b > e.a).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...e, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, e.b);
  }
  if (cluster.length) flush();
  return out;
}

function DayHead({ day, onPick }: { day: string; onPick: (d: string) => void }) {
  const today = useToday();
  const d = parseISODate(day);
  const isToday = day === today;
  return (
    <button type="button" onClick={() => onPick(day)} className="press flex min-w-0 flex-col items-center gap-0.5 py-1.5">
      <span className={cn('text-[10px] font-semibold uppercase tracking-wide', isToday ? 'text-accent' : 'text-ink-3')}>{weekdayShort(d.getDay())}</span>
      <span className={cn('tabular grid size-8 place-items-center rounded-full text-[15px] font-bold', isToday ? 'bg-accent text-bg' : 'text-ink')}>{d.getDate()}</span>
    </button>
  );
}

/** Day, 3-day and week views: an hour grid with events as blocks. */
export function TimeGrid({
  days,
  items,
  onSlot,
  onPickDay,
  onPrev,
  onNext,
}: {
  days: string[];
  items: CalItem[];
  onSlot: (date: string, time: string) => void;
  onPickDay: (date: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const today = useToday();
  const now = useNow();
  const scroller = useRef<HTMLDivElement>(null);
  const swipe = useSwipe(onPrev, onNext);
  const compact = days.length > 3;

  // Open at the current time (or the morning), the way Google does.
  const showsToday = days.includes(today);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = showsToday ? Math.max(0, now - 90) : 7 * 60;
    el.scrollTop = (target / 60) * HOUR;
  }, [days[0], days.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const allDay = days.map((d) => items.filter((it) => isAllDayOn(it, d)));
  const hasAllDay = allDay.some((l) => l.length);
  const timed = days.map((d) =>
    layout(
      items
        .map((it) => ({ it, s: span(it, d) }))
        .filter((x): x is { it: CalItem; s: { a: number; b: number } } => x.s !== null)
        .map((x) => ({ it: x.it, a: x.s.a, b: x.s.b })),
    ),
  );
  const cols = { gridTemplateColumns: `2.6rem repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div className="glass animate-page overflow-hidden rounded-[26px]" {...swipe}>
      <div className="grid border-b border-white/[0.06]" style={cols}>
        <div />
        {days.map((d) => (
          <DayHead key={d} day={d} onPick={onPickDay} />
        ))}
      </div>
      {hasAllDay && (
        <div className="grid border-b border-white/[0.06] py-1" style={cols}>
          <div className="pe-1 pt-1 text-end text-[9px] font-medium uppercase leading-tight text-ink-3">{t('All day')}</div>
          {allDay.map((list, i) => (
            <div key={days[i]} className="min-w-0 space-y-0.5 px-0.5">
              {list.slice(0, 3).map((it) => (
                <Chip key={it.key} it={it} compact={compact} />
              ))}
              {list.length > 3 && <div className="px-1 text-[10px] text-ink-3">+{list.length - 3}</div>}
            </div>
          ))}
        </div>
      )}
      <div ref={scroller} className="relative overflow-y-auto overscroll-contain" style={{ height: 'max(26rem, calc(100dvh - 23.5rem))' }}>
        <div className="relative grid" style={{ ...cols, height: 24 * HOUR }}>
          <div className="relative">
            {Array.from({ length: 23 }, (_, i) => (
              <span key={i} className="tabular absolute end-1.5 -translate-y-1/2 text-[10px] text-ink-3" style={{ top: (i + 1) * HOUR }}>
                {hourLabel(i + 1)}
              </span>
            ))}
          </div>
          {days.map((d, di) => (
            <div
              key={d}
              className={cn('relative border-s border-white/[0.06]', d === today && 'bg-accent/[0.03]')}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const y = e.nativeEvent.offsetY;
                const m = Math.min(23 * 60 + 30, Math.max(0, Math.floor((y / HOUR) * 2) * 30));
                onSlot(d, hm(m));
              }}
            >
              {Array.from({ length: 23 }, (_, i) => (
                <div key={i} className="pointer-events-none absolute inset-x-0 border-t border-white/[0.05]" style={{ top: (i + 1) * HOUR }} />
              ))}
              {timed[di].map(({ it, a, b, col, cols: n }) => {
                const h = Math.max(20, ((b - a) / 60) * HOUR - 2);
                const short = h < 38;
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={it.open}
                    className="press absolute overflow-hidden rounded-lg px-1.5 py-0.5 text-start"
                    style={{
                      top: (a / 60) * HOUR + 1,
                      height: h,
                      insetInlineStart: `calc(${(col / n) * 100}% + 1px)`,
                      width: `calc(${100 / n}% - 2px)`,
                      background: tint(it.color, it.theirs ? 0.22 : 0.42),
                      borderInlineStart: `3px solid ${it.color}`,
                    }}
                  >
                    <span className={cn('block font-semibold leading-tight text-ink', compact ? 'text-[10px]' : 'text-xs', short ? 'truncate' : 'line-clamp-3')}>
                      {it.emoji && !compact ? `${it.emoji} ` : ''}
                      {it.title}
                    </span>
                    {!short && !compact && (
                      <span className="tabular block text-[10px] text-ink-2">
                        {hm(a)}–{hm(b === 1440 ? 0 : b)}
                      </span>
                    )}
                  </button>
                );
              })}
              {d === today && (
                <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (now / 60) * HOUR }}>
                  <div className="absolute -start-1 -top-[5px] size-2.5 rounded-full bg-[#ff5b6e]" />
                  <div className="h-[2px] bg-[#ff5b6e]" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ it, compact }: { it: CalItem; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        it.open();
      }}
      className={cn('press block w-full truncate rounded-md px-1 text-start font-semibold leading-[1.45] text-ink', compact ? 'text-[9.5px]' : 'text-[11px]')}
      style={{ background: tint(it.color, it.theirs ? 0.24 : 0.5) }}
    >
      {it.title}
    </button>
  );
}

/** The 6-week grid shown for a month (weeks start on Saturday, like the rest of Plan). */
export function monthDays(date: string, weekStart: (d: string) => string): string[] {
  const first = `${date.slice(0, 7)}-01`;
  const start = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function MonthGrid({
  date,
  days,
  items,
  onPickDay,
  onPrev,
  onNext,
}: {
  date: string;
  days: string[];
  items: CalItem[];
  onPickDay: (d: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const today = useToday();
  const swipe = useSwipe(onPrev, onNext);
  const month = date.slice(0, 7);
  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const d of days) {
      const list = items
        .filter((it) => isAllDayOn(it, d) || span(it, d) !== null)
        .sort((x, y) => (x.time === null ? -1 : y.time === null ? 1 : x.time.localeCompare(y.time)));
      m.set(d, list);
    }
    return m;
  }, [days, items]);
  return (
    <div className="glass animate-page overflow-hidden rounded-[26px]" {...swipe}>
      <div className="grid grid-cols-7 border-b border-white/[0.06] py-1.5">
        {days.slice(0, 7).map((d) => (
          <span key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-ink-3">
            {weekdayShort(parseISODate(d).getDay())}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const out = d.slice(0, 7) !== month;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPickDay(d)}
              className={cn('press flex min-h-[5.6rem] min-w-0 flex-col gap-0.5 border-b border-s border-white/[0.05] p-0.5 text-start', out && 'opacity-40')}
            >
              <span
                className={cn(
                  'tabular mx-auto grid size-6 place-items-center rounded-full text-[12px] font-semibold',
                  d === today ? 'bg-accent text-bg' : 'text-ink-2',
                )}
              >
                {parseISODate(d).getDate()}
              </span>
              {list.slice(0, 3).map((it) => (
                <span
                  key={it.key}
                  className="block w-full truncate rounded px-0.5 text-[9.5px] font-medium leading-[1.4] text-ink"
                  style={{ background: tint(it.color, it.theirs ? 0.24 : 0.5) }}
                >
                  {it.title}
                </span>
              ))}
              {list.length > 3 && <span className="px-0.5 text-[9.5px] text-ink-3">+{list.length - 3}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "Nov 22 – 28, 2026" style title for the period on screen. */
export function periodTitle(view: CalView, days: string[], date: string): string {
  const loc = undefined;
  if (view === 'month') return parseISODate(date).toLocaleDateString(loc, { month: 'long', year: 'numeric' });
  const a = parseISODate(days[0]);
  const b = parseISODate(days[days.length - 1]);
  if (days.length === 1) return a.toLocaleDateString(loc, { weekday: 'long', month: 'long', day: 'numeric' });
  const sameMonth = a.getMonth() === b.getMonth();
  const left = a.toLocaleDateString(loc, { month: 'short', day: 'numeric' });
  const right = b.toLocaleDateString(loc, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' });
  return `${left} – ${right}`;
}
