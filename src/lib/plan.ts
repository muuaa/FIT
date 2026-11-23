/** Pure helpers for Plan (events, countdowns). */
import type { CalEvent, Countdown } from '@/types/db';
import { addDays, parseISODate, toISODate } from './date';

/** Does an event happen on this date (taking repeats into account)? */
export function occursOn(e: CalEvent, date: string): boolean {
  if (date < e.date) return false;
  if (e.repeat === 'none') return date === e.date;
  const a = parseISODate(e.date);
  const b = parseISODate(date);
  if (e.repeat === 'weekly') return a.getDay() === b.getDay();
  if (e.repeat === 'monthly') {
    // On the 31st etc., fall back to the last day of shorter months.
    const last = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate();
    return b.getDate() === Math.min(a.getDate(), last);
  }
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); // yearly
}

export function eventsOn(events: CalEvent[], date: string): CalEvent[] {
  return events
    .filter((e) => occursOn(e, date))
    .sort((x, y) => (x.time ?? '').localeCompare(y.time ?? '') || x.title.localeCompare(y.title));
}

/** The week (7 dates) containing `date`, starting on Saturday. */
export function weekOf(date: string): string[] {
  const d = parseISODate(date);
  const back = (d.getDay() + 1) % 7; // Sat = 0
  const start = addDays(toISODate(d), -back);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Next occurrence of a countdown on or after `today`, and days left. */
export function nextCountdown(c: Countdown, today: string): { date: string; days: number } {
  let target = c.date;
  if (c.yearly) {
    const t = parseISODate(today);
    const d = parseISODate(c.date);
    let next = new Date(t.getFullYear(), d.getMonth(), d.getDate());
    if (toISODate(next) < today) next = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
    target = toISODate(next);
  }
  const days = Math.round((parseISODate(target).getTime() - parseISODate(today).getTime()) / 86_400_000);
  return { date: target, days };
}
