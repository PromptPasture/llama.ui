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
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
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
    return [...screen.getAllByRole('listitem')].map((o) =>
      o.textContent?.trim()
    );
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

describe('the length at which a paste becomes an attachment', () => {
  it('can be changed', async () => {
    await locale.set('en');
    await waitLocale();
    render(UITab, { props });

    // The setting shipped with a default and a translation in every
    // catalogue, and no way at all to reach it.
    expect(screen.getByLabelText('Paste: limitation')).toBeInTheDocument();
  });

  it('shows the length it is currently set to', async () => {
    await locale.set('en');
    await waitLocale();
    render(UITab, { props });

    expect(screen.getByLabelText('Paste: limitation')).toHaveValue(
      String(CONFIG_DEFAULT.pasteLongTextToFileLen)
    );
  });
});

describe('where the keyboard shortcuts can be read', () => {
  async function shortcutsIn(tag: string) {
    await locale.set(tag);
    await waitLocale();
    const { container } = render(UITab, { props });
    const rows = container.querySelectorAll('.shortcuts__row');
    return [...rows].map((row) => ({
      keys: row.querySelector('.shortcuts__keys')?.textContent?.trim(),
      what: row.querySelector('.shortcuts__what')?.textContent?.trim(),
    }));
  }

  it('lists the ones the app answers to', async () => {
    const listed = await shortcutsIn('en');

    // The buttons name their own shortcut in a tooltip, which a keyboard or a
    // touchscreen never shows.
    expect(listed.map((s) => s.keys)).toEqual([
      'Ctrl+N',
      'Ctrl+K',
      'Ctrl+,',
      'Enter',
      'Shift+Enter',
      'Ctrl+Enter',
      'Escape',
    ]);
  });

  it('says what each of them does', async () => {
    const listed = await shortcutsIn('en');

    expect(listed[0].what).toBe('New conversation');
    expect(listed.every((s) => s.what)).toBe(true);
  });

  it("says it in the reader's language", async () => {
    const listed = await shortcutsIn('ru');

    // Hardcoded, this section would stay English inside an otherwise
    // translated settings screen.
    expect(listed[0].what).toBe('Новый разговор');
  });
});
