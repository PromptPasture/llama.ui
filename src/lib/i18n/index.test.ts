import { get } from 'svelte/store';
import { locale } from 'svelte-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

const { directionOf, initI18n } = await import('./index');

function browserAsks(language: string) {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language);
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
});

/** init() only applies the locale once its catalogue has been loaded. */
const settledOn = (tag: string) =>
  vi.waitFor(() => expect(get(locale)).toBe(tag));

describe('choosing the language to start in', () => {
  it('follows the browser when nothing has been chosen', async () => {
    browserAsks('de');

    initI18n();

    await settledOn('de');
  });

  it('prefers the language chosen in the settings', async () => {
    browserAsks('de');
    localStorage.setItem('language', 'ja');

    initI18n();

    // Without this the picker in the settings only lasts until the next
    // reload, which then silently reverts to the browser's language.
    await settledOn('ja');
  });

  it('marks the document so screen readers follow', () => {
    localStorage.setItem('language', 'ja');

    initI18n();

    // app.html can only hard-code one value, and hard-codes 'en'.
    expect(document.documentElement.getAttribute('lang')).toBe('ja');
  });
});

describe('which way a language reads', () => {
  it('is right to left for Arabic', () => {
    expect(directionOf('ar')).toBe('rtl');
    expect(directionOf('ar-EG')).toBe('rtl');
  });

  it('is right to left for the others written that way', () => {
    // None ship today; the check is on the language so that adding one needs
    // nothing here.
    for (const tag of ['he', 'fa', 'ur-PK']) {
      expect(directionOf(tag)).toBe('rtl');
    }
  });

  it('is left to right for everything else', () => {
    for (const tag of ['en', 'de', 'ja', 'zh-CN', 'ru']) {
      expect(directionOf(tag)).toBe('ltr');
    }
  });
});

describe('telling the document which way it reads', () => {
  it('turns the layout round for a right-to-left language', () => {
    localStorage.setItem('language', 'ar');

    initI18n();

    // Without this the sidebar stays on the left, every row of controls keeps
    // its left-to-right order, and the words run the other way inside them.
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
  });

  it('leaves it alone for a left-to-right one', () => {
    localStorage.setItem('language', 'de');

    initI18n();

    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });
});
