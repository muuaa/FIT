/** Web push: ask permission, subscribe this device, and store the subscription for the server. */
import { t } from './i18n';
import { isStandalone } from './install';
import { supabase } from './supabase';

export const VAPID_PUBLIC_KEY = 'BG2av39pT1D3UAbeksM8hZeDUDf3866YWzfzcy29fViVF-B5V9jQ4JM4w2ZZCyfcCJn0xuHy9z1oXQDDssKe7Us';

export type PushStatus = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;
  // Subscribing needs an active worker; on first visit or right after an update it may still be installing.
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 8000))]);
}

export async function pushStatus(): Promise<PushStatus> {
  // iPhone/iPad only allow web notifications for apps added to the Home Screen.
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub || Notification.permission !== 'granted') return 'off';
  // RLS only shows our own rows: a subscription stored for another account counts as off here.
  return (await savedForMe(sub)) ? 'on' : 'off';
}

async function upsertSub(sub: PushSubscription) {
  const j = sub.toJSON();
  return supabase!.from('push_subscriptions').upsert(
    { endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '', user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  );
}

/**
 * Store this phone's subscription for the signed-in account. If the endpoint is still registered to
 * another account (someone else used this phone before), start a fresh subscription for this one.
 */
async function save(reg: ServiceWorkerRegistration, sub: PushSubscription): Promise<PushSubscription> {
  if (!supabase) throw new Error('Not signed in');
  const { error } = await upsertSub(sub);
  if (!error) return sub;
  await sub.unsubscribe().catch(() => undefined);
  const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const retry = await upsertSub(fresh);
  if (retry.error) throw retry.error;
  return fresh;
}

/** Is this phone's subscription stored for the signed-in account? */
async function savedForMe(sub: PushSubscription): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.from('push_subscriptions').select('id').eq('endpoint', sub.endpoint).maybeSingle();
  return Boolean(data);
}

/** Must be called from a tap (browsers only show the permission prompt for a user gesture). */
export async function enablePush(): Promise<PushStatus> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off';
  const reg = await registration();
  if (!reg) throw new Error(t('The app is still installing its offline files. Try again in a few seconds.'));
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  await save(reg, sub);
  return 'on';
}

export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/** Re-save this device's subscription (it can rotate); harmless if unchanged. */
export async function refreshPush(): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (reg && sub) await save(reg, sub).catch(() => undefined);
}

export async function sendTestPush(): Promise<number> {
  if (!supabase) throw new Error('Not signed in');
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { test: true } });
  if (error) throw error;
  return (data as { sent?: number })?.sent ?? 0;
}

/** Send a quick notification to your partner. */
export async function sendNudge(text: string): Promise<number> {
  if (!supabase) throw new Error('Not signed in');
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { nudge: text } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new Error(t('Give it a few seconds before the next nudge.'));
    throw error;
  }
  return (data as { sent?: number })?.sent ?? 0;
}
