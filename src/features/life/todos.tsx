import { CalendarClock, Check, ListTodo, Plus, Repeat as RepeatIcon, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DayPicker } from '@/components/ui/DayPicker';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { Empty } from '@/components/ui/States';
import { useTable, useTableActions } from '@/hooks/useTable';
import { useToday } from '@/hooks/useToday';
import { tick } from '@/lib/alerts';
import { cn } from '@/lib/cn';
import { addDays, relativeDay } from '@/lib/date';
import { t } from '@/lib/i18n';
import { todosFor, type TodoItem } from '@/lib/life';
import { uid } from '@/lib/localDb';
import type { Repeat, Todo } from '@/types/db';

const ACCENT = 'var(--color-todo)';

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: 'Once',
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Every week',
};

function useTodoData() {
  const { data: todos = [] } = useTable('todos');
  const { data: done = [] } = useTable('todo_done');
  const doneKeys = useMemo(() => new Set(done.map((d) => `${d.todo_id}|${d.date}`)), [done]);
  return { todos, doneKeys };
}

function useTodoActions() {
  const todos = useTableActions('todos');
  const done = useTableActions('todo_done');
  return {
    toggle(item: TodoItem, date: string) {
      tick();
      const tdo = item.todo;
      if (tdo.repeat === 'none') todos.patch(tdo.id, { done_at: item.done ? null : new Date().toISOString() });
      else if (item.done) done.remove(`${tdo.id}|${date}`);
      else done.put({ todo_id: tdo.id, date });
    },
    add(title: string, date: string | null, repeat: Repeat = 'none') {
      todos.insert({ id: uid(), title, date, repeat, done_at: null, note: '', created_at: new Date().toISOString() });
    },
    patch: todos.patch,
    remove(tdo: Todo) {
      todos.remove(tdo.id, t('Deleted “{title}”', { title: tdo.title }));
    },
  };
}

function TodoRow({ item, date, onOpen }: { item: TodoItem; date: string; onOpen: () => void }) {
  const actions = useTodoActions();
  const { todo, done, overdue } = item;
  return (
    <li className="flex items-center gap-1 rounded-2xl bg-surface-2 pe-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={todo.title}
        onClick={() => actions.toggle(item, date)}
        className="grid size-12 shrink-0 place-items-center"
      >
        <span
          className={cn(
            'grid size-6 place-items-center rounded-lg border-2 transition',
            done ? 'border-todo bg-todo text-bg' : 'border-ink-3',
          )}
        >
          {done && <Check size={14} strokeWidth={3} />}
        </span>
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-2.5 text-start">
        <span className={cn('block truncate text-sm font-medium', done && 'text-ink-3 line-through')}>{todo.title}</span>
        {(overdue || todo.repeat !== 'none' || todo.note) && (
          <span className="flex items-center gap-1.5 truncate text-[11px] text-ink-3">
            {overdue && todo.date && <span className="font-semibold text-danger">{t('From {day}', { day: relativeDay(todo.date) })}</span>}
            {todo.repeat !== 'none' && (
              <span className="flex items-center gap-0.5">
                <RepeatIcon size={10} /> {t(REPEAT_LABEL[todo.repeat])}
              </span>
            )}
            {todo.note && <span className="truncate">{todo.note}</span>}
          </span>
        )}
      </button>
    </li>
  );
}

function QuickAdd({ date, placeholder }: { date: string | null; placeholder: string }) {
  const actions = useTodoActions();
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    actions.add(text.trim().slice(0, 200), date);
    setText('');
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="done"
        className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-surface-2 px-4 text-ink outline-none placeholder:text-ink-3 focus:border-ink-3"
      />
      <button
        type="submit"
        aria-label={t('Add')}
        disabled={!text.trim()}
        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-todo text-bg transition active:scale-90 disabled:opacity-40"
      >
        <Plus size={22} />
      </button>
    </form>
  );
}

function TodoSheet({ todo, onClose }: { todo: Todo | null; onClose: () => void }) {
  const actions = useTodoActions();
  const today = useToday();
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [seeded, setSeeded] = useState<string | null>(null);
  if ((todo?.id ?? null) !== seeded) {
    setSeeded(todo?.id ?? null);
    if (todo) {
      setTitle(todo.title);
      setNote(todo.note);
      setDate(todo.date);
      setRepeat(todo.repeat);
    }
  }
  if (!todo) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const save = () => {
    actions.patch(todo.id, {
      title: title.trim() || todo.title,
      note: note.trim(),
      date: repeat !== 'none' ? (date ?? today) : date,
      repeat,
    });
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('To-do')}
      footer={
        <div className="flex gap-2">
          <IconButton
            label={t('Delete')}
            className="size-11 bg-danger/12 text-danger"
            onClick={() => {
              actions.remove(todo);
              onClose();
            }}
          >
            <Trash2 size={18} />
          </IconButton>
          <Button variant="primary" accent={ACCENT} className="flex-1" onClick={save}>
            {t('Save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t('Title')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        <Field label={t('Note')} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Optional')} />
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('When')}</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: today, l: t('Today') },
              { v: addDays(today, 1), l: t('Tomorrow') },
              { v: null, l: t('Someday') },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => setDate(o.v)}
                className={cn('h-9 rounded-full px-3 text-sm font-semibold', date === o.v ? 'bg-todo text-bg' : 'bg-surface-2 text-ink-2')}
              >
                {o.l}
              </button>
            ))}
            <input
              type="date"
              aria-label={t('Pick a date')}
              value={date ?? ''}
              onChange={(e) => setDate(e.target.value || null)}
              className="h-9 rounded-full bg-surface-2 px-3 text-sm text-ink-2"
            />
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-3">{t('Repeat')}</span>
          <Segmented<Repeat>
            size="sm"
            value={repeat}
            onChange={setRepeat}
            accent={ACCENT}
            options={(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => ({ value: r, label: t(REPEAT_LABEL[r]) }))}
          />
        </div>
      </div>
    </Sheet>
  );
}

/** Today's plan: quick add + checklist. Used on Today and the Life hub. */
export function TodosToday({ limit }: { limit?: number }) {
  const today = useToday();
  const { todos, doneKeys } = useTodoData();
  const items = todosFor(todos, doneKeys, today, today);
  const [open, setOpen] = useState<Todo | null>(null);
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <div className="space-y-2">
      <QuickAdd date={today} placeholder={t('Add a to-do for today')} />
      {shown.length > 0 && (
        <ul className="space-y-1.5">
          {shown.map((it) => (
            <TodoRow key={it.todo.id} item={it} date={today} onOpen={() => setOpen(it.todo)} />
          ))}
        </ul>
      )}
      {limit && items.length > limit && (
        <p className="text-xs text-ink-3">{t('+{n} more in To-dos', { n: items.length - limit })}</p>
      )}
      <TodoSheet todo={open} onClose={() => setOpen(null)} />
    </div>
  );
}

export function TodosPage() {
  const today = useToday();
  const [date, setDate] = useState(today);
  const { todos, doneKeys } = useTodoData();
  const items = todosFor(todos, doneKeys, date, today);
  const someday = todos.filter((x) => x.repeat === 'none' && !x.date && !x.done_at);
  const recurring = todos.filter((x) => x.repeat !== 'none');
  const [open, setOpen] = useState<Todo | null>(null);
  const actions = useTodoActions();
  const doneCount = items.filter((i) => i.done).length;

  return (
    <>
      <PageHeader title={t('To-dos')} back="/life" />
      <DayPicker date={date} onChange={setDate} allowFuture />
      <div className="space-y-3">
        <Card title={relativeDay(date)} icon={ListTodo} accent={ACCENT} action={items.length ? <span className="tabular text-xs text-ink-3">{doneCount}/{items.length}</span> : undefined}>
          <div className="space-y-2">
            <QuickAdd date={date} placeholder={date === today ? t('Add a to-do for today') : t('Add a to-do for this day')} />
            {items.length === 0 ? (
              <p className="py-2 text-center text-sm text-ink-3">{t('Nothing planned. Add something above.')}</p>
            ) : (
              <ul className="space-y-1.5">
                {items.map((it) => (
                  <TodoRow key={it.todo.id} item={it} date={date} onOpen={() => setOpen(it.todo)} />
                ))}
              </ul>
            )}
            <p className="text-[11px] text-ink-3">{t('Tap a to-do to set a date, repeat it or add a note.')}</p>
          </div>
        </Card>

        <Card title={t('Someday')} icon={CalendarClock} accent={ACCENT}>
          <div className="space-y-2">
            <QuickAdd date={null} placeholder={t('Add an idea or task without a date')} />
            {someday.length > 0 ? (
              <ul className="space-y-1.5">
                {someday.map((x) => (
                  <li key={x.id} className="flex items-center gap-1 rounded-2xl bg-surface-2 pe-1">
                    <button type="button" onClick={() => setOpen(x)} className="min-w-0 flex-1 px-4 py-3 text-start text-sm font-medium">
                      <span className="block truncate">{x.title}</span>
                    </button>
                    <Button size="sm" variant="ghost" className="text-todo" onClick={() => actions.patch(x.id, { date: today })}>
                      {t('Do today')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={CalendarClock} title={t('Nothing here')} />
            )}
          </div>
        </Card>

        {recurring.length > 0 && (
          <Card title={t('Repeating')} icon={RepeatIcon} accent={ACCENT}>
            <ul className="divide-y divide-line/60">
              {recurring.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => setOpen(x)} className="flex w-full items-center gap-2 py-2.5 text-start">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{x.title}</span>
                    <span className="text-xs text-ink-3">{t(REPEAT_LABEL[x.repeat])}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <TodoSheet todo={open ? (todos.find((x) => x.id === open.id) ?? null) : null} onClose={() => setOpen(null)} />
    </>
  );
}

export function useTodosSummary(): string {
  const today = useToday();
  const { todos, doneKeys } = useTodoData();
  const items = todosFor(todos, doneKeys, today, today);
  return items.length ? `${items.filter((i) => i.done).length}/${items.length}` : t('Clear');
}
