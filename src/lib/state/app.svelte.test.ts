import { beforeEach, describe, expect, it, vi } from 'vitest';
import CONFIG_DEFAULT from '../config/config-default.json';
import type { Configuration } from '../types';

const mocks = vi.hoisted(() => ({
  getPresets: vi.fn().mockResolvedValue([]),
}));

vi.mock('$lib/database/indexedDB', () => ({
  default: { getPresets: mocks.getPresets },
}));

const { app } = await import('./app.svelte');

const stored = (overrides: Partial<Configuration>) =>
  JSON.stringify({ ...CONFIG_DEFAULT, ...overrides });

/** What the browser sends to the other tabs when one of them writes. */
function anotherTabWrote(key: string, value: string) {
  localStorage.setItem(key, value);
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }));
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('following the system theme', () => {
  // app.css puts the dark palette behind `:root:not([data-theme])`, so the
  // attribute being absent is what "auto" means to the stylesheet.
  const themeAttr = () => document.documentElement.getAttribute('data-theme');

  it('leaves no theme attribute for a first-time visitor', async () => {
    await app.init();

    expect(app.currentTheme).toBe('auto');
    // With data-theme="auto" nothing matches but the light defaults on :root,
    // so a visitor whose system is dark would be shown the light palette.
    expect(themeAttr()).toBeNull();
  });

  it('marks a chosen theme', () => {
    app.switchTheme('dark');

    expect(themeAttr()).toBe('dark');
  });

  it('hands control back to the system when auto is chosen again', () => {
    app.switchTheme('dark');

    app.switchTheme('auto');

    expect(themeAttr()).toBeNull();
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('restores a stored theme on the next visit', async () => {
    app.switchTheme('dark');

    await app.init();

    expect(themeAttr()).toBe('dark');
  });
});

describe('starting up', () => {
  it('reads the stored configuration', async () => {
    localStorage.setItem('config', stored({ apiKey: 'from-storage' }));

    await app.init();

    expect(app.config.apiKey).toBe('from-storage');
  });
});

describe('a second tab changing the settings', () => {
  it('adopts what the other tab saved', async () => {
    localStorage.setItem('config', stored({ systemMessage: 'original' }));
    await app.init();

    anotherTabWrote('config', stored({ systemMessage: 'edited elsewhere' }));

    // Without this the older configuration stays in memory, and the next save
    // from this tab — picking a model writes the whole object — puts it back.
    expect(app.config.systemMessage).toBe('edited elsewhere');
  });

  it("does not lose the other tab's change on the next save here", async () => {
    localStorage.setItem('config', stored({ systemMessage: 'original' }));
    await app.init();

    anotherTabWrote('config', stored({ systemMessage: 'edited elsewhere' }));
    // The header does exactly this when a model is chosen.
    app.saveConfig({ ...app.config, model: 'a-different-model' });

    const written = JSON.parse(localStorage.getItem('config')!);
    expect(written.systemMessage).toBe('edited elsewhere');
    expect(written.model).toBe('a-different-model');
  });

  it('ignores writes to other keys', async () => {
    localStorage.setItem('config', stored({ systemMessage: 'original' }));
    await app.init();

    anotherTabWrote('theme', 'dark');

    expect(app.config.systemMessage).toBe('original');
  });
});
