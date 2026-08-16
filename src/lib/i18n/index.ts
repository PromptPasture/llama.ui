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

export function initI18n(): void {
  if (!browser) {
    init({ fallbackLocale: 'en', initialLocale: 'en' });
    return;
  }

  // A language chosen in the settings outranks the browser's own, which is
  // only the starting guess for someone who has never chosen one.
  const chosen = LocalStorage.getLanguage() ?? window.navigator.language;
  init({ fallbackLocale: 'en', initialLocale: chosen });
  // Screen readers and hyphenation read this, and app.html can only hard-code
  // one value.
  document.documentElement.setAttribute('lang', chosen);
}
