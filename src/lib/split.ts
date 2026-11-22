import type { DayType, SplitMode } from '@/types/db';
import { t } from './i18n';

/** Lifting days in program order: Thu, Fri, Sat, Mon, Tue (JS getDay numbers). */
export const TRAINING_WEEKDAYS = [4, 5, 6, 1, 2] as const;

export const SPLITS: Record<SplitMode, DayType[]> = {
  'PPL-UL': ['push', 'pull', 'legs', 'upper', 'lower'],
  'UL-PPL': ['upper', 'lower', 'push', 'pull', 'legs'],
};

export const DAY_TYPES: DayType[] = ['push', 'pull', 'legs', 'upper', 'lower'];

export const DAY_LABEL: Record<DayType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  upper: 'Upper',
  lower: 'Lower',
};

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Day type scheduled for a given JS weekday, or null for a rest day. */
export function dayTypeForWeekday(mode: SplitMode, weekday: number): DayType | null {
  const idx = (TRAINING_WEEKDAYS as readonly number[]).indexOf(weekday);
  return idx === -1 ? null : SPLITS[mode][idx];
}

export function dayTypeForDate(mode: SplitMode, date: Date): DayType | null {
  return dayTypeForWeekday(mode, date.getDay());
}

/** The weekly schedule in program order, for display. */
export function weekSchedule(mode: SplitMode): { weekday: number; dayType: DayType }[] {
  return TRAINING_WEEKDAYS.map((weekday, i) => ({ weekday, dayType: SPLITS[mode][i] }));
}

/** Next scheduled training day strictly after `from`. */
export function nextTrainingDay(mode: SplitMode, from: Date): { date: Date; dayType: DayType } {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const t = dayTypeForDate(mode, d);
    if (t) return { date: d, dayType: t };
  }
  throw new Error('No training days configured');
}

/** Translated day-type name. */
export function dayLabel(d: DayType): string {
  return t(DAY_LABEL[d]);
}
