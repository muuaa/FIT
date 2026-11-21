/**
 * Moves data saved before accounts existed (on this device, in the original storage keys) into
 * the signed-in account. Into an empty account it's copied as-is. Into an account that already
 * has data, it's merged: exercises, supplements and saved meals with the same name are matched
 * up instead of duplicated, and existing entries for a date (water, weigh-ins) are kept.
 */
import { all, getProfile, readLegacy, replaceTable, retireLegacy, rowKey, setMeta, setProfile, snapshot, TABLE_NAMES, type TableName, type Tables } from './localDb';
import type { Exercise, SetLog, Supplement } from '@/types/db';
import type { SupplementLog } from './localDb';

export function migrateLegacyIntoAccount(): number {
  const legacy = readLegacy();
  if (!legacy) return 0;
  const accountEmpty = snapshot().length === 0;
  let moved = 0;

  const exerciseMap = new Map<string, string>();
  const supplementMap = new Map<string, string>();
  if (!accountEmpty) {
    const exByName = new Map(all('exercises').map((e) => [`${e.day_type}|${e.name.trim().toLowerCase()}`, e.id]));
    for (const e of (legacy.tables.exercises ?? []) as Exercise[]) {
      const hit = exByName.get(`${e.day_type}|${e.name.trim().toLowerCase()}`);
      if (hit) exerciseMap.set(e.id, hit);
    }
    const supByName = new Map(all('supplements').map((s) => [s.name.trim().toLowerCase(), s.id]));
    for (const s of (legacy.tables.supplements ?? []) as Supplement[]) {
      const hit = supByName.get(s.name.trim().toLowerCase());
      if (hit) supplementMap.set(s.id, hit);
    }
  }
  const savedMealNames = new Set(all('saved_meals').map((m) => m.name.trim().toLowerCase()));

  for (const t of TABLE_NAMES) {
    let rows = (legacy.tables[t] ?? []) as Tables[TableName][];
    if (!rows.length) continue;
    if (t === 'exercises') rows = (rows as Exercise[]).filter((e) => !exerciseMap.has(e.id));
    if (t === 'supplements') rows = (rows as Supplement[]).filter((s) => !supplementMap.has(s.id));
    if (t === 'saved_meals' && !accountEmpty) rows = rows.filter((m) => !savedMealNames.has((m as { name: string }).name.trim().toLowerCase()));
    if (t === 'set_logs')
      rows = (rows as SetLog[]).map((s) => (s.exercise_id && exerciseMap.has(s.exercise_id) ? { ...s, exercise_id: exerciseMap.get(s.exercise_id)! } : s));
    if (t === 'supplement_logs')
      rows = (rows as SupplementLog[]).map((l) => (supplementMap.has(l.supplement_id) ? { ...l, supplement_id: supplementMap.get(l.supplement_id)! } : l));

    const existing = all(t);
    const have = new Set(existing.map((r) => rowKey(t, r)));
    const add = rows.filter((r) => !have.has(rowKey(t, r)));
    if (add.length) {
      replaceTable(t, [...existing, ...add] as Tables[typeof t][]);
      moved += add.length;
    }
  }

  // Settings (targets, split, name) come along only into a fresh account.
  if (accountEmpty && legacy.profile) {
    const { id: _id, ...rest } = legacy.profile;
    void _id;
    setProfile(rest);
  } else {
    getProfile();
  }
  setMeta({ welcomed: true });
  retireLegacy();
  return moved;
}
