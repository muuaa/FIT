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
const REDIRECT = `${SUPABASE_URL}/functions/v1/google/callback`;
const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

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

async function google(userId: string, method: string, path: string, body?: unknown) {
  const token = await accessToken(userId);
  if (!token) throw new UserError('not-connected');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('google api', method, res.status, JSON.stringify(out).slice(0, 300));
    if (res.status === 404 || res.status === 410) throw new UserError('That event no longer exists in Google Calendar.');
    if (res.status === 403) throw new UserError('Google didn’t allow that change (you may not own this event).');
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

// ---------------------------------------------------------------- events

const EMOJI_AT_START = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*️?)\s+/u;

interface AppEvent {
  id: string;
  owner: string; // whose calendar it lives in
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

function toApp(g: Record<string, any>, owner: string, partnerId: string | null, partnerEmail: string, myEmail: string, tz: string): AppEvent {
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
    editable: (g.organizer?.self === true || (!g.organizer && g.creator?.self === true)) && !g.locked,
    uid: String(g.iCalUID ?? g.id),
  };
}

async function listFor(userId: string, from: string, to: string, tz: string) {
  const timeMin = new Date(zonedToUtc(from, '00:00', tz)).toISOString();
  const timeMax = new Date(zonedToUtc(addDay(to, 1), '00:00', tz)).toISOString();
  const items: Record<string, any>[] = [];
  let page = '';
  for (let i = 0; i < 5; i++) {
    const q = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', ...(page ? { pageToken: page } : {}) });
    const r = await google(userId, 'GET', `?${q}`);
    items.push(...((r?.items ?? []) as Record<string, any>[]));
    page = r?.nextPageToken ?? '';
    if (!page) break;
  }
  // Repeat rule lives on the series: fetch it for repeating events so the app can show "Weekly" etc.
  const series = [...new Set(items.map((e) => e.recurringEventId).filter(Boolean))].slice(0, 30) as string[];
  const rules = new Map<string, string[]>();
  await Promise.all(series.map(async (id) => rules.set(id, ((await google(userId, 'GET', `/${encodeURIComponent(id)}`).catch(() => null))?.recurrence ?? []) as string[])));
  return items.filter((e) => e.status !== 'cancelled').map((e) => ({ ...e, recurrence: e.recurringEventId ? rules.get(e.recurringEventId) : e.recurrence }));
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
      return json({ configured: Boolean(CLIENT_ID && CLIENT_SECRET), mine: ppl.connected(user.id), myEmail: ppl.email(user.id), partner: ppl.connected(ppl.partnerId) });
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
          for (const g of await listFor(id, from, to, tz)) {
            const e = toApp(g, id, ppl.partnerId, partnerEmail, myEmail, tz);
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
      const target = e.id && e.series && e.recurringId ? String(e.recurringId) : e.id ? String(e.id) : null;
      if (target) {
        const patch = { ...payload };
        if (e.recurringId && !e.series) delete patch.recurrence; // one occurrence can't change the repeat
        await google(owner, 'PATCH', `/${encodeURIComponent(target)}?sendUpdates=all`, patch);
      } else {
        await google(owner, 'POST', `?sendUpdates=all`, payload);
      }
      return json({ ok: true });
    }

    if (action === 'delete') {
      const owner = String(body.owner ?? '');
      const id = String(body.series && body.recurringId ? body.recurringId : (body.id ?? ''));
      if (!id || (owner !== user.id && owner !== ppl.partnerId)) throw new UserError('bad event');
      await google(owner, 'DELETE', `/${encodeURIComponent(id)}?sendUpdates=all`);
      return json({ ok: true });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    console.error('google error', (e as Error).message);
    return json({ error: 'Something went wrong talking to Google. Try again.' }, 500);
  }
});
