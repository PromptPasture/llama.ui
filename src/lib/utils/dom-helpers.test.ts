import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyStr } from './dom-helpers';

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

    copyStr('some text');

    expect(writeText).toHaveBeenCalledWith('some text');
    expect(textareas()).toHaveLength(0);
  });
});

describe('copying without one', () => {
  it('falls back to the selection trick', () => {
    const execCommand = insecureContext();

    copyStr('some text');

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('leaves nothing behind in the page', () => {
    insecureContext();

    copyStr('some text');

    // The element used to stay, so one accumulated per copy — invisible, but
    // still in the document and reachable by tabbing.
    expect(textareas()).toHaveLength(0);
  });

  it('leaves nothing behind even when the copy command fails', () => {
    vi.stubGlobal('isSecureContext', false);
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn(() => {
        throw new Error('not permitted');
      }),
      configurable: true,
      writable: true,
    });

    expect(() => copyStr('some text')).toThrow();
    expect(textareas()).toHaveLength(0);
  });

  it('does not accumulate across repeated copies', () => {
    insecureContext();

    for (let i = 0; i < 25; i++) copyStr(`copy ${i}`);

    expect(textareas()).toHaveLength(0);
  });
});
