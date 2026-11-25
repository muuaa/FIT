/** Web push: ask permission, subscribe this device, and store the subscription for the server. */
import { t } from './i18n';
import { isStandalone } from './install';
import { supabase } from './supabase';

export const VAPID_PUBLIC_KEY = 'BG2av39pT1D3UAbeksM8hZeDUDf3866YWzfzcy29fViVF-B5V9jQ4JM4w2ZZCyfcCJn0xuHy9z1oXQDDssKe7Us';

// ---------------------------------------------------------------- native Android app (Firebase)

/** The Android app's own window (1.13+) gives the page a bridge to the phone. */
interface BTNativeBridge {
  ready(): void;
  fcmToken(): string;
  appVersion(): number;
  notificationStatus(): 'granted' | 'denied' | 'default';
  requestNotifications(): void;
  openNotificationSettings(): void;
  openExternal(url: string): void;
}
export function bridge(): BTNativeBridge | null {
  return (window as { BTNative?: BTNativeBridge }).BTNative ?? null;
}

/** Ask Android for permission to show notifications (answers through window.__btNotif). */
function askNative(b: BTNativeBridge): Promise<'granted' | 'denied' | 'default'> {
  return new Promise((resolve) => {
    (window as { __btNotif?: (s: string) => void }).__btNotif = (st: string) => resolve(st as 'granted' | 'denied' | 'default');
    b.requestNotifications();
    window.setTimeout(() => resolve(b.notificationStatus()), 60_000);
  });
}

const FCM_KEY = 'fit.fcmToken';
const NATIVE_KEY = 'fit.native';
const FCM_PREV_KEY = 'fit.fcmPrev';

/** The Android app opens the site with ?app=1&fcm=<token>; remember it and tidy the address. */
export function captureNativeLaunch() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('app')) return;
    sessionStorage.setItem(NATIVE_KEY, url.searchParams.get('app') || '1'); // the app's version
    const token = url.searchParams.get('fcm');
    const prev = localStorage.getItem(FCM_KEY);
    if (token && prev && prev !== token) localStorage.setItem(FCM_PREV_KEY, prev); // Firebase rotated it
    if (token) localStorage.setItem(FCM_KEY, token);
    // How the Android app's opening went (shown in Settings to help diagnose).
    const vt = url.searchParams.get('vt');
    if (vt !== null) sessionStorage.setItem('fit.openCheck', JSON.stringify({ ms: Number(vt), ok: Number(url.searchParams.get('vr') ?? -1) }));
    for (const k of ['app', 'fcm', 'vt', 'vr']) url.searchParams.delete(k);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    /* storage blocked: fall back to web push */
  }
}

/** Version of the Android app this page runs in (0 = a browser). */
export function nativeAppVersion(): number {
  const b = bridge();
  if (b) return b.appVersion();
  try {
    return Number(sessionStorage.getItem(NATIVE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Android app version and how long Chrome took to confirm the app (for Settings). */
export function appInfo(): { build: number; checkMs: number | null; checkOk: number | null } {
  let check: { ms: number; ok: number } | null = null;
  try {
    check = JSON.parse(sessionStorage.getItem('fit.openCheck') ?? 'null');
  } catch {
    /* none */
  }
  return { build: nativeAppVersion(), checkMs: check ? check.ms : null, checkOk: check ? check.ok : null };
}

/** The Android app (1.3+) can open its own notification settings for a blocked phone. */
export function canOpenNotificationSettings(): boolean {
  return Boolean(bridge()) || nativeAppVersion() >= 4;
}
export function openNotificationSettings(): void {
  const b = bridge();
  if (b) return b.openNotificationSettings();
  window.location.href = 'intent://notification-settings#Intent;scheme=bettertogether;package=io.github.muuaa.bettertogether;end';
}

/** Firebase token when running inside the Android app (null in a browser or the old app). */
function nativeToken(): string | null {
  const b = bridge();
  if (b) return b.fcmToken() || null;
  try {
    const native = Boolean(sessionStorage.getItem(NATIVE_KEY)) || document.referrer.startsWith('android-app://io.github.muuaa.bettertogether');
    return native ? localStorage.getItem(FCM_KEY) : null;
  } catch {
    return null;
  }
}

async function saveNative(token: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint: `fcm:${token}`, kind: 'fcm', fcm_token: token, p256dh: '', auth: '', user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  );
  if (error) return false;
  try {
    const prev = localStorage.getItem(FCM_PREV_KEY);
    if (prev) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', `fcm:${prev}`);
      localStorage.removeItem(FCM_PREV_KEY);
    }
  } catch {
    /* ignore */
  }
  // The app shows its own notifications now, so drop Chrome's copy on this phone to avoid doubles.
  const reg = await registration();
  const sub = await reg?.pushManager?.getSubscription();
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe().catch(() => undefined);
  }
  return true;
}

async function nativeSaved(token: string): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.from('push_subscriptions').select('id').eq('endpoint', `fcm:${token}`).maybeSingle();
  return Boolean(data);
}

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
  const nb = bridge();
  if (nb) {
    const st = nb.notificationStatus();
    if (st === 'denied') return 'blocked';
    const tok = nativeToken();
    return st === 'granted' && tok && (await nativeSaved(tok)) ? 'on' : 'off';
  }
  if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const token = nativeToken();
  if (token) return Notification.permission === 'granted' && (await nativeSaved(token)) ? 'on' : 'off';
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
  if (!supabase) throw new Error(t('Not signed in'));
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
  const nb = bridge();
  if (nb) {
    const st = nb.notificationStatus() === 'granted' ? 'granted' : await askNative(nb);
    if (st !== 'granted') return st === 'denied' ? 'blocked' : 'off';
    const tok = nativeToken();
    if (!tok) throw new Error(t('Still setting up notifications on this phone. Try again in a few seconds.'));
    if (!(await saveNative(tok))) throw new Error(t('Could not save'));
    return 'on';
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off';
  const token = nativeToken();
  if (token && (await saveNative(token))) return 'on';
  const reg = await registration();
  if (!reg) throw new Error(t('The app is still installing its offline files. Try again in a few seconds.'));
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  await save(reg, sub);
  return 'on';
}

export async function disablePush(): Promise<void> {
  const token = nativeToken();
  if (token) await supabase?.from('push_subscriptions').delete().eq('endpoint', `fcm:${token}`);
  if (bridge()) return;
  const reg = await registration();
  const sub = await reg?.pushManager?.getSubscription();
  if (!sub) return;
  await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/** Re-save this device's subscription (it can rotate); harmless if unchanged. */
export async function refreshPush(): Promise<void> {
  const nb = bridge();
  if (nb) {
    const tok = nativeToken();
    if (nb.notificationStatus() === 'granted' && tok) await saveNative(tok).catch(() => false);
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const token = nativeToken();
  if (token && (await saveNative(token).catch(() => false))) return;
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (reg && sub) await save(reg, sub).catch(() => undefined);
}

export async function sendTestPush(): Promise<number> {
  if (!supabase) throw new Error(t('Not signed in'));
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { test: true } });
  if (error) throw error;
  return (data as { sent?: number })?.sent ?? 0;
}

/** Send a quick notification to your partner. */
export async function sendNudge(text: string): Promise<number> {
  if (!supabase) throw new Error(t('Not signed in'));
  const { data, error } = await supabase.functions.invoke('send-reminders', { body: { nudge: text } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) throw new Error(t('Give it a few seconds before the next nudge.'));
    throw error;
  }
  return (data as { sent?: number })?.sent ?? 0;
}
