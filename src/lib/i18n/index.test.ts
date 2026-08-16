import { get } from 'svelte/store';
import { locale } from 'svelte-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/environment', () => ({ browser: true }));

const { initI18n } = await import('./index');

function browserAsks(language: string) {
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(language);
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('lang');
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
