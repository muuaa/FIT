// Better Together <-> Google Calendar, without signing in to Google inside the app.
//
//  GET  ?feed=<token>                 Your shared Plan events as an .ics feed (Google Calendar
//                                     subscribes to it: "Add calendar from URL").
//  POST {action:'feed', tz}           (signed in) The household's feed address (created on first use).
//  POST {action:'link', url}          (signed in) Save your Google "secret address in iCal format";
//                                     checks it works first.
//  POST {action:'unlink'}             (signed in) Remove it.
//  POST {action:'status'}             (signed in) Whether you / your partner have linked Google.
//  POST {action:'events', from, to, tz}  (signed in) Google events of both of you in that range.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { buildIcs, occurrences, parseIcs, type FeedEvent } from './ics.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });

/** Google calendar files, cached briefly so opening Plan repeatedly doesn't refetch. */
const cache = new Map<string, { at: number; text: string }>();
async function fetchIcs(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.text;
  const res = await fetch(url, { headers: { Accept: 'text/calendar' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`calendar returned ${res.status}`);
  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('not a calendar');
  cache.set(url, { at: Date.now(), text });
  return text;
}

function allowedUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim().replace(/^webcal:/i, 'https:'));
    if (u.protocol !== 'https:') return null;
    if (!/(^|\.)google\.com$/.test(u.hostname) && !/(^|\.)googleusercontent\.com$/.test(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function householdFeed(token: string): Promise<Response> {
  const { data: feed } = await db.from('calendar_feeds').select('token,tz').eq('token', token).maybeSingle();
  if (!feed) return new Response('Not found', { status: 404, headers: cors });
  const { data: rows } = await db.from('household_records').select('data,updated_at').eq('tbl', 'events').eq('deleted', false).limit(2000);
  const events: FeedEvent[] = (rows ?? []).map((r) => {
    const e = r.data as Record<string, unknown>;
    return {
      id: String(e.id),
      title: String(e.title ?? ''),
      emoji: String(e.emoji ?? ''),
      date: String(e.date),
      time: (e.time as string | null) ?? null,
      repeat: (e.repeat as FeedEvent['repeat']) ?? 'none',
      note: String(e.note ?? ''),
      updated: String(r.updated_at ?? ''),
    };
  });
  return new Response(buildIcs(events, feed.tz, 'Better Together'), {
    headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const url = new URL(req.url);
  try {
    if (req.method === 'GET') {
      const token = url.searchParams.get('feed');
      if (!token || !/^[0-9a-f]{20,64}$/.test(token)) return new Response('Not found', { status: 404, headers: cors });
      return await householdFeed(token);
    }
    const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const { data } = auth ? await db.auth.getUser(auth) : { data: { user: null } };
    const user = data.user;
    if (!user) return json({ error: 'unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');

    if (action === 'feed') {
      const tz = typeof body.tz === 'string' && body.tz.length < 64 ? body.tz : 'Asia/Amman';
      let { data: feed } = await db.from('calendar_feeds').select('token').order('created_at').limit(1).maybeSingle();
      if (!feed) ({ data: feed } = await db.from('calendar_feeds').insert({ created_by: user.id, tz }).select('token').single());
      else await db.from('calendar_feeds').update({ tz }).eq('token', feed.token);
      return json({ url: `${SUPABASE_URL}/functions/v1/calendar?feed=${feed!.token}` });
    }

    if (action === 'link') {
      const clean = allowedUrl(String(body.url ?? ''));
      if (!clean) return json({ error: 'That isn’t a Google Calendar address. Copy the “Secret address in iCal format”.' }, 400);
      let count = 0;
      try {
        count = parseIcs(await fetchIcs(clean)).length;
      } catch {
        return json({ error: 'Couldn’t open that calendar. Check the address and try again.' }, 400);
      }
      const { error } = await db.from('calendar_links').upsert({ user_id: user.id, ics_url: clean, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true, count });
    }

    if (action === 'unlink') {
      await db.from('calendar_links').delete().eq('user_id', user.id);
      return json({ ok: true });
    }

    const { data: links } = await db.from('calendar_links').select('user_id,ics_url');
    if (action === 'status') {
      return json({ mine: Boolean(links?.some((l) => l.user_id === user.id)), partner: Boolean(links?.some((l) => l.user_id !== user.id)) });
    }

    if (action === 'events') {
      const from = String(body.from ?? '');
      const to = String(body.to ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return json({ error: 'bad range' }, 400);
      const tz = typeof body.tz === 'string' ? body.tz : 'Asia/Amman';
      const out: unknown[] = [];
      const failed: string[] = [];
      for (const l of links ?? []) {
        try {
          for (const o of occurrences(parseIcs(await fetchIcs(l.ics_url)), from, to, tz)) out.push({ ...o, who: l.user_id });
        } catch (e) {
          console.error('google calendar fetch failed', (e as Error).message);
          failed.push(l.user_id);
        }
      }
      return json({ events: out, failed });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    console.error('calendar error', (e as Error).message);
    return json({ error: 'Something went wrong' }, 500);
  }
});
