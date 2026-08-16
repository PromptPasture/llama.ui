import { render, screen } from '@testing-library/svelte';
import { init, locale, register, waitLocale } from 'svelte-i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import CONFIG_DEFAULT from '$lib/config/config-default.json';
import type { Configuration } from '$lib/types';

const { default: UITab } = await import('./UITab.svelte');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

const props = {
  config: CONFIG_DEFAULT as unknown as Configuration,
  onchange: () => vi.fn(),
};

/** The label the language field is showing as the current choice. */
async function shownLanguage(tag: string) {
  locale.set(tag);
  await waitLocale();
  render(UITab, { props });
  return screen.getByRole('button', { name: /Language/i }).textContent ?? '';
}

describe('the language the settings say you are using', () => {
  it('names the language for a plain tag', async () => {
    expect(await shownLanguage('de')).toContain('Deutsch');
  });

  it('names it for a tag carrying a region', async () => {
    // Browsers report 'de-DE', not 'de', and svelte-i18n keeps the tag it was
    // given — so matching the list directly left the field blank for almost
    // everyone who had never chosen a language.
    expect(await shownLanguage('de-DE')).toContain('Deutsch');
  });

  it('falls back to the language actually being displayed', async () => {
    // No zh-TW catalogue exists, so svelte-i18n serves English; saying so is
    // more honest than showing a language that is not on screen.
    expect(await shownLanguage('zh-TW')).toContain('English');
  });

  it('keeps a regional tag that is a language of its own', async () => {
    expect(await shownLanguage('zh-CN')).toContain('汉语');
  });
});
