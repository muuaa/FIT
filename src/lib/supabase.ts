import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Public project settings. The publishable key is designed to ship in browser code: what a
 * signed-in user can touch is enforced by Row Level Security in the database.
 * Override with VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY for another project.
 */
const PROJECT_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://kpppglfhwbcztcfhopcz.supabase.co';
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_j03ypo-DaeRdoxUK9UYOTg_ByOHr2Sf';

/**
 * Accounts + cloud sync are on by default. VITE_CLOUD=0 builds (and single-file preview builds)
 * run fully on-device with no account.
 */
export const cloudEnabled =
  import.meta.env.VITE_CLOUD !== '0' && !import.meta.env.VITE_EMBEDDED && Boolean(PROJECT_URL && PUBLISHABLE_KEY);

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(PROJECT_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'fit.auth' },
    })
  : null;

/** Where links in Supabase emails (confirm, reset password) should land: this app's own address. */
export function appUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}
