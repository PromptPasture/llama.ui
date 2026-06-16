import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';

const locales = [
  'ar',
  'de',
  'en',
  'es',
  'fr',
  'hi',
  'it',
  'ja',
  'ko',
  'pt',
  'ru',
  'zh-CN',
];

for (const locale of locales) {
  register(locale, () => import(`./${locale}.json`));
}

export function initI18n(): void {
  init({
    fallbackLocale: 'en',
    initialLocale: browser ? window.navigator.language : 'en',
  });
}
