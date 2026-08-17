import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import CONFIG_DEFAULT from './config-default.json';

/**
 * Every setting has to do something.
 *
 * Two keys outlived the features they configured: `pdfAsImage` and
 * `pyIntepreterEnabled` came across from the React app with a default, a
 * label and a note translated into twelve languages, and nothing anywhere
 * that read them. They cost every stored configuration a line and every
 * exported database a field, and they promise a reader something the app
 * cannot do.
 *
 * The companion check in the settings screens guards the other direction: a
 * setting shown to a reader must be read somewhere outside them.
 */
const SRC = path.resolve(__dirname, '../..');

/** Where a key may appear without meaning anything is honoured. */
const NOT_A_USE =
  /\/i18n\/|config-default\.json$|types\/configuration\.ts$|\/settings\/|components\/settings\/|\.(test|spec)\.ts$/;

function filesUnder(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(full, found);
    else found.push(full);
  }
  return found;
}

const sources = filesUnder(SRC)
  .filter((f) => /\.(ts|svelte)$/.test(f) && !NOT_A_USE.test(f))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

const keys = Object.keys(CONFIG_DEFAULT);

describe('every setting the app stores', () => {
  it('has settings to check', () => {
    expect(keys.length).toBeGreaterThan(20);
  });

  it('is read by something that is not the settings screen', () => {
    const dead = keys.filter(
      (key) => !new RegExp(`\\b${key}\\b`).test(sources)
    );

    // Either make it do something, or take it out: a setting nothing reads is
    // a promise the app does not keep.
    expect(dead).toEqual([]);
  });
});
