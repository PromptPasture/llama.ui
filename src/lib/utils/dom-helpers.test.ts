import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyStr, isAtBottom } from './dom-helpers';

const textareas = () => document.querySelectorAll('textarea');

/** Pretends the page is served over plain http, as a LAN deployment is. */
function insecureContext() {
  vi.stubGlobal('isSecureContext', false);
  const execCommand = vi.fn().mockReturnValue(true);
  Object.defineProperty(document, 'execCommand', {
    value: execCommand,
    configurable: true,
    writable: true,
  });
  return execCommand;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('copying over a secure connection', () => {
  it('hands the text to the clipboard api', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    await copyStr('some text');

    expect(writeText).toHaveBeenCalledWith('some text');
    expect(textareas()).toHaveLength(0);
  });
});

describe('copying without one', () => {
  it('falls back to the selection trick', async () => {
    const execCommand = insecureContext();

    await copyStr('some text');

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('leaves nothing behind in the page', async () => {
    insecureContext();

    await copyStr('some text');

    // The element used to stay, so one accumulated per copy — invisible, but
    // still in the document and reachable by tabbing.
    expect(textareas()).toHaveLength(0);
  });

  it('leaves nothing behind even when the copy command fails', async () => {
    vi.stubGlobal('isSecureContext', false);
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn(() => {
        throw new Error('not permitted');
      }),
      configurable: true,
      writable: true,
    });

    // The refusal is the answer, not an exception for the caller to handle.
    await expect(copyStr('some text')).resolves.toBe(false);
    expect(textareas()).toHaveLength(0);
  });

  it('does not accumulate across repeated copies', async () => {
    insecureContext();

    for (let i = 0; i < 25; i++) await copyStr(`copy ${i}`);

    expect(textareas()).toHaveLength(0);
  });
});

describe('deciding whether a conversation is showing its end', () => {
  const at = (scrollTop: number, scrollHeight = 2000, clientHeight = 600) => ({
    scrollTop,
    scrollHeight,
    clientHeight,
  });

  it('is at the end when scrolled all the way down', () => {
    expect(isAtBottom(at(1400))).toBe(true);
  });

  it('forgives stopping a few pixels short', () => {
    // A trackpad that under-shoots, or a rounding difference at some zoom
    // levels, should not read as having scrolled away.
    expect(isAtBottom(at(1380))).toBe(true);
  });

  it('is not at the end once the reader has scrolled up to read', () => {
    expect(isAtBottom(at(400))).toBe(false);
  });

  it('is not at the end one screen above it', () => {
    expect(isAtBottom(at(800))).toBe(false);
  });

  it('treats a conversation shorter than the window as being at its end', () => {
    // Nothing to scroll, so a reply should still scroll itself into view.
    expect(isAtBottom(at(0, 300, 600))).toBe(true);
  });

  it('accepts a tolerance of its own', () => {
    expect(isAtBottom(at(1000), 400)).toBe(true);
    expect(isAtBottom(at(1000), 300)).toBe(false);
  });
});

describe('a copy the clipboard refuses', () => {
  it('says it did not happen', async () => {
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('not focused')),
      },
      configurable: true,
    });

    // The permission withheld, or the document not focused: ordinary, and it
    // used to leave a button reporting a success it had never checked.
    await expect(copyStr('some text')).resolves.toBe(false);
  });

  it('says so when the older command reports failure', async () => {
    vi.stubGlobal('isSecureContext', false);
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn(() => false),
      configurable: true,
      writable: true,
    });

    await expect(copyStr('some text')).resolves.toBe(false);
  });

  it('says a copy that worked did', async () => {
    vi.stubGlobal('isSecureContext', true);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });

    await expect(copyStr('some text')).resolves.toBe(true);
  });
});
