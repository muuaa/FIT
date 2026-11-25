// Minimal iCalendar (.ics) reading and writing for Better Together's Google Calendar link.
// Reading handles what Google's "secret address in iCal format" contains: timed and all-day events,
// time zones, repeats (RRULE with DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY,
// BYMONTHDAY), skipped dates (EXDATE), moved/changed single occurrences (RECURRENCE-ID) and
// cancelled events.

export interface Occurrence {
  uid: string;
  title: string;
  /** Local (in the requested time zone) start date YYYY-MM-DD and time HH:MM (null = all day). */
  date: string;
  time: string | null;
  /** Local end date (exclusive for all-day events), for events spanning several days. */
  endDate: string;
  endTime: string | null;
}

// ---------------------------------------------------------------- time zones

/** Offset (ms) of a time zone from UTC at a given instant. */
function tzOffset(utcMs: number, tz: string): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(utcMs))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}

/** The instant of a wall-clock time in a time zone. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz); // second pass for times near a DST change
  return t;
}

/** Wall-clock parts of an instant in a time zone. */
export function utcToZoned(ms: number, tz: string): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function validTz(tz: string | undefined, fallback: string): string {
  if (!tz) return fallback;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------- parsing

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line: string): Prop | null {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const head = line.slice(0, i);
  const value = line.slice(i + 1);
  const [name, ...ps] = head.split(';');
  const params: Record<string, string> = {};
  for (const p of ps) {
    const j = p.indexOf('=');
    if (j > 0) params[p.slice(0, j).toUpperCase()] = p.slice(j + 1).replace(/^"|"$/g, '');
  }
  return { name: name.toUpperCase(), params, value };
}

const unescape = (s: string) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();

/** A DTSTART/DTEND-style value: an instant (timed) or a date (all day). */
type When = { allDay: true; y: number; m: number; d: number } | { allDay: false; ms: number; tz: string; wall: number[] };

function parseWhen(p: Prop, defTz: string): When | null {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (p.params.VALUE === 'DATE' || m[4] === undefined) return { allDay: true, y, m: mo, d };
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  if (m[7]) return { allDay: false, ms: Date.UTC(y, mo - 1, d, h, mi, s), tz: 'UTC', wall: [y, mo, d, h, mi, s] };
  const tz = validTz(p.params.TZID, defTz);
  return { allDay: false, ms: zonedToUtc(y, mo, d, h, mi, s, tz), tz, wall: [y, mo, d, h, mi, s] };
}

interface VEvent {
  uid: string;
  title: string;
  start: When;
  end: When | null;
  durationMs: number | null;
  rrule: Record<string, string> | null;
  exdates: Set<string>; // keys of skipped occurrences
  recurrenceId: string | null; // key of the occurrence this one replaces
  cancelled: boolean;
}

/** A comparable key for an occurrence start (date for all-day, minute instant otherwise). */
function keyOf(w: When): string {
  return w.allDay ? `${w.y}${String(w.m).padStart(2, '0')}${String(w.d).padStart(2, '0')}` : String(Math.floor(w.ms / 60000));
}

function parseDuration(v: string): number | null {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const ms = (((Number(m[2] ?? 0) * 7 + Number(m[3] ?? 0)) * 24 + Number(m[4] ?? 0)) * 60 + Number(m[5] ?? 0)) * 60000 + Number(m[6] ?? 0) * 1000;
  return m[1] === '-' ? -ms : ms;
}

export function parseIcs(text: string): VEvent[] {
  const lines = unfold(text);
  let defTz = 'UTC';
  const out: VEvent[] = [];
  let cur: Prop[] | null = null;
  let depth = 0; // nested blocks inside a VEVENT (VALARM)
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith('X-WR-TIMEZONE:')) defTz = validTz(line.slice(14).trim(), defTz);
    if (line === 'BEGIN:VEVENT') {
      cur = [];
      depth = 0;
      continue;
    }
    if (!cur) continue;
    if (line.startsWith('BEGIN:')) {
      depth++;
      continue;
    }
    if (line.startsWith('END:') && line !== 'END:VEVENT') {
      depth--;
      continue;
    }
    if (line === 'END:VEVENT') {
      const ev = toEvent(cur, defTz);
      if (ev) out.push(ev);
      cur = null;
      continue;
    }
    if (depth === 0) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }
  return out;
}

function toEvent(props: Prop[], defTz: string): VEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  const ds = get('DTSTART');
  if (!ds) return null;
  const start = parseWhen(ds, defTz);
  if (!start) return null;
  const de = get('DTEND');
  const dur = get('DURATION');
  const rr = get('RRULE');
  const rrule: Record<string, string> | null = rr
    ? Object.fromEntries(rr.value.split(';').map((kv) => kv.split('=') as [string, string]).filter((kv) => kv.length === 2).map(([k, v]) => [k.toUpperCase(), v]))
    : null;
  const exdates = new Set<string>();
  for (const p of props.filter((x) => x.name === 'EXDATE'))
    for (const v of p.value.split(',')) {
      const w = parseWhen({ ...p, value: v }, defTz);
      if (w) exdates.add(keyOf(w));
    }
  const rid = get('RECURRENCE-ID');
  const ridWhen = rid ? parseWhen(rid, defTz) : null;
  return {
    uid: get('UID')?.value ?? crypto.randomUUID(),
    title: unescape(get('SUMMARY')?.value ?? '(No title)').slice(0, 200) || '(No title)',
    start,
    end: de ? parseWhen(de, defTz) : null,
    durationMs: dur ? parseDuration(dur.value) : null,
    rrule,
    exdates,
    recurrenceId: ridWhen ? keyOf(ridWhen) : null,
    cancelled: (get('STATUS')?.value ?? '').toUpperCase() === 'CANCELLED',
  };
}

// ---------------------------------------------------------------- repeats

const WD: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** All start dates (as wall-clock y/m/d) of a repeating event, in order, up to `limitDay`. */
function* repeatDates(y0: number, m0: number, d0: number, r: Record<string, string>, limitDay: number): Generator<[number, number, number]> {
  const freq = r.FREQ;
  const interval = Math.max(1, Number(r.INTERVAL ?? 1));
  const byday = (r.BYDAY ?? '').split(',').filter(Boolean);
  const bymd = (r.BYMONTHDAY ?? '').split(',').filter(Boolean).map(Number);
  const dayNum = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  const fromNum = (n: number): [number, number, number] => {
    const dt = new Date(n * 86400000);
    return [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  };
  const startN = dayNum(y0, m0, d0);
  let guard = 0;
  if (freq === 'DAILY') {
    for (let n = startN; n <= limitDay && guard++ < 5000; n += interval) yield fromNum(n);
  } else if (freq === 'WEEKLY') {
    const days = byday.length ? byday.map((b) => WD[b.slice(-2)]).filter((x) => x !== undefined).sort() : [new Date(startN * 86400000).getUTCDay()];
    // Weeks start on Monday by default (WKST); good enough for Google calendars.
    const weekStart = startN - ((new Date(startN * 86400000).getUTCDay() + 6) % 7);
    for (let w = weekStart; w <= limitDay && guard++ < 3000; w += 7 * interval)
      for (const wd of days) {
        const n = w + ((wd + 6) % 7);
        if (n >= startN && n <= limitDay) yield fromNum(n);
      }
  } else if (freq === 'MONTHLY') {
    for (let k = 0; guard++ < 1200; k += interval) {
      const y = y0 + Math.floor((m0 - 1 + k) / 12);
      const m = ((m0 - 1 + k) % 12) + 1;
      if (dayNum(y, m, 1) > limitDay) break;
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const ds: number[] = [];
      if (byday.length) {
        for (const b of byday) {
          const mm = b.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
          if (!mm) continue;
          const wd = WD[mm[2]];
          const all: number[] = [];
          for (let d = 1; d <= last; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === wd) all.push(d);
          if (!mm[1]) ds.push(...all);
          else {
            const nth = Number(mm[1]);
            const pick = nth > 0 ? all[nth - 1] : all[all.length + nth];
            if (pick) ds.push(pick);
          }
        }
      } else for (const md of bymd.length ? bymd : [d0]) ds.push(md < 0 ? last + md + 1 : md);
      for (const d of [...new Set(ds)].sort((a, b) => a - b)) {
        if (d < 1 || d > last) continue;
        const n = dayNum(y, m, d);
        if (n >= startN && n <= limitDay) yield [y, m, d];
      }
    }
  } else if (freq === 'YEARLY') {
    for (let k = 0; guard++ < 200; k += interval) {
      const y = y0 + k;
      if (dayNum(y, 1, 1) > limitDay) break;
      const last = new Date(Date.UTC(y, m0, 0)).getUTCDate();
      if (d0 <= last) yield [y, m0, d0];
    }
  } else {
    yield [y0, m0, d0];
  }
}

// ---------------------------------------------------------------- expanding

/** Occurrences overlapping [from, to] (local dates, inclusive), shown in time zone `tz`. */
export function occurrences(events: VEvent[], from: string, to: string, tz: string): Occurrence[] {
  const zone = validTz(tz, 'UTC');
  const fromN = Math.floor(Date.parse(`${from}T00:00:00Z`) / 86400000);
  const toN = Math.floor(Date.parse(`${to}T00:00:00Z`) / 86400000);
  const overrides = new Map<string, Set<string>>();
  for (const e of events) if (e.recurrenceId) (overrides.get(e.uid) ?? overrides.set(e.uid, new Set()).get(e.uid)!).add(e.recurrenceId);
  const out: Occurrence[] = [];
  const push = (e: VEvent, startW: When) => {
    if (e.cancelled) return;
    let o: Occurrence;
    if (startW.allDay) {
      const s = Date.UTC(startW.y, startW.m - 1, startW.d);
      let lenDays = 1;
      if (e.end && e.end.allDay && e.start.allDay)
        lenDays = Math.max(1, Math.round((Date.UTC(e.end.y, e.end.m - 1, e.end.d) - Date.UTC(e.start.y, e.start.m - 1, e.start.d)) / 86400000));
      else if (e.durationMs) lenDays = Math.max(1, Math.round(e.durationMs / 86400000));
      const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
      o = { uid: e.uid, title: e.title, date: iso(s), time: null, endDate: iso(s + lenDays * 86400000), endTime: null };
    } else {
      const len = e.end && !e.end.allDay && !e.start.allDay ? e.end.ms - e.start.ms : (e.durationMs ?? 3600000);
      const a = utcToZoned(startW.ms, zone);
      const b = utcToZoned(startW.ms + Math.max(0, len), zone);
      o = { uid: e.uid, title: e.title, date: a.date, time: a.time, endDate: b.date, endTime: b.time };
    }
    const sN = Math.floor(Date.parse(`${o.date}T00:00:00Z`) / 86400000);
    const eN = Math.floor(Date.parse(`${o.endDate}T00:00:00Z`) / 86400000) - (o.time === null ? 1 : 0);
    if (eN >= fromN && sN <= toN) out.push(o);
  };
  for (const e of events) {
    if (!e.rrule || e.recurrenceId) {
      push(e, e.start);
      continue;
    }
    const skip = new Set([...e.exdates, ...(overrides.get(e.uid) ?? [])]);
    const until = e.rrule.UNTIL ? parseWhen({ name: 'UNTIL', params: {}, value: e.rrule.UNTIL }, 'UTC') : null;
    const untilKeyDay = until ? (until.allDay ? Date.UTC(until.y, until.m - 1, until.d) : until.ms) : Infinity;
    const count = e.rrule.COUNT ? Number(e.rrule.COUNT) : Infinity;
    const s = e.start;
    const [y0, m0, d0] = s.allDay ? [s.y, s.m, s.d] : (s.wall as number[]);
    let n = 0;
    for (const [y, m, d] of repeatDates(y0, m0, d0, e.rrule, toN + 2)) {
      if (++n > count) break;
      const w: When = s.allDay ? { allDay: true, y, m, d } : { allDay: false, ms: zonedToUtc(y, m, d, s.wall[3], s.wall[4], s.wall[5], s.tz), tz: s.tz, wall: [y, m, d, s.wall[3], s.wall[4], s.wall[5]] };
      const at = w.allDay ? Date.UTC(y, m - 1, d) : w.ms;
      if (at > untilKeyDay) break;
      if (skip.has(keyOf(w))) continue;
      push(e, w);
    }
  }
  return out.sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
}

// ---------------------------------------------------------------- writing

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold lines to 75 octets as the format requires. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 74) {
    let cut = 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

export interface FeedEvent {
  id: string;
  title: string;
  emoji: string;
  date: string;
  time: string | null;
  repeat: 'none' | 'weekly' | 'monthly' | 'yearly';
  note: string;
  updated: string;
}

export function buildIcs(events: FeedEvent[], tz: string, name: string): string {
  const zone = validTz(tz, 'UTC');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Better Together//Plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, `X-WR-TIMEZONE:${zone}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const rule: Record<string, string> = { weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };
  for (const e of events) {
    const [y, m, d] = e.date.split('-');
    lines.push('BEGIN:VEVENT', `UID:${e.id}@better-together`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(`${e.emoji ? `${e.emoji} ` : ''}${e.title}`)}`);
    if (e.time) {
      const [h, mi] = e.time.split(':');
      const start = zonedToUtc(+y, +m, +d, +h, +mi, 0, zone);
      const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
      lines.push(`DTSTART:${fmt(start)}`, `DTEND:${fmt(start + 3600000)}`);
    } else {
      const next = new Date(Date.UTC(+y, +m - 1, +d + 1)).toISOString().slice(0, 10).replace(/-/g, '');
      lines.push(`DTSTART;VALUE=DATE:${y}${m}${d}`, `DTEND;VALUE=DATE:${next}`);
    }
    if (rule[e.repeat]) lines.push(`RRULE:${rule[e.repeat]}`);
    if (e.note) lines.push(`DESCRIPTION:${esc(e.note)}`);
    lines.push(`LAST-MODIFIED:${(e.updated || new Date().toISOString()).replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
