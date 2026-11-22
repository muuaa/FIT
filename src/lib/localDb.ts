/**
 * On-device database. Every table is a JSON array in localStorage.
 *  - Signed out / local-only builds: keys are `fit.v1.<table>` (the original layout).
 *  - Signed in: keys are `fit.v1.u.<userId>.<table>`, so two accounts on one device never mix.
 * Every write is reported to `onLocalChange` listeners (the cloud sync engine) as row-level
 * upserts/deletes. Rows pulled from the cloud are applied with `applyRemote`, which does not
 * report back, so nothing echoes.
 * If storage is blocked (private window, sandboxed preview) the app keeps working in memory
 * for the session and `storageAvailable` reports false so the UI can warn.
 */
import type {
  Attachment,
  CheckIn,
  Expense,
  Habit,
  HabitLog,
  JournalEntry,
  Measurement,
  SleepLog,
  StepsDay,
  Todo,
  TodoDone,
  BodyweightLog,
  CardioLog,
  Exercise,
  FoodEntry,
  Profile,
  SavedMeal,
  SetLog,
  Supplement,
  WorkoutSession,
} from '@/types/db';

export interface WaterDay {
  date: string;
  ml: number;
}
export interface SupplementLog {
  supplement_id: string;
  date: string;
  taken_at: string;
}

export interface Tables {
  exercises: Exercise;
  workout_sessions: WorkoutSession;
  set_logs: SetLog;
  food_entries: FoodEntry;
  saved_meals: SavedMeal;
  water_days: WaterDay;
  supplements: Supplement;
  supplement_logs: SupplementLog;
  bodyweight_logs: BodyweightLog;
  cardio_logs: CardioLog;
  sleep_logs: SleepLog;
  checkins: CheckIn;
  steps_days: StepsDay;
  measurements: Measurement;
  habits: Habit;
  habit_logs: HabitLog;
  todos: Todo;
  todo_done: TodoDone;
  expenses: Expense;
  journal: JournalEntry;
  attachments: Attachment;
}
export type TableName = keyof Tables;

export const TABLE_NAMES: TableName[] = [
  'exercises',
  'workout_sessions',
  'set_logs',
  'food_entries',
  'saved_meals',
  'water_days',
  'supplements',
  'supplement_logs',
  'bodyweight_logs',
  'cardio_logs',
  'sleep_logs',
  'checkins',
  'steps_days',
  'measurements',
  'habits',
  'habit_logs',
  'todos',
  'todo_done',
  'expenses',
  'journal',
  'attachments',
];

const BASE = 'fit.v1.';
let PREFIX = BASE;
let currentUser: string | null = null;
const memory = new Map<string, string>();

function probeStorage(): boolean {
  try {
    const k = `${BASE}__probe`;
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export const storageAvailable = probeStorage();

function readRaw(key: string): string | null {
  if (storageAvailable) {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      /* fall through to memory */
    }
  }
  return memory.get(PREFIX + key) ?? null;
}

function writeRaw(key: string, value: string): void {
  memory.set(PREFIX + key, value);
  if (!storageAvailable) return;
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch (e) {
    throw new Error(
      e instanceof DOMException && e.name === 'QuotaExceededError'
        ? 'Device storage is full. Export a backup and clear old data.'
        : 'Could not save to this device.',
    );
  }
}

function removeRaw(key: string): void {
  memory.delete(PREFIX + key);
  if (!storageAvailable) return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

const cache = new Map<string, unknown[]>();

export function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function all<T extends TableName>(t: T): Tables[T][] {
  if (!cache.has(t)) {
    let rows: Tables[T][] = [];
    try {
      const raw = readRaw(t);
      if (raw) rows = JSON.parse(raw) as Tables[T][];
    } catch {
      rows = [];
    }
    cache.set(t, Array.isArray(rows) ? rows : []);
  }
  return cache.get(t) as Tables[T][];
}

// ---------------------------------------------------------------- change tracking (for sync)

/** Tables with at most one row per day, keyed by that date. */
const DATE_KEYED = new Set<TableName>(['water_days', 'bodyweight_logs', 'sleep_logs', 'checkins', 'steps_days', 'journal']);

/** Stable id of a row within its table (some tables are keyed by date rather than an id). */
export function rowKey<T extends TableName>(t: T, row: Tables[T]): string {
  if (DATE_KEYED.has(t)) return (row as { date: string }).date;
  if (t === 'supplement_logs') {
    const r = row as SupplementLog;
    return `${r.supplement_id}|${r.date}`;
  }
  if (t === 'habit_logs') {
    const r = row as HabitLog;
    return `${r.habit_id}|${r.date}`;
  }
  if (t === 'todo_done') {
    const r = row as TodoDone;
    return `${r.todo_id}|${r.date}`;
  }
  return (row as { id: string }).id;
}

export interface RowChange {
  tbl: TableName | 'profile';
  row_id: string;
  data: unknown | null; // null = deleted
}

type ChangeListener = (changes: RowChange[]) => void;
const changeListeners = new Set<ChangeListener>();

export function onLocalChange(l: ChangeListener): () => void {
  changeListeners.add(l);
  return () => void changeListeners.delete(l);
}

function emit(changes: RowChange[]): void {
  if (changes.length) changeListeners.forEach((l) => l(changes));
}

function diff<T extends TableName>(t: T, prev: Tables[T][], next: Tables[T][]): RowChange[] {
  const before = new Map(prev.map((r) => [rowKey(t, r), r]));
  const out: RowChange[] = [];
  for (const r of next) {
    const k = rowKey(t, r);
    const old = before.get(k);
    before.delete(k);
    // Unchanged rows keep their object identity (map/filter), so most rows skip the deep compare.
    if (old === r || (old && JSON.stringify(old) === JSON.stringify(r))) continue;
    out.push({ tbl: t, row_id: k, data: r });
  }
  for (const k of before.keys()) out.push({ tbl: t, row_id: k, data: null });
  return out;
}

function commit<T extends TableName>(t: T, rows: Tables[T][]): void {
  const prev = all(t);
  writeRaw(t, JSON.stringify(rows));
  cache.set(t, rows);
  emit(diff(t, prev, rows));
}

/** Replace a whole table (reported to sync as row changes). */
export function replaceTable<T extends TableName>(t: T, rows: Tables[T][]): void {
  commit(t, rows);
}

/** Apply a row that came from the cloud. Does not notify change listeners. */
export function applyRemote(tbl: string, rowId: string, data: unknown | null): void {
  if (tbl === 'profile') {
    if (data === null) {
      removeRaw('profile');
      profileCache = null;
    } else {
      writeRaw('profile', JSON.stringify(data));
      profileCache = null;
    }
    return;
  }
  if (!(TABLE_NAMES as string[]).includes(tbl)) return; // a table from a newer app version
  const t = tbl as TableName;
  const rows = all(t);
  const idx = rows.findIndex((r) => rowKey(t, r) === rowId);
  let next: Tables[TableName][];
  if (data === null) {
    if (idx === -1) return;
    next = rows.filter((_, i) => i !== idx);
  } else {
    next = idx === -1 ? [...rows, data as Tables[TableName]] : rows.map((r, i) => (i === idx ? (data as Tables[TableName]) : r));
  }
  writeRaw(t, JSON.stringify(next));
  cache.set(t, next);
}

/** Every row on this device, as changes (used to upload legacy data into a new account). */
export function snapshot(): RowChange[] {
  const out: RowChange[] = [];
  for (const t of TABLE_NAMES) for (const r of all(t)) out.push({ tbl: t, row_id: rowKey(t, r), data: r });
  const p = readRaw('profile');
  if (p) out.push({ tbl: 'profile', row_id: 'local', data: { ...DEFAULT_PROFILE, ...JSON.parse(p), id: 'local' } });
  return out;
}

// ---------------------------------------------------------------- accounts

/**
 * Switch storage to a signed-in user's space, back to the original local space (null), or to an
 * empty throwaway space while signed out ('signed-out'), so nothing written then can be mistaken
 * for pre-account data later.
 */
export function setNamespace(userId: string | null | 'signed-out'): void {
  currentUser = userId === 'signed-out' ? null : userId;
  PREFIX = userId === 'signed-out' ? `${BASE}signedout.` : userId ? `${BASE}u.${userId}.` : BASE;
  cache.clear();
  profileCache = null;
}

export function currentNamespace(): string | null {
  return currentUser;
}

/** Raw value in this user's space that isn't a table (sync cursor, outbox, flags). */
export function readKey(key: string): string | null {
  return readRaw(`__${key}`);
}
export function writeKey(key: string, value: string): void {
  writeRaw(`__${key}`, value);
}
export function removeKey(key: string): void {
  removeRaw(`__${key}`);
}

/** Data saved before accounts existed (the original `fit.v1.<table>` keys), if any. */
export function readLegacy(): { tables: Partial<Record<TableName, unknown[]>>; profile: Partial<Profile> | null } | null {
  if (!storageAvailable) return null;
  const tables: Partial<Record<TableName, unknown[]>> = {};
  let found = false;
  for (const t of TABLE_NAMES) {
    try {
      const raw = localStorage.getItem(BASE + t);
      if (!raw) continue;
      const rows = JSON.parse(raw);
      if (Array.isArray(rows) && rows.length) {
        tables[t] = rows;
        found = true;
      }
    } catch {
      /* skip unreadable table */
    }
  }
  let profile: Partial<Profile> | null = null;
  try {
    const raw = localStorage.getItem(BASE + 'profile');
    profile = raw ? JSON.parse(raw) : null;
  } catch {
    profile = null;
  }
  // A profile alone (just opened the app once) isn't worth migrating; real entries are.
  return found ? { tables, profile } : null;
}

/** After migrating, keep one copy of the old data aside (just in case) and clear the old keys. */
export function retireLegacy(): void {
  if (!storageAvailable) return;
  try {
    const copy: Record<string, string> = {};
    for (const k of [...TABLE_NAMES, 'profile', 'meta']) {
      const v = localStorage.getItem(BASE + k);
      if (v !== null) copy[k] = v;
    }
    // Keep the first copy: it's the one with the real pre-account data.
    if (!localStorage.getItem(`${BASE}legacy-backup`))
      localStorage.setItem(`${BASE}legacy-backup`, JSON.stringify({ saved_at: new Date().toISOString(), data: copy }));
    for (const k of [...TABLE_NAMES, 'profile', 'meta']) localStorage.removeItem(BASE + k);
  } catch {
    /* best effort */
  }
}

export function insert<T extends TableName>(t: T, row: Tables[T]): Tables[T] {
  commit(t, [...all(t), row]);
  return row;
}

export function update<T extends TableName>(
  t: T,
  match: (r: Tables[T]) => boolean,
  patch: Partial<Tables[T]>,
): void {
  commit(
    t,
    all(t).map((r) => (match(r) ? { ...r, ...patch } : r)),
  );
}

export function remove<T extends TableName>(t: T, match: (r: Tables[T]) => boolean): void {
  commit(
    t,
    all(t).filter((r) => !match(r)),
  );
}

/** Replace the row matching `match`, or insert it. */
export function upsert<T extends TableName>(t: T, row: Tables[T], match: (r: Tables[T]) => boolean): void {
  const rows = all(t);
  const idx = rows.findIndex(match);
  commit(t, idx === -1 ? [...rows, row] : rows.map((r, i) => (i === idx ? row : r)));
}

// ---------------------------------------------------------------- profile

export const DEFAULT_PROFILE: Profile = {
  id: 'local',
  display_name: '',
  kcal_target: 2700,
  protein_target_g: 160,
  carbs_target_g: 340,
  fat_target_g: 75,
  water_target_ml: 4000,
  bottle_ml: 800,
  water_step_ml: 250,
  split_mode: 'PPL-UL',
  default_rest_seconds: 90,
  steps_target: 10000,
  sleep_target_h: 8,
  monthly_budget: 0,
  currency: 'USD',
  language: 'en',
  today_cards: ['workout', 'calories', 'water', 'weight', 'habits', 'todos', 'supplements', 'cardio'],
};

const DEFAULT_SUPPLEMENTS: [string, string][] = [
  ['Whey Protein', '1 scoop (~25 g protein)'],
  ['Creatine Monohydrate', '5 g'],
  ['Omega-3', '1–2 g EPA+DHA'],
  ['Zinc', '15–25 mg'],
  ['Magnesium Glycinate', '200–400 mg'],
  ['Vitamin D3', '1,000–2,000 IU'],
  ['Vitamin B12', 'per label'],
];

let profileCache: Profile | null = null;

export function getProfile(): Profile {
  if (profileCache) return profileCache;
  let stored: Partial<Profile> | null = null;
  try {
    const raw = readRaw('profile');
    stored = raw ? (JSON.parse(raw) as Partial<Profile>) : null;
  } catch {
    stored = null;
  }
  if (!stored) {
    // First launch (on this device, or for this account): create the profile and the default
    // (inactive) supplement shelf.
    stored = DEFAULT_PROFILE;
    writeRaw('profile', JSON.stringify(stored));
    emit([{ tbl: 'profile', row_id: 'local', data: stored }]);
    if (all('supplements').length === 0) {
      commit(
        'supplements',
        DEFAULT_SUPPLEMENTS.map(([name, dosage], position) => ({ id: uid(), name, dosage, active: false, position })),
      );
    }
  }
  profileCache = { ...DEFAULT_PROFILE, ...stored, id: 'local' };
  return profileCache;
}

export function setProfile(patch: Partial<Profile>): Profile {
  const next = { ...getProfile(), ...patch, id: 'local' };
  writeRaw('profile', JSON.stringify(next));
  profileCache = next;
  emit([{ tbl: 'profile', row_id: 'local', data: next }]);
  return next;
}

// ---------------------------------------------------------------- backup

export interface Backup {
  app: 'fit';
  version: 1;
  exported_at: string;
  profile: Profile;
  tables: { [K in TableName]: Tables[K][] };
}

export function exportAll(): Backup {
  return {
    app: 'fit',
    version: 1,
    exported_at: new Date().toISOString(),
    profile: getProfile(),
    tables: Object.fromEntries(TABLE_NAMES.map((t) => [t, all(t)])) as Backup['tables'],
  };
}

export function importAll(json: string): void {
  let data: Backup;
  try {
    data = JSON.parse(json) as Backup;
  } catch {
    throw new Error('That file is not a Replete backup (invalid JSON).');
  }
  if (data?.app !== 'fit' || data.version !== 1 || typeof data.tables !== 'object') {
    throw new Error('That file is not a Replete backup.');
  }
  for (const t of TABLE_NAMES) {
    const rows = data.tables[t];
    commit(t, Array.isArray(rows) ? (rows as never[]) : []);
  }
  profileCache = null;
  const profile = { ...DEFAULT_PROFILE, ...data.profile, id: 'local' };
  writeRaw('profile', JSON.stringify(profile));
  emit([{ tbl: 'profile', row_id: 'local', data: profile }]);
}

/** Deletes every entry (and, when signed in, from the account on every device too). */
export function eraseAll(): void {
  for (const t of TABLE_NAMES) commit(t, []);
  removeRaw('profile');
  removeRaw('meta');
  profileCache = null;
  emit([{ tbl: 'profile', row_id: 'local', data: null }]);
}

// ---------------------------------------------------------------- meta flags

export function getMeta(): { welcomed?: boolean; sample?: boolean } {
  try {
    return JSON.parse(readRaw('meta') ?? '{}');
  } catch {
    return {};
  }
}

export function setMeta(patch: { welcomed?: boolean; sample?: boolean }): void {
  writeRaw('meta', JSON.stringify({ ...getMeta(), ...patch }));
}

/** Ask the browser not to evict our data under storage pressure (best effort). */
export function requestPersistence(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* unsupported */
  }
}
