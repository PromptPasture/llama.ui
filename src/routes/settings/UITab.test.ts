import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, locale, register, waitLocale } from 'svelte-i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import CONFIG_DEFAULT from '$lib/config/config-default.json';
import type { Configuration } from '$lib/types';

const { default: UITab } = await import('./UITab.svelte');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  register('de', () => import('$lib/i18n/de.json'));
  register('ru', () => import('$lib/i18n/ru.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

const props = {
  config: CONFIG_DEFAULT as unknown as Configuration,
  onchange: () => vi.fn(),
};

/** The label the language field is showing as the current choice. */
async function shownLanguage(tag: string) {
  await locale.set(tag);
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

describe('naming the fields on the interface tab', () => {
  /** The wording beside a field, which is what the reader reads. */
  async function labels(tag: string) {
    await locale.set(tag);
    await waitLocale();
    const { container } = render(UITab, { props });
    return [...container.querySelectorAll('.settings-dropdown__label')].map(
      (el) => el.textContent
    );
  }

  it('names the theme field, rather than showing the setting it changes', async () => {
    // The translation lived under a key the field never looked at, so the
    // field showed its own config key instead: a lowercase 'theme'.
    expect(await labels('en')).toEqual(['Language', 'Theme']);
  });

  it("names it in the reader's language", async () => {
    // Russian rather than German, whose word for it is also 'Theme'.
    expect(await labels('ru')).toEqual(['Язык', 'Тема']);
  });
});

describe('the wording of the theme choices', () => {
  /** The theme field is the second of the two on this tab. */
  async function themeOptions(tag: string) {
    await locale.set(tag);
    await waitLocale();
    const user = userEvent.setup();
    const { container } = render(UITab, { props });
    const fields = container.querySelectorAll('.settings-dropdown');
    const trigger = fields[1].querySelector('button');
    if (!trigger) throw new Error('the theme field has no control');
    await user.click(trigger);
    return [...screen.getAllByRole('option')].map((o) => o.textContent?.trim());
  }

  it('names them in English', async () => {
    expect(await themeOptions('en')).toEqual(['System', 'Light', 'Dark']);
  });

  it("names them in the reader's language", async () => {
    // Hardcoded, these three stayed English inside an otherwise translated
    // settings screen.
    expect(await themeOptions('ru')).toEqual([
      'Системная',
      'Светлая',
      'Тёмная',
    ]);
  });
});
