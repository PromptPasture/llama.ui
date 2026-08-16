import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import ImportExportTab from './ImportExportTab.svelte';

// Set the locale explicitly rather than going through initI18n(), which picks
// its initial locale from navigator.language and is not deterministic here.
beforeAll(async () => {
  register('en', () => import('../../lib/i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

function renderTab() {
  const result = render(ImportExportTab, { props: { onclose: () => {} } });
  const fileInput = result.container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  return { ...result, fileInput };
}

describe('ImportExportTab import control', () => {
  it('is a real button rather than a label wearing a button role', () => {
    renderTab();
    const button = screen.getByRole('button', { name: 'Import' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('opens the file picker when clicked', async () => {
    const user = userEvent.setup();
    const { fileInput } = renderTab();
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => {});

    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('opens the file picker from the keyboard with Enter', async () => {
    const user = userEvent.setup();
    const { fileInput } = renderTab();
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => {});

    screen.getByRole('button', { name: 'Import' }).focus();
    await user.keyboard('{Enter}');

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('opens the file picker from the keyboard with Space', async () => {
    const user = userEvent.setup();
    const { fileInput } = renderTab();
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => {});

    screen.getByRole('button', { name: 'Import' }).focus();
    await user.keyboard(' ');

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('is reachable by tabbing, alongside export', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Import' })).toHaveFocus();
  });

  it('keeps the file input itself out of the tab order', () => {
    const { fileInput } = renderTab();
    expect(fileInput).toHaveAttribute('hidden');
    expect(fileInput).toHaveAttribute('accept', '.json');
  });
});
