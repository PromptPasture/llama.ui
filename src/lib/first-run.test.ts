import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  showConfirm: vi.fn().mockResolvedValue(false),
}));

vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$lib/state/modal.svelte', () => ({
  modal: { showConfirm: mocks.showConfirm },
}));

const { offerToConfigure, setupPrompt, shouldOfferSetup } =
  await import('./first-run');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(() => {
  mocks.goto.mockClear();
  mocks.showConfirm.mockClear().mockResolvedValue(false);
});

describe('which wording to greet someone with', () => {
  it('welcomes a first visit', () => {
    // Both sets of wording have been translated in twelve languages from the
    // start; only one was ever shown.
    expect(setupPrompt('')).toBe('welcomePopup');
    expect(setupPrompt('   ')).toBe('welcomePopup');
  });

  it('reports no models when something was configured', () => {
    expect(setupPrompt('http://localhost:8080')).toBe('noModelsPopup');
  });

  it('greets rather than reporting a failure', async () => {
    await offerToConfigure('');

    expect(mocks.showConfirm).toHaveBeenCalledWith(
      expect.stringContaining("don't have the models set up yet. Let's go"),
      { confirm: 'Open Settings', cancel: 'Skip' }
    );
  });

  it('opens the settings when the offer is taken', async () => {
    mocks.showConfirm.mockResolvedValue(true);

    expect(await offerToConfigure('')).toBe(true);
    expect(mocks.goto).toHaveBeenCalledWith('/settings');
  });

  it('stays put when it is declined', async () => {
    expect(await offerToConfigure('')).toBe(false);
    expect(mocks.goto).not.toHaveBeenCalled();
  });
});

describe('whether to offer at all', () => {
  const state = (over = {}) => ({
    modelCount: 0,
    onSettingsScreen: false,
    alreadyOffered: false,
    ...over,
  });

  it('offers when nothing can be sent to', () => {
    expect(shouldOfferSetup(state())).toBe(true);
  });

  it('says nothing once a provider lists models', () => {
    expect(shouldOfferSetup(state({ modelCount: 3 }))).toBe(false);
  });

  it('says nothing while the settings are open', () => {
    // That is where the offer leads; someone reading them found their own way.
    expect(shouldOfferSetup(state({ onSettingsScreen: true }))).toBe(false);
  });

  it('asks once, not on every change', () => {
    expect(shouldOfferSetup(state({ alreadyOffered: true }))).toBe(false);
  });
});
