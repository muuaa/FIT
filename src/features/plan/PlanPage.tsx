import { CalendarDays, ChevronLeft, ChevronRight, ListTodo, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useSession } from '@/features/auth/session';
import { TodosForDay } from '@/features/life/todos';
import { useTable } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/lib/cn';
import { addDays, monthLabel, parseISODate, relativeDay, weekdayNarrow } from '@/lib/date';
import { t } from '@/lib/i18n';
import { todosFor } from '@/lib/life';
import { usePartnerStore } from '@/lib/partner';
import { eventsOn, weekOf } from '@/lib/plan';
import type { CalEvent } from '@/types/db';
import { EventSheet } from './EventSheet';
import { FocusCard } from './Focus';
import { RoutinesCard } from './Routines';

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
  const partner = usePartnerStore((s) => s.partner);
  const who = e.who === 'both' ? null : e.who === me?.id ? t('Me') : e.who === partner?.id ? partner.name : null;
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

export function PlanPage() {
  const today = useToday();
  const [date, setDate] = useState(today);
  const { data: events = [] } = useTable('events');
  const { data: todos = [] } = useTable('todos');
  const { data: todoDone = [] } = useTable('todo_done');
  const [sheet, setSheet] = useState<{ event: CalEvent | null } | null>(null);
  const doneKeys = useMemo(() => new Set(todoDone.map((d) => `${d.todo_id}|${d.date}`)), [todoDone]);
  const dayEvents = eventsOn(events, date);
  const marks = (d: string) => eventsOn(events, d).length + todosFor(todos, doneKeys, d, today).filter((i) => !i.done).length;

  return (
    <>
      <PageHeader
        title={t('Plan')}
        subtitle={relativeDay(date)}
        right={
          <IconButton label={t('New event')} onClick={() => setSheet({ event: null })}>
            <Plus size={22} />
          </IconButton>
        }
      />
      <WeekStrip date={date} onPick={setDate} marks={marks} />
      <div className="space-y-3">
        <Card
          title={t('Schedule')}
          icon={CalendarDays}
          accent="var(--color-todo)"
          action={
            <button type="button" onClick={() => setSheet({ event: null })} className="text-xs font-semibold text-todo">
              {t('Add event')}
            </button>
          }
        >
          {dayEvents.length ? (
            <ul className="space-y-1.5">
              {dayEvents.map((e) => (
                <EventRow key={e.id} e={e} onOpen={() => setSheet({ event: e })} />
              ))}
            </ul>
          ) : (
            <p className="py-1 text-sm text-ink-3">{t('Nothing scheduled. Tap “Add event” to plan something.')}</p>
          )}
        </Card>
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
        {date === today && <RoutinesCard />}
        {date === today && <FocusCard />}
      </div>
      <EventSheet open={sheet !== null} event={sheet?.event ?? null} date={date} onClose={() => setSheet(null)} />
    </>
  );
}
