import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import CONFIG_DEFAULT from '$lib/config/config-default.json';
import type { Configuration, ConfigurationPreset } from '$lib/types';

const mocks = vi.hoisted(() => ({
  showPrompt: vi.fn(),
  showConfirm: vi.fn(),
  showAlert: vi.fn(),
  success: vi.fn(),
}));

vi.mock('$lib/state/modal.svelte', () => ({
  modal: {
    showPrompt: mocks.showPrompt,
    showConfirm: mocks.showConfirm,
    showAlert: mocks.showAlert,
  },
}));
vi.mock('$lib/components/toast.js', () => ({
  toast: { success: mocks.success, error: vi.fn(), info: vi.fn() },
}));

const { default: PresetsTab } = await import('./PresetsTab.svelte');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

const config = CONFIG_DEFAULT as unknown as Configuration;

const preset = (name: string, over: Partial<Configuration> = {}) =>
  ({
    id: name.toLowerCase(),
    name,
    createdAt: 1,
    config: { ...config, ...over },
  }) as unknown as ConfigurationPreset;

const PRESETS = [preset('Fast', { temperature: 0.2 }), preset('Careful')];

function renderTab(presets = PRESETS) {
  const handlers = {
    onsavepreset: vi.fn().mockResolvedValue(undefined),
    onremovepreset: vi.fn().mockResolvedValue(undefined),
    onsaveconfig: vi.fn().mockResolvedValue(undefined),
  };
  render(PresetsTab, { props: { config, presets, ...handlers } });
  return handlers;
}

/** Opens the actions for a preset and presses Rename. */
async function renameFirst(to: string | undefined) {
  const user = userEvent.setup();
  const handlers = renderTab();
  mocks.showPrompt.mockResolvedValue(to);
  await user.click(screen.getAllByRole('button', { name: 'Rename' })[0]);
  return handlers;
}

beforeEach(() => {
  mocks.showPrompt.mockReset();
  mocks.showConfirm.mockReset().mockResolvedValue(true);
  mocks.success.mockClear();
});

describe('renaming a preset', () => {
  it('offers the current name to edit', async () => {
    await renameFirst('Faster');

    // Without it the box opens empty and the whole name has to be retyped to
    // change a letter of it.
    expect(mocks.showPrompt).toHaveBeenCalledWith(expect.any(String), 'Fast');
  });

  it('stores it under the new name and drops the old', async () => {
    const { onsavepreset, onremovepreset } = await renameFirst('Faster');

    expect(onsavepreset).toHaveBeenCalledWith('Faster', expect.any(Object));
    expect(onremovepreset).toHaveBeenCalledWith('Fast');
  });

  it('stores the new one before dropping the old', async () => {
    const order: string[] = [];
    const user = userEvent.setup();
    const handlers = {
      onsavepreset: vi.fn(async () => void order.push('saved')),
      onremovepreset: vi.fn(async () => void order.push('removed')),
      onsaveconfig: vi.fn(),
    };
    render(PresetsTab, { props: { config, presets: PRESETS, ...handlers } });
    mocks.showPrompt.mockResolvedValue('Faster');

    await user.click(screen.getAllByRole('button', { name: 'Rename' })[0]);

    // The other order loses the preset outright if the save fails.
    expect(order).toEqual(['saved', 'removed']);
  });

  it('keeps the settings the preset held', async () => {
    const { onsavepreset } = await renameFirst('Faster');

    expect(onsavepreset.mock.calls[0][1]).toMatchObject({ temperature: 0.2 });
  });

  it('does nothing when the name is unchanged', async () => {
    const { onsavepreset, onremovepreset } = await renameFirst('Fast');

    // Removing and re-adding it would be work for nothing, and a failure
    // half way would lose it.
    expect(onsavepreset).not.toHaveBeenCalled();
    expect(onremovepreset).not.toHaveBeenCalled();
  });

  it('does nothing when the prompt is dismissed', async () => {
    const { onsavepreset, onremovepreset } = await renameFirst(undefined);

    expect(onsavepreset).not.toHaveBeenCalled();
    expect(onremovepreset).not.toHaveBeenCalled();
  });

  it('does nothing when the new name is only whitespace', async () => {
    const { onsavepreset, onremovepreset } = await renameFirst('   ');

    expect(onsavepreset).not.toHaveBeenCalled();
    expect(onremovepreset).not.toHaveBeenCalled();
  });
});

describe('renaming a preset onto the name of another', () => {
  it('asks first', async () => {
    await renameFirst('Careful');

    expect(mocks.showConfirm).toHaveBeenCalledWith(
      expect.stringContaining('Careful')
    );
  });

  it('leaves both alone when the answer is no', async () => {
    mocks.showConfirm.mockResolvedValue(false);

    const { onsavepreset, onremovepreset } = await renameFirst('Careful');

    // Saving over it unasked would lose the preset already using that name.
    expect(onsavepreset).not.toHaveBeenCalled();
    expect(onremovepreset).not.toHaveBeenCalled();
  });

  it('replaces it when the answer is yes', async () => {
    const { onsavepreset } = await renameFirst('Careful');

    expect(onsavepreset).toHaveBeenCalledWith('Careful', expect.any(Object));
  });
});
