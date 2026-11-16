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
  return parseISODate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function weekdayLong(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: 'long' });
}

export function relativeDay(iso: string): string {
  const today = todayISO();
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}
