// Better Together <-> Google Calendar, fully connected (each person's main Google calendar).
//
//  POST {action:'status'}                          Who has connected Google (and whether it's set up).
//  POST {action:'start'}                           Google sign-in address for this user.
//  GET  /google/callback?code&state                Google sends the user back here after allowing.
//  POST {action:'disconnect'}                      Forget this user's Google connection.
//  POST {action:'list', from, to, tz}              Both people's events in a date range.
//  POST {action:'save', event, tz}                 Create or update an event (in the right calendar).
//  POST {action:'delete', owner, id, series}       Delete an event (or a whole repeating series).
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const APP_URL = 'https://muuaa.github.io/FIT/';
const REDIRECT = 'https://muuaa.github.io/google-callback.html'; // Google returns here (an authorised domain), which forwards to /callback
// calendar.events: read and edit events. calendarlist.readonly: see which calendars you have (Family,
// Workout…) so all of them show, not only the main one.
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
const LIST_SCOPE = 'calendar.calendarlist.readonly';
const BASE = 'https://www.googleapis.com/calendar/v3';
const events = (cal: string) => `${BASE}/calendars/${encodeURIComponent(cal)}/events`;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
class UserError extends Error {}

// ---------------------------------------------------------------- time zones

function tzOffset(utcMs: number, tz: string): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(new Date(utcMs))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(utcMs / 1000) * 1000;
}
function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - tzOffset(guess, tz);
  t = guess - tzOffset(t, tz);
  return t;
}
function utcToZoned(ms: number, tz: string): { date: string; time: string } {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const zone = (tz: unknown) => {
  try {
    if (typeof tz === 'string' && tz) {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      return tz;
    }
  } catch {
    /* fall through */
  }
  return 'Asia/Amman';
};
const addDay = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- tokens

const access = new Map<string, { token: string; until: number }>();

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  return { ok: res.ok, body: (await res.json().catch(() => ({}))) as Record<string, string> };
}

/** A fresh access token for a user's Google account, or null if they aren't connected. */
async function accessToken(userId: string): Promise<string | null> {
  const hit = access.get(userId);
  if (hit && hit.until > Date.now()) return hit.token;
  const { data } = await db.from('google_tokens').select('refresh_token').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: data.refresh_token });
  if (!r.ok) {
    if (r.body.error === 'invalid_grant') await db.from('google_tokens').delete().eq('user_id', userId); // access was removed
    console.error('refresh failed', r.body.error);
    return null;
  }
  access.set(userId, { token: r.body.access_token, until: Date.now() + (Number(r.body.expires_in ?? 3600) - 120) * 1000 });
  return r.body.access_token;
}

async function google(userId: string, method: string, url: string, body?: unknown) {
  const token = await accessToken(userId);
  if (!token) throw new UserError('not-connected');
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('google api', method, res.status, JSON.stringify(out).slice(0, 300));
    if (res.status === 404 || res.status === 410) throw new UserError('That event no longer exists in Google Calendar.');
    if (res.status === 403) throw new UserError('Google didn’t allow that (you may not be able to change this calendar or event).');
    throw new Error(`google ${res.status}`);
  }
  return out;
}

// ---------------------------------------------------------------- people

async function people(me: string) {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 10 });
  const partner = users?.users.find((u) => u.id !== me) ?? null;
  const { data: toks } = await db.from('google_tokens').select('user_id,google_email');
  const email = (id: string | undefined) => toks?.find((t) => t.user_id === id)?.google_email || users?.users.find((u) => u.id === id)?.email || '';
  return {
    partnerId: partner?.id ?? null,
    connected: (id: string | null | undefined) => Boolean(id && toks?.some((t) => t.user_id === id)),
    email,
  };
}

// ---------------------------------------------------------------- calendars

interface Cal {
  id: string;
  name: string;
  color: string;
  primary: boolean;
  writable: boolean;
}
const calCache = new Map<string, { at: number; cals: Cal[] }>();

/** The calendars a person has ticked in Google Calendar (falls back to the main one). */
async function calendars(userId: string): Promise<Cal[]> {
  const hit = calCache.get(userId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.cals;
  let cals: Cal[];
  try {
    const items: Record<string, any>[] = [];
    let page = '';
    for (let i = 0; i < 4; i++) {
      const q = new URLSearchParams({ minAccessRole: 'reader', maxResults: '250', ...(page ? { pageToken: page } : {}) });
      const r = await google(userId, 'GET', `${BASE}/users/me/calendarList?${q}`);
      items.push(...((r?.items ?? []) as Record<string, any>[]));
      page = r?.nextPageToken ?? '';
      if (!page) break;
    }
    cals = items
      .filter((c) => c.selected !== false && !c.hidden && !c.deleted)
      .map((c) => ({
        id: String(c.id),
        name: String(c.summaryOverride ?? c.summary ?? 'Calendar'),
        color: String(c.backgroundColor ?? '#a89bff'),
        primary: Boolean(c.primary),
        writable: c.accessRole === 'owner' || c.accessRole === 'writer',
      }))
      .sort((a, b) => Number(b.primary) - Number(a.primary) || a.name.localeCompare(b.name));
    if (!cals.some((c) => c.primary)) cals.unshift({ id: 'primary', name: 'Calendar', color: '#a89bff', primary: true, writable: true });
  } catch (e) {
    if (e instanceof UserError && e.message === 'not-connected') throw e;
    // Older connections can't read the calendar list yet (reconnect fixes it): use the main calendar.
    cals = [{ id: 'primary', name: 'Calendar', color: '#a89bff', primary: true, writable: true }];
  }
  calCache.set(userId, { at: Date.now(), cals });
  return cals;
}

// ---------------------------------------------------------------- events

const EMOJI_AT_START = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*️?)\s+/u;

interface AppEvent {
  id: string;
  owner: string; // whose calendar it lives in
  calendarId: string;
  calendarName: string;
  color: string;
  title: string;
  emoji: string;
  date: string;
  time: string | null;
  endDate: string;
  endTime: string | null;
  who: string; // 'both' or a user id
  repeat: 'none' | 'weekly' | 'monthly' | 'yearly';
  recurringId: string | null;
  note: string;
  link: string;
  editable: boolean;
  uid: string;
}

function toApp(g: Record<string, any>, owner: string, cal: Cal, partnerId: string | null, partnerEmail: string, myEmail: string, tz: string): AppEvent {
  const raw = String(g.summary ?? '(No title)');
  const m = raw.match(EMOJI_AT_START);
  const allDay = Boolean(g.start?.date);
  let date: string, time: string | null, endDate: string, endTime: string | null;
  if (allDay) {
    date = g.start.date;
    time = null;
    endDate = g.end?.date ?? addDay(date, 1);
    endTime = null;
  } else {
    const s = utcToZoned(Date.parse(g.start.dateTime), tz);
    const e = utcToZoned(Date.parse(g.end?.dateTime ?? g.start.dateTime), tz);
    [date, time, endDate, endTime] = [s.date, s.time, e.date, e.time];
  }
  const attendees: string[] = (g.attendees ?? []).map((a: { email?: string }) => (a.email ?? '').toLowerCase());
  const other = owner === partnerId ? myEmail : partnerEmail;
  const shared = Boolean(other) && attendees.includes(other.toLowerCase());
  const rule = String((g.recurrence ?? [])[0] ?? '');
  return {
    id: g.id,
    owner,
    calendarId: cal.id,
    calendarName: cal.name,
    color: String(g.colorId && COLORS[g.colorId] ? COLORS[g.colorId] : cal.color),
    title: m ? raw.slice(m[0].length) : raw,
    emoji: m ? m[1] : '',
    date,
    time,
    endDate,
    endTime,
    who: shared ? 'both' : owner,
    repeat: /FREQ=WEEKLY/.test(rule) ? 'weekly' : /FREQ=MONTHLY/.test(rule) ? 'monthly' : /FREQ=YEARLY/.test(rule) ? 'yearly' : 'none',
    recurringId: g.recurringEventId ?? null,
    note: String(g.description ?? ''),
    link: String(g.htmlLink ?? ''),
    // Only the organiser's copy can be changed (a guest's copy is read-only in Google).
    editable:
      cal.writable && (g.organizer?.self === true || g.organizer?.email === cal.id || (!g.organizer && g.creator?.self === true)) && !g.locked,
    uid: String(g.iCalUID ?? g.id),
  };
}

/** Google's event colours (when an event has its own colour instead of its calendar's). */
const COLORS: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73', '5': '#f6bf26', '6': '#f4511e',
  '7': '#039be5', '8': '#616161', '9': '#3f51b5', '10': '#0b8043', '11': '#d50000',
};

async function listCal(userId: string, cal: Cal, timeMin: string, timeMax: string) {
  const items: Record<string, any>[] = [];
  let page = '';
  for (let i = 0; i < 5; i++) {
    const q = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', ...(page ? { pageToken: page } : {}) });
    const r = await google(userId, 'GET', `${events(cal.id)}?${q}`);
    items.push(...((r?.items ?? []) as Record<string, any>[]));
    page = r?.nextPageToken ?? '';
    if (!page) break;
  }
  // The repeat rule lives on the series: fetch it so the app can show "Weekly" etc.
  const series = [...new Set(items.map((e) => e.recurringEventId).filter(Boolean))].slice(0, 20) as string[];
  const rules = new Map<string, string[]>();
  await Promise.all(series.map(async (id) => rules.set(id, ((await google(userId, 'GET', `${events(cal.id)}/${encodeURIComponent(id)}`).catch(() => null))?.recurrence ?? []) as string[])));
  return items.filter((e) => e.status !== 'cancelled').map((e) => ({ g: { ...e, recurrence: e.recurringEventId ? rules.get(e.recurringEventId) : e.recurrence }, cal }));
}

/** Events from all of a person's ticked calendars. */
async function listFor(userId: string, from: string, to: string, tz: string) {
  const timeMin = new Date(zonedToUtc(from, '00:00', tz)).toISOString();
  const timeMax = new Date(zonedToUtc(addDay(to, 1), '00:00', tz)).toISOString();
  const cals = await calendars(userId);
  const all = await Promise.all(cals.map((c) => listCal(userId, c, timeMin, timeMax).catch((e) => (console.error('calendar list failed', (e as Error).message), []))));
  return all.flat();
}

function toGoogle(e: Record<string, any>, tz: string, attendee: string | null) {
  const summary = `${e.emoji ? `${e.emoji} ` : ''}${String(e.title ?? '').trim()}`.slice(0, 200);
  const body: Record<string, unknown> = { summary, description: String(e.note ?? '').slice(0, 4000) };
  if (e.time) {
    const start = zonedToUtc(e.date, e.time, tz);
    const mins = Math.max(15, Math.min(24 * 60, Number(e.durationMin ?? 60)));
    body.start = { dateTime: new Date(start).toISOString(), timeZone: tz };
    body.end = { dateTime: new Date(start + mins * 60000).toISOString(), timeZone: tz };
  } else {
    body.start = { date: e.date };
    body.end = { date: addDay(e.date, 1) };
  }
  const rule = { weekly: 'RRULE:FREQ=WEEKLY', monthly: 'RRULE:FREQ=MONTHLY', yearly: 'RRULE:FREQ=YEARLY' }[e.repeat as string];
  body.recurrence = rule ? [rule] : [];
  if (attendee) body.attendees = [{ email: attendee }];
  return body;
}

// ---------------------------------------------------------------- requests

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const url = new URL(req.url);
  try {
    // Google sends the user back here after they allow access.
    if (req.method === 'GET' && url.pathname.endsWith('/callback')) {
      const back = (result: string) => Response.redirect(`${APP_URL}plan?google=${result}`, 302);
      const state = url.searchParams.get('state') ?? '';
      const code = url.searchParams.get('code');
      if (!code) return back('cancelled');
      const { data: st } = await db.from('google_oauth_states').select('user_id,created_at').eq('state', state).maybeSingle();
      await db.from('google_oauth_states').delete().eq('state', state);
      if (!st || Date.now() - Date.parse(st.created_at) > 20 * 60_000) return back('expired');
      const r = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT });
      if (!r.ok || !r.body.access_token) {
        console.error('code exchange failed', r.body.error);
        return back('error');
      }
      let email = '';
      try {
        email = JSON.parse(atob(String(r.body.id_token ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email ?? '';
      } catch {
        /* no email */
      }
      const { data: prev } = await db.from('google_tokens').select('refresh_token').eq('user_id', st.user_id).maybeSingle();
      const refresh = r.body.refresh_token || prev?.refresh_token;
      if (!refresh) return back('error');
      await db.from('google_tokens').upsert({ user_id: st.user_id, refresh_token: refresh, google_email: email, scope: r.body.scope ?? '', updated_at: new Date().toISOString() });
      calCache.delete(st.user_id);
      access.set(st.user_id, { token: r.body.access_token, until: Date.now() + (Number(r.body.expires_in ?? 3600) - 120) * 1000 });
      return back('connected');
    }

    if (req.method !== 'POST') return new Response('Not found', { status: 404, headers: cors });
    const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const { data } = auth ? await db.auth.getUser(auth) : { data: { user: null } };
    const user = data.user;
    if (!user) return json({ error: 'unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const tz = zone(body?.tz);
    const ppl = await people(user.id);

    if (action === 'status') {
      const mine = ppl.connected(user.id);
      const { data: tok } = mine ? await db.from('google_tokens').select('scope').eq('user_id', user.id).maybeSingle() : { data: null };
      const myCalendars = mine ? (await calendars(user.id).catch(() => [])).filter((c) => c.writable) : [];
      return json({
        configured: Boolean(CLIENT_ID && CLIENT_SECRET),
        mine,
        myEmail: ppl.email(user.id),
        partner: ppl.connected(ppl.partnerId),
        // Connected before the app could see all calendars: reconnect once to show them.
        needsReconnect: mine && !String(tok?.scope ?? '').includes(LIST_SCOPE),
        myCalendars,
      });
    }

    if (action === 'start') {
      if (!CLIENT_ID || !CLIENT_SECRET) throw new UserError('Google Calendar isn’t set up yet.');
      const state = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      await db.from('google_oauth_states').insert({ state, user_id: user.id });
      await db.from('google_oauth_states').delete().lt('created_at', new Date(Date.now() - 3600_000).toISOString());
      const q = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        login_hint: user.email ?? '',
        state,
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q}` });
    }

    if (action === 'disconnect') {
      const { data: tok } = await db.from('google_tokens').select('refresh_token').eq('user_id', user.id).maybeSingle();
      if (tok) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok.refresh_token)}`, { method: 'POST' }).catch(() => null);
      await db.from('google_tokens').delete().eq('user_id', user.id);
      access.delete(user.id);
      return json({ ok: true });
    }

    if (action === 'list') {
      const from = String(body.from ?? '');
      const to = String(body.to ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new UserError('bad range');
      const myEmail = ppl.email(user.id);
      const partnerEmail = ppl.email(ppl.partnerId ?? undefined);
      const out: AppEvent[] = [];
      const seen = new Set<string>();
      const failed: string[] = [];
      // Mine first: a "both" event lives in the organiser's calendar and also appears in the guest's.
      for (const id of [user.id, ppl.partnerId].filter((x): x is string => Boolean(x && ppl.connected(x)))) {
        try {
          for (const { g, cal } of await listFor(id, from, to, tz)) {
            const e = toApp(g, id, cal, ppl.partnerId, partnerEmail, myEmail, tz);
            const k = `${e.uid}|${e.date}|${e.time}`;
            if (seen.has(k)) {
              // The same event in both calendars: it's for both of you. Keep the organiser's copy,
              // which is the one that can be edited.
              const i = out.findIndex((x) => `${x.uid}|${x.date}|${x.time}` === k);
              if (i >= 0) out[i] = !out[i].editable && e.editable ? { ...e, who: 'both' } : { ...out[i], who: 'both' };
              continue;
            }
            seen.add(k);
            out.push(e);
          }
        } catch (e) {
          console.error('list failed for a person', (e as Error).message);
          failed.push(id);
        }
      }
      return json({ events: out, failed });
    }

    if (action === 'save') {
      const e = body.event ?? {};
      if (!String(e.title ?? '').trim()) throw new UserError('Give the event a name.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e.date))) throw new UserError('Pick a date.');
      if (e.time !== null && !/^\d{2}:\d{2}$/.test(String(e.time))) throw new UserError('Pick a time.');
      const who = String(e.who ?? 'both');
      // Which calendar: an existing event stays where it is; a new one goes to the person it's for.
      let owner = e.id ? String(e.owner) : who === 'both' ? user.id : who;
      if (owner !== user.id && owner !== ppl.partnerId) owner = user.id;
      if (!ppl.connected(owner)) {
        if (owner === user.id) throw new UserError('not-connected');
        throw new UserError('partner-not-connected');
      }
      const other = owner === user.id ? ppl.partnerId : user.id;
      const attendee = who === 'both' && other ? ppl.email(other) || null : null;
      const payload = toGoogle(e, tz, attendee);
      // Which of that person's calendars: the event's own, or (new) the one picked, else their main one.
      const cals = await calendars(owner);
      const wanted = String(e.calendarId ?? '');
      const cal = e.id ? wanted || 'primary' : owner === user.id && cals.some((c) => c.id === wanted && c.writable) ? wanted : 'primary';
      const target = e.id && e.series && e.recurringId ? String(e.recurringId) : e.id ? String(e.id) : null;
      if (target) {
        const patch = { ...payload };
        if (e.recurringId && !e.series) delete patch.recurrence; // one occurrence can't change the repeat
        await google(owner, 'PATCH', `${events(cal)}/${encodeURIComponent(target)}?sendUpdates=all`, patch);
      } else {
        await google(owner, 'POST', `${events(cal)}?sendUpdates=all`, payload);
      }
      return json({ ok: true });
    }

    if (action === 'delete') {
      const owner = String(body.owner ?? '');
      const id = String(body.series && body.recurringId ? body.recurringId : (body.id ?? ''));
      if (!id || (owner !== user.id && owner !== ppl.partnerId)) throw new UserError('bad event');
      await google(owner, 'DELETE', `${events(String(body.calendarId || 'primary'))}/${encodeURIComponent(id)}?sendUpdates=all`);
      return json({ ok: true });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    console.error('google error', (e as Error).message);
    return json({ error: 'Something went wrong talking to Google. Try again.' }, 500);
  }
});
