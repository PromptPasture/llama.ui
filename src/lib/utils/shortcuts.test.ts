import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  keyShortcuts,
  shortcutHint,
  titleWithShortcut,
  usesCommandKey,
} from './shortcuts';

/** Stands in for the browser's account of what it is running on. */
function runningOn(platform: string, modern = true) {
  vi.stubGlobal('navigator', {
    platform: modern ? '' : platform,
    userAgentData: modern ? { platform } : undefined,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('naming the modifier key', () => {
  it('says Command on a Mac', () => {
    runningOn('macOS');

    expect(usesCommandKey()).toBe(true);
  });

  it('says Control on Windows', () => {
    runningOn('Windows');

    expect(usesCommandKey()).toBe(false);
  });

  it('says Control on Linux', () => {
    runningOn('Linux');

    expect(usesCommandKey()).toBe(false);
  });

  it('says Command on an iPad, which can have a keyboard', () => {
    runningOn('iPadOS');

    expect(usesCommandKey()).toBe(true);
  });

  it('falls back to the older reading of the platform', () => {
    // Firefox and Safari have no userAgentData; navigator.platform is
    // deprecated and still the only answer they give.
    runningOn('MacIntel', false);

    expect(usesCommandKey()).toBe(true);
  });

  it('assumes Control when the browser says nothing', () => {
    vi.stubGlobal('navigator', {});

    expect(usesCommandKey()).toBe(false);
  });
});

describe('writing a shortcut down', () => {
  it('uses the symbol a Mac keyboard has on the key', () => {
    runningOn('macOS');

    // Telling a Mac user to press Ctrl+K names a key they will not press.
    expect(shortcutHint('K')).toBe('⌘K');
  });

  it('spells it out everywhere else', () => {
    runningOn('Windows');

    expect(shortcutHint('K')).toBe('Ctrl+K');
  });

  it('puts it after the name of the button', () => {
    runningOn('Windows');

    expect(titleWithShortcut('New conversation', 'N')).toBe(
      'New conversation (Ctrl+N)'
    );
  });
});

describe('the shortcut as ARIA has it', () => {
  it('lists both modifiers, because both work', () => {
    expect(keyShortcuts('K')).toBe('Control+K Meta+K');
  });

  it('says the same thing whatever the platform', () => {
    runningOn('macOS');

    // This is read out rather than looked at, and what it should say is what
    // will work.
    expect(keyShortcuts('N')).toBe('Control+N Meta+N');
  });
});
