import { CalendarDays, ChevronLeft, ChevronRight, ListTodo, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/features/auth/session';
import { TodosForDay } from '@/features/life/todos';
import { useTable } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/lib/cn';
import { addDays, addMonths, monthLabel, parseISODate, relativeDay, weekdayNarrow } from '@/lib/date';
import { Segmented } from '@/components/ui/Segmented';
import { MonthGrid, TimeGrid, monthDays, periodTitle, type CalItem, type CalView } from './CalendarViews';
import { gOn, prefetchGoogleWeek, useGoogleEvents, useGoogleReturn, useGoogleStatus, type GEvent } from '@/lib/google';
import { useQueryClient } from '@tanstack/react-query';
import { GEventRow, GEventSheet, GoogleConnectCard } from './GoogleCalendar';
import { t } from '@/lib/i18n';
import { todosFor } from '@/lib/life';
import { usePartnerStore } from '@/lib/partner';
import { eventsOn, weekOf } from '@/lib/plan';
import type { CalEvent } from '@/types/db';
import { EventSheet } from './EventSheet';
import { RoutinesCard } from './Routines';
import { OtherPlan } from '@/features/us/OtherPerson';

function WeekStrip({ date, onPick, marks }: { date: string; onPick: (d: string) => void; marks: (d: string) => number }) {
  const today = useToday();
  const week = weekOf(date);
  return (
    <div className="glass animate-page mb-3 rounded-[26px] p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <IconButton label={t('Previous week')} onClick={() => onPick(addDays(date, -7))}>
          <ChevronLeft size={20} className="rtl:-scale-x-100" />
        </IconButton>
        <button type="button" onClick={() => onPick(today)} className="text-sm font-semibold">
          {monthLabel(date.slice(0, 7))}
          {date !== today && <span className="ms-2 text-xs font-medium text-accent">{t('Today')}</span>}
        </button>
        <IconButton label={t('Next week')} onClick={() => onPick(addDays(date, 7))}>
          <ChevronRight size={20} className="rtl:-scale-x-100" />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {week.map((d) => {
          const sel = d === date;
          const n = marks(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              aria-pressed={sel}
              aria-label={relativeDay(d)}
              className={cn('press flex flex-col items-center gap-1 rounded-2xl py-2 transition-colors', sel ? 'bg-accent text-bg' : d === today ? 'bg-white/[0.06]' : '')}
            >
              <span className={cn('text-[10px] font-semibold uppercase', sel ? 'text-bg/70' : 'text-ink-3')}>{weekdayNarrow(parseISODate(d).getDay())}</span>
              <span className="tabular text-[17px] font-bold leading-none">{Number(d.slice(8))}</span>
              <span className="flex h-1.5 gap-0.5">
                {Array.from({ length: Math.min(3, n) }, (_, i) => (
                  <span key={i} className={cn('size-1.5 rounded-full', sel ? 'bg-bg/70' : 'bg-accent')} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventRow({ e, onOpen }: { e: CalEvent; onOpen: () => void }) {
  const me = useSession((s) => s.user);
  const { partner, viewing, self } = usePartnerStore();
  const meLabel = viewing ? (self?.name ?? t('Me')) : t('Me');
  const who = e.who === 'both' ? null : e.who === me?.id ? meLabel : e.who === partner?.id ? partner.name : null;
  return (
    <li>
      <button type="button" onClick={onOpen} className="press flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] py-2.5 ps-3 pe-3 text-start">
        <span className="tabular w-12 shrink-0 text-sm font-semibold text-todo">{e.time ?? t('All day')}</span>
        <span className="text-xl">{e.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{e.title}</span>
          {(who || e.note) && <span className="block truncate text-xs text-ink-3">{[who, e.note].filter(Boolean).join(' · ')}</span>}
        </span>
      </button>
    </li>
  );
}

const VIEW_KEY = 'fit.plan.view';
const VIEWS: CalView[] = ['day', '3day', 'week', 'month', 'list'];
function savedView(): CalView {
  try {
    const v = localStorage.getItem(VIEW_KEY) as CalView | null;
    return v && VIEWS.includes(v) ? v : 'week';
  } catch {
    return 'week';
  }
}

/** The dates on screen for a view. */
function daysFor(view: CalView, date: string): string[] {
  if (view === 'day') return [date];
  if (view === '3day') return [date, addDays(date, 1), addDays(date, 2)];
  if (view === 'month') return monthDays(date, (d) => weekOf(d)[0]);
  return weekOf(date);
}

function step(view: CalView, date: string, dir: 1 | -1): string {
  if (view === 'day') return addDays(date, dir);
  if (view === '3day') return addDays(date, 3 * dir);
  if (view === 'month') return `${addMonths(date.slice(0, 7), dir)}-01`;
  return addDays(date, 7 * dir);
}

export function PlanPage() {
  const today = useToday();
  const me = useSession((s) => s.user);
  const [date, setDate] = useState(today);
  const [view, setViewState] = useState<CalView>(savedView);
  const setView = (v: CalView) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* fine */
    }
  };
  const { data: events = [] } = useTable('events');
  const { data: todos = [] } = useTable('todos');
  const { data: todoDone = [] } = useTable('todo_done');
  const [sheet, setSheet] = useState<{ event: CalEvent | null; time?: string; date?: string } | null>(null);
  const doneKeys = useMemo(() => new Set(todoDone.map((d) => `${d.todo_id}|${d.date}`)), [todoDone]);
  const dayEvents = eventsOn(events, date);
  // Once connected, Google Calendar is the calendar: the events on screen come from (and go to) Google.
  useGoogleReturn();
  const gStatus = useGoogleStatus();
  const useGoogle = Boolean(gStatus.data?.mine);
  const week = weekOf(date);
  const shown = view === 'list' ? week : daysFor(view, date);
  const from = shown[0];
  const to = shown[shown.length - 1];
  const gq = useGoogleEvents(from, to, useGoogle);
  // Have the periods either side ready, so moving back and forth is instant.
  const qc = useQueryClient();
  useEffect(() => {
    if (!useGoogle) return;
    const id = window.setTimeout(() => {
      for (const dir of [1, -1] as const) {
        const next = view === 'list' ? weekOf(addDays(date, 7 * dir)) : daysFor(view, step(view, date, dir));
        prefetchGoogleWeek(qc, next[0], next[next.length - 1]);
      }
    }, 1200);
    return () => window.clearTimeout(id);
  }, [qc, useGoogle, view, from]); // eslint-disable-line react-hooks/exhaustive-deps
  const google = gq.data?.events ?? [];
  const [gSheet, setGSheet] = useState<{ event: GEvent | null; time?: string; date?: string } | null>(null);
  const dayGoogle = google.filter((g) => gOn(g, date)).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const marks = (d: string) =>
    eventsOn(events, d).length + google.filter((g) => gOn(g, d)).length + todosFor(todos, doneKeys, d, today).filter((i) => !i.done).length;
  const addEvent = (at?: { date: string; time: string }) =>
    useGoogle ? setGSheet({ event: null, ...at }) : setSheet({ event: null, ...at });

  // Everything on screen, from Google and from the app, in one shape for the grids.
  const items = useMemo<CalItem[]>(() => {
    if (view === 'list') return [];
    const out: CalItem[] = google.map((g) => ({
      key: `g|${g.owner}|${g.calendarId}|${g.id}`,
      title: g.title,
      emoji: g.emoji,
      date: g.date,
      time: g.time,
      endDate: g.endDate,
      endTime: g.endTime,
      color: g.color || '#9eaaff',
      theirs: Boolean(me && g.owner !== me.id),
      open: () => setGSheet({ event: g }),
    }));
    for (const d of shown) {
      for (const e of eventsOn(events, d)) {
        out.push({
          key: `l|${e.id}|${d}`,
          title: e.title,
          emoji: e.emoji,
          date: d,
          time: e.time,
          endDate: d,
          endTime: null,
          color: '#9eaaff',
          theirs: Boolean(me && e.who !== 'both' && e.who !== me.id),
          open: () => setSheet({ event: e }),
        });
      }
    }
    return out;
  }, [view, google, events, from, to, me]); // eslint-disable-line react-hooks/exhaustive-deps

  const prev = () => setDate(step(view, date, -1));
  const next = () => setDate(step(view, date, 1));
  const openDay = (d: string) => {
    setDate(d);
    setView('day');
  };

  return (
    <>
      <PageHeader
        title={t('Plan')}
        subtitle={view === 'list' ? relativeDay(date) : monthLabel(date.slice(0, 7))}
        right={
          <IconButton label={t('New event')} onClick={() => addEvent()}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <Segmented
        size="sm"
        className="mb-2"
        value={view}
        accent="var(--color-todo)"
        onChange={setView}
        options={[
          { value: 'day', label: t('Day') },
          { value: '3day', label: t('3 days') },
          { value: 'week', label: t('Week') },
          { value: 'month', label: t('Month') },
          { value: 'list', label: t('List') },
        ]}
      />
      {view !== 'list' && (
        <div className="mb-2 flex items-center justify-between px-1">
          <IconButton label={t('Previous')} onClick={prev}>
            <ChevronLeft size={20} className="rtl:-scale-x-100" />
          </IconButton>
          <button type="button" onClick={() => setDate(today)} className="press rounded-full px-3 py-1.5 text-sm font-semibold">
            {periodTitle(view, shown, date)}
            {!shown.includes(today) && <span className="ms-2 text-xs font-medium text-accent">{t('Today')}</span>}
          </button>
          <IconButton label={t('Next')} onClick={next}>
            <ChevronRight size={20} className="rtl:-scale-x-100" />
          </IconButton>
        </div>
      )}
      {view === 'list' && <WeekStrip date={date} onPick={setDate} marks={marks} />}
      <div className="space-y-3">
        {!useGoogle && <GoogleConnectCard />}
        {useGoogle && gq.isError && (
          <p className="rounded-2xl bg-white/[0.035] px-3 py-2.5 text-sm text-ink-3">{t('Can’t reach Google Calendar right now. Check your connection.')}</p>
        )}
        {view === 'month' && <MonthGrid date={date} days={shown} items={items} onPickDay={openDay} onPrev={prev} onNext={next} />}
        {(view === 'day' || view === '3day' || view === 'week') && (
          <TimeGrid days={shown} items={items} onSlot={(d, time) => addEvent({ date: d, time })} onPickDay={openDay} onPrev={prev} onNext={next} />
        )}
        {view === 'list' && (
          <Card
            title={t('Schedule')}
            icon={CalendarDays}
            accent="var(--color-todo)"
            action={
              <button type="button" onClick={() => addEvent()} className="text-xs font-semibold text-todo">
                {t('Add event')}
              </button>
            }
          >
            {dayEvents.length || dayGoogle.length ? (
              <ul className="space-y-1.5">
                {dayEvents.map((e) => (
                  <EventRow key={e.id} e={e} onOpen={() => setSheet({ event: e })} />
                ))}
                {dayGoogle.map((g) => (
                  <GEventRow key={`${g.owner}|${g.id}`} e={g} onOpen={() => setGSheet({ event: g })} />
                ))}
              </ul>
            ) : useGoogle && gq.isLoading && !gq.data ? (
              <p className="py-1 text-sm text-ink-3">{t('Loading your Google Calendar…')}</p>
            ) : (
              <p className="py-1 text-sm text-ink-3">{t('Nothing scheduled. Tap “Add event” to plan something.')}</p>
            )}
          </Card>
        )}
        {(view === 'list' || view === 'day') && (
          <Card
            title={t('To-dos')}
            icon={ListTodo}
            accent="var(--color-todo)"
            action={
              <Link to="/life/todos" className="text-xs font-semibold text-todo">
                {t('All')}
              </Link>
            }
          >
            <TodosForDay date={date} />
          </Card>
        )}
        {view === 'list' && date === today && <RoutinesCard />}
        {view === 'list' && <OtherPlan date={date} />}
        {useGoogle && <GoogleConnectCard />}
      </div>
      <EventSheet open={sheet !== null} event={sheet?.event ?? null} date={sheet?.date ?? date} time={sheet?.time} onClose={() => setSheet(null)} />
      <GEventSheet open={gSheet !== null} event={gSheet?.event ?? null} date={gSheet?.date ?? date} time={gSheet?.time} onClose={() => setGSheet(null)} />
    </>
  );
}
