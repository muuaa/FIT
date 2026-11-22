// Replete: sends due reminders as web push notifications.
// Called every minute by pg_cron (header x-cron-secret), or by a signed-in user with {"test": true}
// to send themselves a test notification.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET')!;
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type Lang = 'en' | 'ar';
interface Reminder {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  times: string[];
  days: number[];
  smart: boolean;
  tz: string;
}
interface Sub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const TEXT: Record<Lang, Record<string, [string, string]>> = {
  en: {
    water: ['💧 Drink water', 'You’re at {ml} of {target} ml today.'],
    supplements: ['💊 Supplements', 'Still to take: {list}.'],
    weighin: ['⚖️ Morning weigh-in', 'Step on the scale before breakfast.'],
    workout: ['🏋️ Workout time', 'Today is {day} day. Let’s go!'],
    journal: ['📓 Journal', 'Write a few lines and 3 things you’re grateful for.'],
    bedtime: ['😴 Bedtime', 'Time to wind down for a good night’s sleep.'],
    habits: ['🎯 Habits', '{left} habit(s) left today.'],
    custom: ['🔔 Reminder', ''],
    test: ['✅ Notifications are on', 'This is how Replete reminders will look.'],
  },
  ar: {
    water: ['💧 اشرب الماء', 'شربت {ml} من {target} مل اليوم.'],
    supplements: ['💊 المكملات', 'متبقٍ: {list}.'],
    weighin: ['⚖️ وزن الصباح', 'قِس وزنك قبل الفطور.'],
    workout: ['🏋️ وقت التمرين', 'اليوم يوم {day}. يلا!'],
    journal: ['📓 اليوميات', 'اكتب بضعة أسطر و3 أشياء أنت ممتن لها.'],
    bedtime: ['😴 وقت النوم', 'حان وقت الاسترخاء لنوم جيد.'],
    habits: ['🎯 العادات', 'متبقٍ {left} عادة اليوم.'],
    custom: ['🔔 تذكير', ''],
    test: ['✅ الإشعارات مفعّلة', 'هكذا ستبدو تذكيرات Replete.'],
  },
};
const DAY: Record<Lang, Record<string, string>> = {
  en: { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower' },
  ar: { push: 'دفع', pull: 'سحب', legs: 'أرجل', upper: 'علوي', lower: 'سفلي' },
};
const SPLITS: Record<string, string[]> = { 'PPL-UL': ['push', 'pull', 'legs', 'upper', 'lower'], 'UL-PPL': ['upper', 'lower', 'push', 'pull', 'legs'] };
const TRAINING = [4, 5, 6, 1, 2];

function fill(s: string, v: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
}

/** Local date, time and weekday in a time zone, for `offsetMin` minutes ago. */
function localNow(tz: string, offsetMin = 0) {
  const d = new Date(Date.now() - offsetMin * 60_000);
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
  } catch {
    return localNow('UTC', offsetMin);
  }
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, wd };
}

/** The user's synced rows we need for "smart" skipping. */
async function userState(userId: string, date: string) {
  const { data, error } = await db
    .from('records')
    .select('tbl,row_id,data')
    .eq('user_id', userId)
    .eq('deleted', false)
    .in('tbl', ['profile', 'water_days', 'bodyweight_logs', 'journal', 'supplements', 'supplement_logs', 'workout_sessions', 'habits', 'habit_logs']);
  if (error) console.error('load state failed', error.message);
  const rows = data ?? [];
  const of = (t: string) => rows.filter((r) => r.tbl === t).map((r) => r.data as Record<string, unknown>);
  const profile = (of('profile')[0] ?? {}) as Record<string, unknown>;
  return {
    lang: (profile.language === 'ar' ? 'ar' : 'en') as Lang,
    split: String(profile.split_mode ?? 'PPL-UL'),
    waterTarget: Number(profile.water_target_ml ?? 4000),
    waterMl: Number(of('water_days').find((r) => r.date === date)?.ml ?? 0),
    weighed: of('bodyweight_logs').some((r) => r.date === date),
    journaled: of('journal').some((r) => r.date === date),
    worked: of('workout_sessions').some((r) => r.date === date && r.ended_at),
    suppsLeft: of('supplements')
      .filter((s) => s.active)
      .filter((s) => !of('supplement_logs').some((l) => l.supplement_id === s.id && l.date === date))
      .map((s) => String(s.name)),
    habitsLeft: of('habits').filter(
      (h) =>
        !h.archived &&
        (!(h.days as number[])?.length || (h.days as number[]).includes(new Date(`${date}T12:00:00Z`).getUTCDay())) &&
        !of('habit_logs').some((l) => l.habit_id === h.id && l.date === date),
    ).length,
  };
}

async function sendTo(userId: string, payload: Record<string, unknown>) {
  const { data: subs } = await db.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', userId);
  let sent = 0;
  for (const s of (subs ?? []) as Sub[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'normal' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id); // phone unsubscribed
      else console.error('push failed', code, (e as Error).message);
    }
  }
  return sent;
}

async function runDue() {
  const { data, error: loadError } = await db.from('reminders').select('id,user_id,kind,title,times,days,smart,tz').eq('enabled', true);
  if (loadError) throw new Error(`load reminders: ${loadError.message}`);
  let sent = 0;
  for (const r of (data ?? []) as Reminder[]) {
    // Look at this minute and the previous two, in case a scheduled run started late.
    for (const back of [0, 1, 2]) {
      const now = localNow(r.tz, back);
      if (!r.times.includes(now.time)) continue;
      const days = r.kind === 'workout' && !r.days.length ? TRAINING : r.days;
      if (days.length && !days.includes(now.wd)) continue;
      const slot = `${now.date} ${now.time}`;
      // Claim the slot first so overlapping runs can't double-send.
      const { error } = await db.from('reminder_sends').insert({ reminder_id: r.id, slot });
      if (error) {
        if (error.code !== '23505') console.error('claim slot failed', error.message); // 23505 = already sent
        continue;
      }
      const st = await userState(r.user_id, now.date);
      if (r.smart) {
        if (r.kind === 'water' && st.waterMl >= st.waterTarget) continue;
        if (r.kind === 'weighin' && st.weighed) continue;
        if (r.kind === 'journal' && st.journaled) continue;
        if (r.kind === 'workout' && st.worked) continue;
        if (r.kind === 'supplements' && st.suppsLeft.length === 0) continue;
        if (r.kind === 'habits' && st.habitsLeft === 0) continue;
      }
      const [title, body] = TEXT[st.lang][r.kind] ?? TEXT[st.lang].custom;
      const dayType = SPLITS[st.split]?.[TRAINING.indexOf(now.wd)];
      const vars = {
        ml: st.waterMl.toLocaleString('en-US'),
        target: st.waterTarget.toLocaleString('en-US'),
        list: st.suppsLeft.join(', '),
        day: dayType ? DAY[st.lang][dayType] : '',
        left: st.habitsLeft,
      };
      sent += await sendTo(r.user_id, {
        title: r.kind === 'custom' ? r.title || title : title,
        body: r.kind === 'custom' ? '' : fill(body, vars),
        tag: `replete-${r.kind}`,
        url: { water: '/FIT/fuel', supplements: '/FIT/', weighin: '/FIT/', workout: '/FIT/train', journal: '/FIT/life/journal', habits: '/FIT/life/habits' }[r.kind] ?? '/FIT/',
      });
      break;
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    if (req.headers.get('x-cron-secret') === CRON_SECRET) {
      const sent = await runDue();
      return Response.json({ ok: true, sent });
    }
    // A signed-in user asking for a test notification.
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const { data } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!data.user) return Response.json({ error: 'unauthorized' }, { status: 401, headers: cors });
    const st = await userState(data.user.id, localNow('UTC').date);
    const [title, body] = TEXT[st.lang].test;
    const sent = await sendTo(data.user.id, { title, body, tag: 'replete-test', url: '/FIT/settings/reminders' });
    return Response.json({ ok: true, sent }, { headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: (e as Error).message }, { status: 500, headers: cors });
  }
});
