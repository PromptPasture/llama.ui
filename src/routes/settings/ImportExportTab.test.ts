import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importDB: vi.fn().mockResolvedValue(undefined),
  exportDB: vi.fn().mockResolvedValue([]),
}));

vi.mock('$lib/state/app.svelte', () => ({ app: mocks }));

const { default: ImportExportTab } = await import('./ImportExportTab.svelte');

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

  it('clears the input so a rejected file can be chosen again', async () => {
    const user = userEvent.setup();
    mocks.importDB.mockRejectedValueOnce(new Error('not a llama.ui export'));
    const { fileInput } = renderTab();

    await user.upload(
      fileInput,
      new File(['nonsense'], 'wrong.json', { type: 'application/json' })
    );

    // Selecting an unchanged value fires no change event, so without this the
    // user cannot retry the same file after fixing it.
    expect(mocks.importDB).toHaveBeenCalled();
    expect(fileInput.value).toBe('');
  });

  it('clears the input after a successful import too', async () => {
    const user = userEvent.setup();
    mocks.importDB.mockResolvedValueOnce(undefined);
    const { fileInput } = renderTab();

    await user.upload(
      fileInput,
      new File(['[]'], 'db.json', { type: 'application/json' })
    );

    expect(fileInput.value).toBe('');
  });

  it('does not close the settings screen when the import fails', async () => {
    const user = userEvent.setup();
    mocks.importDB.mockRejectedValueOnce(new Error('malformed conversation'));
    const onclose = vi.fn();
    const { container } = render(ImportExportTab, { props: { onclose } });
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    await user.upload(
      input,
      new File(['{}'], 'bad.json', { type: 'application/json' })
    );

    expect(onclose).not.toHaveBeenCalled();
  });

  it('keeps the file input itself out of the tab order', () => {
    const { fileInput } = renderTab();
    expect(fileInput).toHaveAttribute('hidden');
    expect(fileInput).toHaveAttribute('accept', '.json');
  });
});
