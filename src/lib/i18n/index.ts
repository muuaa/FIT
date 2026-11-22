/**
 * Tiny i18n: strings are written in English in the code (`t('Log food')`), and looked up in the
 * Arabic dictionary when the language is Arabic. Missing entries fall back to English.
 * Placeholders: t('Logged {name}', { name }).
 */
import type { Language } from '@/types/db';
import { AR } from './ar';

let lang: Language = 'en';

export function setLanguage(l: Language): void {
  lang = l;
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  try {
    localStorage.setItem('fit.lang', l); // so the sign-in screen opens in the same language
  } catch {
    /* ignore */
  }
}

/** Apply the language used last time, before anything renders. */
export function restoreLanguage(): void {
  try {
    const l = localStorage.getItem('fit.lang');
    if (l === 'ar' || l === 'en') setLanguage(l);
  } catch {
    /* ignore */
  }
}

export function language(): Language {
  return lang;
}

export const isRTL = () => lang === 'ar';

/** Locale for dates and numbers. Arabic keeps Western digits, which is what most people in Jordan use in apps. */
export function locale(): string | undefined {
  return lang === 'ar' ? 'ar-JO-u-nu-latn' : undefined;
}

export function t(text: string, vars?: Record<string, string | number>): string {
  let out = lang === 'ar' ? (AR[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Plural helper: tn(n, '{n} set', '{n} sets'). Arabic plurals are approximated with 1 / 2 / 3–10 / 11+ forms when given. */
export function tn(n: number, one: string, many: string, vars?: Record<string, string | number>): string {
  return t(n === 1 ? one : many, { n: n.toLocaleString(locale()), ...vars });
}
