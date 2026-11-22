import { locale, t } from './i18n';

/** Local-calendar date helpers. All dates are stored as YYYY-MM-DD in the user's local time. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function shortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

export function weekdayLong(iso: string): string {
  return parseISODate(iso).toLocaleDateString(locale(), { weekday: 'long' });
}

export function relativeDay(iso: string): string {
  const today = todayISO();
  if (iso === today) return t('Today');
  if (iso === addDays(today, -1)) return t('Yesterday');
  if (iso === addDays(today, 1)) return t('Tomorrow');
  return parseISODate(iso).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'short' });
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Short weekday name for a JS weekday number, in the current language. */
export function weekdayShort(wd: number): string {
  // 2023-01-01 was a Sunday.
  return new Date(2023, 0, 1 + wd).toLocaleDateString(locale(), { weekday: 'short' });
}

export function weekdayNarrow(wd: number): string {
  return new Date(2023, 0, 1 + wd).toLocaleDateString(locale(), { weekday: 'narrow' });
}
