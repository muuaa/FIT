/** Pure helpers for the Life modules (no storage, easy to reason about). */
import type { Expense, Habit, Repeat, Todo } from '@/types/db';
import { addDays, parseISODate } from './date';

// ---------------------------------------------------------------- habits

export function habitDueOn(h: Habit, date: string): boolean {
  if (h.archived) return false;
  if (date < h.created_at.slice(0, 10)) return false;
  return h.days.length === 0 || h.days.includes(parseISODate(date).getDay());
}

/**
 * Consecutive due days completed, counting back from today. Today only counts if it's done
 * (an unfinished today doesn't break the streak yet).
 */
export function habitStreak(h: Habit, done: Set<string>, today: string): number {
  let streak = 0;
  let d = today;
  for (let i = 0; i < 3660; i++) {
    if (habitDueOn(h, d) || done.has(d)) {
      if (done.has(d)) streak++;
      else if (d !== today) break;
    }
    if (d < h.created_at.slice(0, 10)) break;
    d = addDays(d, -1);
  }
  return streak;
}

export function bestStreak(h: Habit, done: Set<string>, today: string): number {
  let best = 0;
  let cur = 0;
  for (let d = h.created_at.slice(0, 10); d <= today; d = addDays(d, 1)) {
    if (done.has(d)) best = Math.max(best, ++cur);
    else if (habitDueOn(h, d) && d !== today) cur = 0;
  }
  return best;
}

export const HABIT_EMOJI = ['🎯', '💧', '📖', '🧘', '🚶', '🏃', '💪', '🥗', '🍎', '🚭', '🛏️', '🙏', '🧠', '✍️', '🎸', '🌞', '📵', '🧴', '💊', '🦷'];

// ---------------------------------------------------------------- to-dos

export function repeatsOn(repeat: Repeat, start: string, date: string): boolean {
  if (date < start) return false;
  const wd = parseISODate(date).getDay();
  switch (repeat) {
    case 'daily':
      return true;
    case 'weekdays':
      return wd >= 1 && wd <= 5;
    case 'weekly':
      return wd === parseISODate(start).getDay();
    default:
      return date === start;
  }
}

export interface TodoItem {
  todo: Todo;
  done: boolean;
  overdue: boolean;
}

/**
 * To-dos for a day: one-offs planned that day, repeating ones due that day, and (on today only)
 * unfinished one-offs from earlier days, marked overdue.
 */
export function todosFor(todos: Todo[], doneKeys: Set<string>, date: string, today: string): TodoItem[] {
  const out: TodoItem[] = [];
  for (const t of todos) {
    if (t.repeat !== 'none') {
      if (t.date && repeatsOn(t.repeat, t.date, date)) out.push({ todo: t, done: doneKeys.has(`${t.id}|${date}`), overdue: false });
      continue;
    }
    if (t.date === date) out.push({ todo: t, done: Boolean(t.done_at), overdue: false });
    else if (date === today && t.date && t.date < today && !t.done_at) out.push({ todo: t, done: false, overdue: true });
  }
  return out.sort((a, b) => Number(a.done) - Number(b.done) || Number(b.overdue) - Number(a.overdue) || a.todo.created_at.localeCompare(b.todo.created_at));
}

// ---------------------------------------------------------------- sleep

/** Minutes between bedtime and wake time (HH:MM), crossing midnight when needed. */
export function sleepMinutes(bed: string, wake: string): number {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  if ([bh, bm, wh, wm].some((n) => !Number.isFinite(n))) return 0;
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

export function hm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------- money

export const EXPENSE_CATEGORIES: { id: string; emoji: string }[] = [
  { id: 'Food', emoji: '🍔' },
  { id: 'Groceries', emoji: '🛒' },
  { id: 'Transport', emoji: '🚗' },
  { id: 'Fitness', emoji: '🏋️' },
  { id: 'Health', emoji: '💊' },
  { id: 'Shopping', emoji: '🛍️' },
  { id: 'Bills', emoji: '🧾' },
  { id: 'Fun', emoji: '🎉' },
  { id: 'Coffee', emoji: '☕' },
  { id: 'Other', emoji: '📦' },
];

export function categoryEmoji(id: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.emoji ?? '📦';
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function sumAmount(list: Expense[]): number {
  return Math.round(list.reduce((a, e) => a + Number(e.amount), 0) * 100) / 100;
}

export function money(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
