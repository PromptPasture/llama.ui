import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, locale, register, waitLocale } from 'svelte-i18n';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import SettingsTabs from './SettingsTabs.svelte';

// Set the locale explicitly rather than through initI18n(), which picks its
// initial locale from navigator.language and is not deterministic here.
beforeAll(async () => {
  register('en', () => import('../../lib/i18n/en.json'));
  register('ru', () => import('$lib/i18n/ru.json'));
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

// Labels use keys that are absent from the catalogue, so the `default` is what
// renders and the accessible names stay fixed.
const tabs = [
  { id: 'alpha', label: 'test.absent.alpha', default: 'Alpha' },
  { id: 'beta', label: 'test.absent.beta', default: 'Beta' },
  { id: 'gamma', label: 'test.absent.gamma', default: 'Gamma' },
];

const renderTabs = (selected = 'alpha') =>
  render(SettingsTabs, { props: { tabs, selected } });

const tab = (name: string) => screen.getByRole('tab', { name });

describe('SettingsTabs structure', () => {
  it('exposes a labelled tablist holding every tab', () => {
    renderTabs();
    expect(
      screen.getByRole('tablist', { name: 'Settings sections' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('marks only the selected tab as selected', () => {
    renderTabs('beta');
    expect(tab('Alpha')).toHaveAttribute('aria-selected', 'false');
    expect(tab('Beta')).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps only the selected tab in the tab order', () => {
    renderTabs('beta');
    expect(tab('Alpha')).toHaveAttribute('tabindex', '-1');
    expect(tab('Beta')).toHaveAttribute('tabindex', '0');
    expect(tab('Gamma')).toHaveAttribute('tabindex', '-1');
  });

  it('points each tab at the panel it controls', () => {
    renderTabs();
    expect(tab('Alpha')).toHaveAttribute(
      'aria-controls',
      'settings-panel-alpha'
    );
    expect(tab('Alpha')).toHaveAttribute('id', 'settings-tab-alpha');
  });
});

describe('SettingsTabs keyboard navigation', () => {
  it('moves to the next tab on ArrowRight, taking focus with it', async () => {
    const user = userEvent.setup();
    renderTabs('alpha');

    tab('Alpha').focus();
    await user.keyboard('{ArrowRight}');

    expect(tab('Beta')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Beta')).toHaveFocus();
  });

  it('moves to the previous tab on ArrowLeft', async () => {
    const user = userEvent.setup();
    renderTabs('gamma');

    tab('Gamma').focus();
    await user.keyboard('{ArrowLeft}');

    expect(tab('Beta')).toHaveFocus();
  });

  it('treats ArrowDown and ArrowUp the same way, for the vertical layout', async () => {
    const user = userEvent.setup();
    renderTabs('alpha');

    tab('Alpha').focus();
    await user.keyboard('{ArrowDown}');
    expect(tab('Beta')).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(tab('Alpha')).toHaveFocus();
  });

  it('wraps from the last tab forward to the first', async () => {
    const user = userEvent.setup();
    renderTabs('gamma');

    tab('Gamma').focus();
    await user.keyboard('{ArrowRight}');

    expect(tab('Alpha')).toHaveFocus();
  });

  it('wraps from the first tab backward to the last', async () => {
    const user = userEvent.setup();
    renderTabs('alpha');

    tab('Alpha').focus();
    await user.keyboard('{ArrowLeft}');

    expect(tab('Gamma')).toHaveFocus();
  });

  it('jumps to the first tab on Home and the last on End', async () => {
    const user = userEvent.setup();
    renderTabs('beta');

    tab('Beta').focus();
    await user.keyboard('{End}');
    expect(tab('Gamma')).toHaveFocus();

    await user.keyboard('{Home}');
    expect(tab('Alpha')).toHaveFocus();
  });

  it('ignores keys that are not navigation keys', async () => {
    const user = userEvent.setup();
    renderTabs('alpha');

    tab('Alpha').focus();
    await user.keyboard('x');

    expect(tab('Alpha')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Alpha')).toHaveFocus();
  });

  it('selects a tab when it is clicked', async () => {
    const user = userEvent.setup();
    renderTabs('alpha');

    await user.click(tab('Gamma'));

    expect(tab('Gamma')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Alpha')).toHaveAttribute('aria-selected', 'false');
  });
});

describe('the name of the tab strip', () => {
  it('is in the language being read', async () => {
    await locale.set('ru');
    await waitLocale();
    renderTabs('alpha');

    // Written into the markup, this stayed English for every reader.
    expect(
      screen.getByRole('tablist', { name: 'Разделы настроек' })
    ).toBeInTheDocument();

    await locale.set('en');
    await waitLocale();
  });
});

describe('the arrow keys when the layout is turned round', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('dir');
  });

  async function pressOn(name: string, key: string) {
    const user = userEvent.setup();
    renderTabs('beta');
    tab(name).focus();
    await user.keyboard(`{${key}}`);
    return document.activeElement;
  }

  it('goes towards the first tab on Right, which in Arabic is rightmost', async () => {
    document.documentElement.dir = 'rtl';

    const focused = await pressOn('Beta', 'ArrowRight');

    // The strip runs right to left, so moving the eye rightward is moving
    // back along it. Pressing Right used to move the other way.
    expect(focused).toBe(tab('Alpha'));
  });

  it('goes onwards on Left when the layout is turned round', async () => {
    document.documentElement.dir = 'rtl';

    const focused = await pressOn('Beta', 'ArrowLeft');

    expect(focused).toBe(tab('Gamma'));
  });

  it('leaves Right going onwards when it is not', async () => {
    document.documentElement.dir = 'ltr';

    const focused = await pressOn('Beta', 'ArrowRight');

    expect(focused).toBe(tab('Gamma'));
  });

  it('leaves Down going onwards whichever way the text runs', async () => {
    document.documentElement.dir = 'rtl';

    const focused = await pressOn('Beta', 'ArrowDown');

    // On a wide window the strip is a column; turning the text round does not
    // turn a column upside down.
    expect(focused).toBe(tab('Gamma'));
  });

  it('leaves Up going back whichever way the text runs', async () => {
    document.documentElement.dir = 'rtl';

    const focused = await pressOn('Beta', 'ArrowUp');

    expect(focused).toBe(tab('Alpha'));
  });
});
