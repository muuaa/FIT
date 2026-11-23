/**
 * Two-way sync between this device's store (localDb) and the `records` table in Supabase.
 *
 *  - Every local write lands in an outbox (persisted, so nothing is lost offline or on reload),
 *    coalesced per row; the outbox is pushed in batches shortly after changes.
 *  - Pulls fetch rows changed on the server since the last pull (with a small overlap, so rows
 *    committed slightly out of timestamp order are never missed) and apply them locally, except
 *    rows that still have unsent local edits: the local edit wins and is pushed next.
 *  - Conflicts resolve as "last write to reach the server wins", per row.
 */
import { create } from 'zustand';
import { t } from './i18n';
import { applyRemote, onLocalChange, readKey, removeKey, writeKey, type RowChange } from './localDb';
import { supabase } from './supabase';

interface OutboxEntry {
  tbl: string;
  row_id: string;
  data: unknown | null;
  v: number; // bumps on every local edit, so a push only clears what it actually sent
}

export interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'error';
  pending: number;
  lastSyncedAt: number | null;
  error: string | null;
}

export const useSyncStore = create<SyncState>()(() => ({ status: 'idle', pending: 0, lastSyncedAt: null, error: null }));

const PAGE = 1000;
const OVERLAP_MS = 5 * 60 * 1000;

let userId: string | null = null;
let outbox = new Map<string, OutboxEntry>();
let version = 0;
let pushTimer: number | null = null;
let running: Promise<boolean> | null = null;
let rerun = false;
let unsubscribe: (() => void) | null = null;
let onRemoteApplied: (() => void) | null = null;
let paused = false;

/** Pause while showing the partner's data, so nothing is pulled into the wrong place. */
export function pauseSync(p: boolean): void {
  paused = p;
  if (!p) void syncNow();
}

const k = (tbl: string, row: string) => `${tbl}\u0000${row}`;

function saveOutbox() {
  try {
    writeKey('outbox', JSON.stringify([...outbox.values()]));
  } catch {
    /* storage full: keep in memory, still pushed this session */
  }
  useSyncStore.setState({ pending: outbox.size });
}

function loadOutbox() {
  outbox = new Map();
  try {
    const list = JSON.parse(readKey('outbox') ?? '[]') as OutboxEntry[];
    for (const e of list) outbox.set(k(e.tbl, e.row_id), e);
    version = list.reduce((m, e) => Math.max(m, e.v), 0);
  } catch {
    /* corrupt outbox: start empty */
  }
  useSyncStore.setState({ pending: outbox.size });
}

/** Queue changes for upload (also used to upload pre-account data into a new account). */
export function enqueue(changes: RowChange[]): void {
  if (!userId) return;
  for (const c of changes) outbox.set(k(c.tbl, c.row_id), { tbl: c.tbl, row_id: c.row_id, data: c.data, v: ++version });
  saveOutbox();
  schedulePush();
}

function schedulePush(delay = 800) {
  if (pushTimer !== null) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void syncNow();
  }, delay);
}

/**
 * Tables both people edit together (one joint copy). They live in `household_records`; everything
 * else is personal and lives in `records` under the user's id (readable, not writable, by the partner).
 */
export const JOINT_TABLES = new Set(['todos', 'todo_done', 'expenses', 'home_settings', 'events', 'countdowns', 'goals', 'bills', 'meal_plan', 'chores']);

async function push(uid: string): Promise<void> {
  if (!supabase) return;
  while (outbox.size) {
    const batch = [...outbox.values()].slice(0, 500);
    const mine = batch.filter((e) => !JOINT_TABLES.has(e.tbl));
    const joint = batch.filter((e) => JOINT_TABLES.has(e.tbl));
    if (mine.length) {
      const { error } = await supabase.from('records').upsert(
        mine.map((e) => ({ user_id: uid, tbl: e.tbl, row_id: e.row_id, data: e.data, deleted: e.data === null })),
        { onConflict: 'user_id,tbl,row_id' },
      );
      if (error) throw error;
    }
    if (joint.length) {
      const { error } = await supabase.from('household_records').upsert(
        joint.map((e) => ({ tbl: e.tbl, row_id: e.row_id, data: e.data, deleted: e.data === null })),
        { onConflict: 'tbl,row_id' },
      );
      if (error) throw error;
    }
    if (uid !== userId) return; // signed out mid-push
    for (const e of batch) {
      const cur = outbox.get(k(e.tbl, e.row_id));
      if (cur && cur.v === e.v) outbox.delete(k(e.tbl, e.row_id));
    }
    saveOutbox();
  }
}

/** Pull rows changed since the last pull from one server table. Returns how many were applied. */
async function pullFrom(uid: string, table: 'records' | 'household_records', cursorKey: string): Promise<number> {
  if (!supabase) return 0;
  const cursor = readKey(cursorKey);
  const since = cursor ? new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString() : null;
  let applied = 0;
  let newest = cursor;
  let from = 0;
  for (;;) {
    let q = supabase
      .from(table)
      .select('tbl,row_id,data,deleted,updated_at')
      .order('updated_at', { ascending: true })
      .order('tbl', { ascending: true })
      .order('row_id', { ascending: true })
      .range(from, from + PAGE - 1);
    // The partner's personal rows are readable too; only pull our own into our space.
    if (table === 'records') q = q.eq('user_id', uid);
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q;
    if (error) throw error;
    if (uid !== userId) return applied;
    for (const r of data ?? []) {
      if (!outbox.has(k(r.tbl, r.row_id))) {
        applyRemote(r.tbl, r.row_id, r.deleted ? null : r.data);
        applied++;
      }
      if (!newest || r.updated_at > newest) newest = r.updated_at;
    }
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  if (newest) writeKey(cursorKey, newest);
  return applied;
}

async function pull(uid: string): Promise<number> {
  const a = await pullFrom(uid, 'records', 'cursor');
  const b = await pullFrom(uid, 'household_records', 'cursor_home');
  return a + b;
}

function describe(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
  if (/relation .*records.* does not exist|Could not find the table/i.test(msg))
    return t('The cloud database is not set up yet (run the setup SQL in Supabase).');
  return msg;
}

/** Push local changes, then pull remote ones. Safe to call any time; calls are merged. */
export function syncNow(): Promise<boolean> {
  if (!userId || !supabase || paused) return Promise.resolve(false);
  if (running) {
    rerun = true;
    return running;
  }
  const uid = userId;
  running = (async () => {
    if (!navigator.onLine) {
      useSyncStore.setState({ status: 'offline' });
      return false;
    }
    useSyncStore.setState({ status: 'syncing', error: null });
    try {
      await push(uid);
      const applied = await pull(uid);
      if (uid !== userId) return false;
      writeKey('synced', '1');
      useSyncStore.setState({ status: 'idle', lastSyncedAt: Date.now(), error: null });
      if (applied) onRemoteApplied?.();
      return true;
    } catch (e) {
      const offline = !navigator.onLine || (e instanceof TypeError && /fetch/i.test(e.message));
      useSyncStore.setState({ status: offline ? 'offline' : 'error', error: offline ? null : describe(e) });
      return false;
    }
  })().finally(() => {
    running = null;
    if (rerun) {
      rerun = false;
      schedulePush(0);
    }
  });
  return running;
}

/** Has this device ever completed a sync for the current account? */
export function hasSyncedBefore(): boolean {
  return readKey('synced') === '1';
}

const onWake = () => {
  if (document.visibilityState === 'visible') void syncNow();
};
const onOnline = () => void syncNow();

/** Start syncing for a signed-in user (the local store must already be switched to their space). */
export function startSync(uid: string, remoteApplied: () => void): void {
  stopSync();
  userId = uid;
  onRemoteApplied = remoteApplied;
  loadOutbox();
  unsubscribe = onLocalChange(enqueue);
  document.addEventListener('visibilitychange', onWake);
  window.addEventListener('online', onOnline);
  const id = window.setInterval(() => document.visibilityState === 'visible' && void syncNow(), 120_000);
  const prevUnsub = unsubscribe;
  unsubscribe = () => {
    prevUnsub();
    window.clearInterval(id);
  };
}

export function stopSync(): void {
  unsubscribe?.();
  unsubscribe = null;
  document.removeEventListener('visibilitychange', onWake);
  window.removeEventListener('online', onOnline);
  if (pushTimer !== null) window.clearTimeout(pushTimer);
  pushTimer = null;
  userId = null;
  paused = false;
  onRemoteApplied = null;
  outbox = new Map();
  useSyncStore.setState({ status: 'idle', pending: 0, lastSyncedAt: null, error: null });
}

/** Forget this device's sync position (used when the outbox is cleared on sign-out). */
export function resetSyncState(): void {
  removeKey('cursor');
  removeKey('cursor_home');
}
