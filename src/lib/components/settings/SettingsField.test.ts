import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ConfigurationKey } from '$lib/types';

const { default: SettingsField } = await import('./SettingsField.svelte');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

/**
 * Every field here is named by a label beside it. Asking for the control *by
 * that name* is the same question a screen reader asks: without the tie
 * between them, the label is text on the page and the control is anonymous.
 */
describe('naming the control a settings field is for', () => {
  it('names a single-line field', () => {
    render(SettingsField, {
      props: {
        type: 'short',
        configKey: 'apiKey',
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(
      screen.getByRole('textbox', { name: 'API Key' })
    ).toBeInTheDocument();
  });

  it('names a multi-line field', () => {
    render(SettingsField, {
      props: {
        type: 'long',
        configKey: 'systemMessage',
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(
      screen.getByRole('textbox', { name: /System Message/ })
    ).toBeInTheDocument();
  });

  it('names a slider', () => {
    render(SettingsField, {
      props: {
        type: 'range',
        configKey: 'temperature',
        value: 1,
        range: { min: 0, max: 2, step: 0.1 },
        onchange: vi.fn(),
      },
    });

    expect(
      screen.getByRole('slider', { name: 'temperature' })
    ).toBeInTheDocument();
  });

  it('names a checkbox', () => {
    // This one already worked: its label wraps the control.
    render(SettingsField, {
      props: {
        type: 'checkbox',
        configKey: 'pdfAsImage',
        value: false,
        onchange: vi.fn(),
      },
    });

    expect(screen.getByRole('checkbox', { name: /PDF/i })).toBeInTheDocument();
  });
});

describe('clicking the label', () => {
  it('puts the cursor in the field it names', async () => {
    const user = userEvent.setup();
    render(SettingsField, {
      props: {
        type: 'short',
        configKey: 'apiKey',
        value: '',
        onchange: vi.fn(),
      },
    });

    await user.click(screen.getByText('API Key'));

    // The reason to tie them together, seen from the other side.
    expect(screen.getByRole('textbox', { name: 'API Key' })).toHaveFocus();
  });
});

describe('typing into a field', () => {
  it('reports what was typed', async () => {
    const user = userEvent.setup();
    const onchange = vi.fn();
    render(SettingsField, {
      props: { type: 'short', configKey: 'apiKey', value: '', onchange },
    });

    await user.type(screen.getByRole('textbox', { name: 'API Key' }), 'sk');

    expect(onchange).toHaveBeenLastCalledWith('sk');
  });
});

describe('a parameter with no translated label', () => {
  // Every sampler and penalty setting carries an empty string in all twelve
  // catalogues; svelte-i18n answers those with the `default`, which is the
  // config key. Pinned because the Advanced tab has nothing else to call
  // these fields by.
  it.each<ConfigurationKey>([
    'temperature',
    'top_k',
    'min_p',
    'repeat_penalty',
  ])('falls back to naming it %s', (configKey) => {
    render(SettingsField, {
      props: {
        type: 'range',
        configKey,
        value: 1,
        range: { min: 0, max: 2, step: 0.1 },
        onchange: vi.fn(),
      },
    });

    expect(screen.getByRole('slider', { name: configKey })).toBeInTheDocument();
  });

  it('prefers a real label when there is one', () => {
    render(SettingsField, {
      props: {
        type: 'short',
        configKey: 'apiKey',
        value: '',
        onchange: vi.fn(),
      },
    });

    expect(screen.queryByRole('textbox', { name: 'apiKey' })).toBeNull();
    expect(
      screen.getByRole('textbox', { name: 'API Key' })
    ).toBeInTheDocument();
  });
});
