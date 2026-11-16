/**
 * On-device database. Every table is a JSON array in localStorage under `fit.v1.<table>`.
 * If storage is blocked (private window, sandboxed preview) the app keeps working in memory
 * for the session and `storageAvailable` reports false so the UI can warn.
 */
import type {
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
];

const PREFIX = 'fit.v1.';
const memory = new Map<string, string>();

function probeStorage(): boolean {
  try {
    const k = `${PREFIX}__probe`;
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
  return memory.get(key) ?? null;
}

function writeRaw(key: string, value: string): void {
  memory.set(key, value);
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
  memory.delete(key);
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

function commit<T extends TableName>(t: T, rows: Tables[T][]): void {
  writeRaw(t, JSON.stringify(rows));
  cache.set(t, rows);
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
  split_mode: 'PPL-UL',
  default_rest_seconds: 90,
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
    // First launch on this device: create profile and the default (inactive) supplement shelf.
    stored = DEFAULT_PROFILE;
    writeRaw('profile', JSON.stringify(stored));
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
    throw new Error('That file is not a FIT backup (invalid JSON).');
  }
  if (data?.app !== 'fit' || data.version !== 1 || typeof data.tables !== 'object') {
    throw new Error('That file is not a FIT backup.');
  }
  for (const t of TABLE_NAMES) {
    const rows = data.tables[t];
    commit(t, Array.isArray(rows) ? (rows as never[]) : []);
  }
  profileCache = null;
  writeRaw('profile', JSON.stringify({ ...DEFAULT_PROFILE, ...data.profile }));
}

export function eraseAll(): void {
  for (const t of TABLE_NAMES) {
    removeRaw(t);
    cache.delete(t);
  }
  removeRaw('profile');
  removeRaw('meta');
  profileCache = null;
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
