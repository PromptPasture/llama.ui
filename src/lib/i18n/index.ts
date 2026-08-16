import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';
import LocalStorage from '$lib/database/localStorage';

register('ar', () => import('./ar.json'));
register('de', () => import('./de.json'));
register('en', () => import('./en.json'));
register('es', () => import('./es.json'));
register('fr', () => import('./fr.json'));
register('hi', () => import('./hi.json'));
register('it', () => import('./it.json'));
register('ja', () => import('./ja.json'));
register('ko', () => import('./ko.json'));
register('pt', () => import('./pt.json'));
register('ru', () => import('./ru.json'));
register('zh-CN', () => import('./zh-CN.json'));

/**
 * Languages written from the right. Only Arabic ships today, but the check is
 * on the language rather than a list of catalogues, so adding Hebrew, Persian
 * or Urdu needs nothing here.
 */
const RIGHT_TO_LEFT = new Set(['ar', 'he', 'fa', 'ur', 'yi', 'ps']);

/**
 * Which way round a language reads.
 *
 * @param locale - A language tag, with or without a region
 * @returns 'rtl' for a right-to-left language, 'ltr' otherwise
 */
export function directionOf(locale: string): 'rtl' | 'ltr' {
  const base = locale.toLowerCase().split('-')[0];
  return RIGHT_TO_LEFT.has(base) ? 'rtl' : 'ltr';
}

/**
 * Tells the document what language it is in, and which way it reads.
 *
 * Without the direction the interface stays laid out left to right while the
 * words run right to left: the sidebar on the wrong side, every row of
 * controls in the wrong order, and text pushed to the wrong edge.
 *
 * @param locale - The language now in use
 */
export function applyLocaleToDocument(locale: string): void {
  document.documentElement.setAttribute('lang', locale);
  document.documentElement.setAttribute('dir', directionOf(locale));
}

export function initI18n(): void {
  if (!browser) {
    init({ fallbackLocale: 'en', initialLocale: 'en' });
    return;
  }

  // A language chosen in the settings outranks the browser's own, which is
  // only the starting guess for someone who has never chosen one.
  const chosen = LocalStorage.getLanguage() ?? window.navigator.language;
  init({ fallbackLocale: 'en', initialLocale: chosen });
  // Screen readers and hyphenation read the language, and the layout follows
  // the direction. app.html can only hard-code one of each.
  applyLocaleToDocument(chosen);
}
