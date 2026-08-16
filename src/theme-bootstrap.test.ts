import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The theme has to be on the document before the first paint, so it lives as an
 * inline script in app.html rather than in any module. Run that exact script
 * here — anything else would be testing a copy of it.
 */
const bootstrap = (() => {
  const html = readFileSync(resolve(process.cwd(), 'src/app.html'), 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('app.html no longer has an inline script');
  if (!match[1].includes('data-theme')) {
    throw new Error('the inline script in app.html no longer sets the theme');
  }
  return new Function(match[1]);
})();

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('applying the theme before the first paint', () => {
  it('marks a stored theme', () => {
    localStorage.setItem('theme', 'dark');

    bootstrap();

    // Otherwise the page paints with the light defaults on :root and only
    // turns dark once the app has hydrated, fetched a locale and read
    // IndexedDB — a flash of white on every load.
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('leaves the system in charge when nothing is stored', () => {
    bootstrap();

    // app.css matches the system preference on :root:not([data-theme]).
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it("does not treat a stored 'auto' as a theme", () => {
    localStorage.setItem('theme', 'auto');

    bootstrap();

    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('starts the app even where storage is blocked', () => {
    const denied = () => {
      throw new Error('access is denied for this document');
    };
    const original = Object.getOwnPropertyDescriptor(
      Storage.prototype,
      'getItem'
    );
    Object.defineProperty(Storage.prototype, 'getItem', { value: denied });

    try {
      // A throw here is unrecoverable: it happens before anything renders.
      expect(() => bootstrap()).not.toThrow();
    } finally {
      Object.defineProperty(Storage.prototype, 'getItem', original!);
    }
  });
});
