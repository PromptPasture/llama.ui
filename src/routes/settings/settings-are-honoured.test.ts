import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const SETTINGS = join(SRC, 'routes', 'settings');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** Every setting the settings screens put on the page. */
const offered = [
  ...new Set(
    filesUnder(SETTINGS)
      .filter((f) => f.endsWith('.svelte'))
      .flatMap((f) => [
        ...readFileSync(f, 'utf8').matchAll(/configKey="([A-Za-z_]+)"/g),
      ])
      .map((m) => m[1])
  ),
].sort();

/**
 * Everything that could act on a setting: the app outside the screens that
 * offer them, and outside the places that merely name them — the defaults, the
 * type declarations, the catalogues, and the tests.
 */
const actingCode = filesUnder(SRC)
  .filter((f) => /\.(ts|svelte)$/.test(f))
  .filter((f) => !f.startsWith(SETTINGS))
  .filter((f) => !/\.test\.ts$/.test(f))
  .filter((f) => !f.startsWith(join(SRC, 'lib', 'types')))
  .filter((f) => !f.startsWith(join(SRC, 'lib', 'i18n')))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

describe('the settings screens', () => {
  it('offer something to change', () => {
    expect(offered.length).toBeGreaterThan(10);
  });

  it.each(offered)('act on %s somewhere', (key) => {
    // A control that changes nothing is worse than no control: it says the app
    // can do something it cannot, and the reader finds out by it not working.
    // If this fails, either wire the setting up or take it off the screen.
    expect(new RegExp(`\\b${key}\\b`).test(actingCode)).toBe(true);
  });
});
