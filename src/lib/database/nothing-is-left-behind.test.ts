import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import LocalStorage from './localStorage';

/**
 * Anything the app stores has to be something it can forget.
 *
 * Forgetting everything works from a list of key names kept by hand, so a
 * feature that stores something under a new one is left behind by it — and
 * what is left behind is the reader's, on a machine they may have handed on.
 * Unsent messages were nearly the first of these.
 */
const SRC = path.resolve(__dirname, '../..');

const IGNORED = /\.(test|spec)\.ts$|\.harness\.svelte$/;

function filesUnder(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(full, found);
    else if (/\.(ts|svelte)$/.test(entry.name) && !IGNORED.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/** `localStorage.setItem(<what>, …)`, whether spelled out or named. */
const WRITES =
  /localStorage\.setItem\(\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))/g;

/**
 * The keys a file writes, following a constant to its value in that file.
 *
 * @param source - The contents of one file
 * @returns Each key it stores something under, unresolved names included so
 *   nothing is passed over in silence
 */
export function keysWrittenIn(source: string): string[] {
  const found: string[] = [];
  for (const [, single, double, name] of source.matchAll(WRITES)) {
    if (single ?? double) {
      found.push((single ?? double) as string);
      continue;
    }
    // A constant, which is how the longer names are written.
    const declared = new RegExp(
      `\\b${name}\\s*(?::[^=]+)?=\\s*['"]([^'"]+)['"]`
    ).exec(source);
    found.push(declared ? declared[1] : `${name} (unresolved)`);
  }
  return found;
}

const stored = [
  ...new Set(
    filesUnder(SRC).flatMap((file) =>
      keysWrittenIn(fs.readFileSync(file, 'utf8'))
    )
  ),
];

describe('everything the app stores in the browser', () => {
  it('finds the places it is stored', () => {
    expect(stored.length).toBeGreaterThan(2);
  });

  it('can be forgotten again', () => {
    const forgettable = new Set<string>(LocalStorage.KEYS);
    const leftBehind = stored.filter((key) => !forgettable.has(key));

    // Add it to LocalStorage.KEYS. A key that cannot be named there — built
    // at runtime, say — needs forgetting some other way, and this test will
    // say so rather than let it pass unnoticed.
    expect(leftBehind).toEqual([]);
  });
});

describe('the check itself', () => {
  it('reads a key written out in full', () => {
    expect(keysWrittenIn(`localStorage.setItem('theme', theme);`)).toEqual([
      'theme',
    ]);
  });

  it('follows a constant to the name it holds', () => {
    expect(
      keysWrittenIn(
        `const STORAGE_KEY = 'drafts';\nlocalStorage.setItem(STORAGE_KEY, x);`
      )
    ).toEqual(['drafts']);
  });

  it('follows one that carries a type', () => {
    expect(
      keysWrittenIn(`const K: string = 'notes';\nlocalStorage.setItem(K, x);`)
    ).toEqual(['notes']);
  });

  it('says so rather than passing over a name it cannot follow', () => {
    // Silence here would be the failure: an unfollowable name is exactly the
    // case where something gets left behind.
    expect(keysWrittenIn(`localStorage.setItem(whatever, x);`)).toEqual([
      'whatever (unresolved)',
    ]);
  });

  it('finds nothing where nothing is stored', () => {
    expect(keysWrittenIn(`localStorage.getItem('theme');`)).toEqual([]);
  });
});
