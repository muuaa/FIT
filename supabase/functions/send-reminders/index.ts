// Better Together: sends due reminders as web push notifications.
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
    test: ['✅ Notifications are on', 'This is how Better Together reminders will look.'],
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
    test: ['✅ الإشعارات مفعّلة', 'هكذا ستبدو تذكيرات Better Together.'],
  },
};
const DAY: Record<Lang, Record<string, string>> = {
  en: { push: 'Push', pull: 'Pull', legs: 'Legs', upper: 'Upper', lower: 'Lower' },
  ar: { push: 'دفع', pull: 'سحب', legs: 'أرجل', upper: 'علوي', lower: 'سفلي' },
};
/** Partner activity notifications: text per language, where tapping goes, and a per-kind cooldown. */
const ACTIVITY: Record<string, { emoji: string; text: Record<Lang, string>; url: string; cooldownSec: number }> = {
  workout: { emoji: '🏋️', text: { en: 'Finished a {day} workout · {min} min', ar: 'أنهى تمرين {day} · {min} دقيقة' }, url: '/FIT/us', cooldownSec: 600 },
  habits: { emoji: '🔥', text: { en: 'Did all their habits today', ar: 'أنجز كل عاداته اليوم' }, url: '/FIT/us', cooldownSec: 3600 },
  event: { emoji: '📅', text: { en: 'Added “{title}” · {when}', ar: 'أضاف «{title}» · {when}' }, url: '/FIT/plan', cooldownSec: 30 },
  expense: { emoji: '💸', text: { en: 'Spent {amount} on {what}', ar: 'صرف {amount} على {what}' }, url: '/FIT/life/money', cooldownSec: 60 },
  bill: { emoji: '🧾', text: { en: 'Paid {what} · {amount}', ar: 'دفع {what} · {amount}' }, url: '/FIT/life/bills', cooldownSec: 30 },
  goal: { emoji: '🎯', text: { en: 'Goal reached: {title} 🎉', ar: 'تحقق الهدف: {title} 🎉' }, url: '/FIT/us', cooldownSec: 30 },
  chore: { emoji: '🧹', text: { en: 'Did {title} ✓', ar: 'أنجز {title} ✓' }, url: '/FIT/life/chores', cooldownSec: 60 },
  list: { emoji: '🛒', text: { en: 'Added {item} to {list}', ar: 'أضاف {item} إلى {list}' }, url: '/FIT/life/lists', cooldownSec: 120 },
  todo: { emoji: '✅', text: { en: 'Added a to-do: {title}', ar: 'أضاف مهمة: {title}' }, url: '/FIT/plan', cooldownSec: 60 },
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

/**
 * The user's synced rows we need for "smart" skipping. Day-specific tables are filtered to that
 * day in the query (Supabase returns at most 1000 rows per request, and logs pile up over time).
 */
async function userState(userId: string, date: string) {
  const base = () => db.from('records').select('tbl,row_id,data').eq('user_id', userId).eq('deleted', false);
  const [small, today] = await Promise.all([
    base().in('tbl', ['profile', 'supplements', 'habits']),
    base().in('tbl', ['water_days', 'bodyweight_logs', 'journal', 'supplement_logs', 'workout_sessions', 'habit_logs']).eq('data->>date', date),
  ]);
  for (const r of [small, today]) if (r.error) console.error('load state failed', r.error.message);
  const rows = [...(small.data ?? []), ...(today.data ?? [])];
  const of = (t: string) => rows.filter((r) => r.tbl === t).map((r) => r.data as Record<string, unknown>);
  const profile = (of('profile')[0] ?? {}) as Record<string, unknown>;
  const suppLogs = of('supplement_logs');
  const habitLogs = of('habit_logs');
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  return {
    lang: (profile.language === 'ar' ? 'ar' : 'en') as Lang,
    split: String(profile.split_mode ?? 'PPL-UL'),
    waterTarget: Number(profile.water_target_ml ?? 4000),
    waterMl: Number(of('water_days')[0]?.ml ?? 0),
    weighed: of('bodyweight_logs').length > 0,
    journaled: of('journal').length > 0,
    worked: of('workout_sessions').some((r) => r.ended_at),
    suppsLeft: of('supplements')
      .filter((s) => s.active && !suppLogs.some((l) => l.supplement_id === s.id))
      .map((s) => String(s.name)),
    habitsLeft: of('habits').filter(
      (h) =>
        !h.archived &&
        (!(h.days as number[])?.length || (h.days as number[]).includes(wd)) &&
        !habitLogs.some((l) => l.habit_id === h.id),
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
    // A signed-in user: a test notification, or a nudge to their partner.
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const { data } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!data.user) return Response.json({ error: 'unauthorized' }, { status: 401, headers: cors });
    const reqBody = await req.json().catch(() => ({}));
    if (reqBody?.activity) {
      // Something the user did that their partner may want to hear about.
      const kind = String(reqBody.activity.kind ?? '');
      const params = (reqBody.activity.params ?? {}) as Record<string, string | number>;
      const spec = ACTIVITY[kind];
      if (!spec) return Response.json({ error: 'unknown kind' }, { status: 400, headers: cors });
      const { data: recent } = await db
        .from('nudge_log')
        .select('id')
        .eq('from_user', data.user.id)
        .eq('text', `activity:${kind}`)
        .gt('created_at', new Date(Date.now() - spec.cooldownSec * 1000).toISOString())
        .limit(1);
      if (recent?.length) return Response.json({ ok: true, sent: 0, reason: 'cooldown' }, { headers: cors });
      await db.from('nudge_log').insert({ from_user: data.user.id, text: `activity:${kind}` });
      const { data: users } = await db.auth.admin.listUsers({ perPage: 10 });
      const partner = users?.users.find((u) => u.id !== data.user!.id);
      if (!partner) return Response.json({ ok: true, sent: 0, reason: 'no partner' }, { headers: cors });
      const { data: profs } = await db.from('records').select('user_id,data').eq('tbl', 'profile').in('user_id', [data.user.id, partner.id]);
      const mine = (profs?.find((r) => r.user_id === data.user!.id)?.data ?? {}) as Record<string, unknown>;
      const theirs = (profs?.find((r) => r.user_id === partner.id)?.data ?? {}) as Record<string, unknown>;
      const prefs = (theirs.activity_prefs ?? {}) as Record<string, boolean>;
      if (prefs[kind] === false) return Response.json({ ok: true, sent: 0, reason: 'muted' }, { headers: cors });
      const lang: Lang = theirs.language === 'ar' ? 'ar' : 'en';
      const name = String(mine.display_name ?? '').trim() || (data.user.email ?? '').split('@')[0];
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) clean[k] = String(v).slice(0, 80);
      if (kind === 'workout' && clean.day) clean.day = DAY[lang][clean.day] ?? clean.day;
      const sent = await sendTo(partner.id, {
        title: `${spec.emoji} ${name}`,
        body: fill(spec.text[lang], clean),
        tag: `activity-${kind}`,
        url: spec.url,
      });
      return Response.json({ ok: true, sent }, { headers: cors });
    }
    if (reqBody?.nudge) {
      const text = String(reqBody.nudge).trim().slice(0, 120);
      if (!text) return Response.json({ error: 'empty' }, { status: 400, headers: cors });
      // At most one nudge every 15 seconds per person.
      const { data: recent } = await db
        .from('nudge_log')
        .select('id')
        .eq('from_user', data.user.id)
        .gt('created_at', new Date(Date.now() - 15_000).toISOString())
        .limit(1);
      if (recent?.length) return Response.json({ error: 'slow down' }, { status: 429, headers: cors });
      await db.from('nudge_log').insert({ from_user: data.user.id, text });
      // The app is limited to two accounts: the partner is the other one.
      const { data: users } = await db.auth.admin.listUsers({ perPage: 10 });
      const partner = users?.users.find((u) => u.id !== data.user!.id);
      if (!partner) return Response.json({ ok: true, sent: 0, reason: 'no partner' }, { headers: cors });
      const { data: prof } = await db.from('records').select('data').eq('user_id', data.user.id).eq('tbl', 'profile').maybeSingle();
      const name = String((prof?.data as { display_name?: string })?.display_name ?? '').trim() || (data.user.email ?? '').split('@')[0];
      const sent = await sendTo(partner.id, { title: `💌 ${name}`, body: text, tag: `nudge-${Date.now()}`, url: '/FIT/us' });
      return Response.json({ ok: true, sent }, { headers: cors });
    }
    const st = await userState(data.user.id, localNow('UTC').date);
    const [title, body] = TEXT[st.lang].test;
    const sent = await sendTo(data.user.id, { title, body, tag: 'replete-test', url: '/FIT/settings/reminders' });
    return Response.json({ ok: true, sent }, { headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: (e as Error).message }, { status: 500, headers: cors });
  }
});
