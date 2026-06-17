import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';

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
  init({
    fallbackLocale: 'en',
    initialLocale: browser ? window.navigator.language : 'en',
  });
}
