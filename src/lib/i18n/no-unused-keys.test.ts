import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './en.json';

/**
 * Wording that reaches nobody.
 *
 * Fifty entries outlived whatever used to show them: a code runner, a file
 * preview dialog, a demo importer, an experimental section. Each was carried
 * through the migration and translated into twelve languages, so anyone
 * offering to translate this app was being asked to write strings that could
 * never appear on screen.
 */
const SRC = path.resolve(__dirname, '../..');

function filesUnder(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // The catalogues quote every key by definition.
      if (entry.name !== 'i18n') filesUnder(full, found);
    } else if (/\.(ts|svelte)$/.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

const sources = filesUnder(SRC)
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

/**
 * Keys the code assembles at runtime instead of spelling out.
 *
 * Anything looked up this way is invisible to a search for the whole key, so
 * each pattern has to be described here. A new one belongs in this list.
 */
const ASSEMBLED: { pattern: RegExp; used: (m: RegExpMatchArray) => boolean }[] =
  [
    {
      // Every settings field asks for the label and note of whatever it is
      // given as its configKey.
      pattern: /^settings\.parameters\.([^.]+)\.(label|note)$/,
      used: (m) => new RegExp(`\\b${m[1]}\\b`).test(sources),
    },
    {
      // ConversationGroup looks these up by the group's own title.
      pattern: /^sidebar\.groups\./,
      used: () => true,
    },
    {
      // first-run.ts picks the section, then asks for these three.
      pattern:
        /^toast\.(welcomePopup|noModelsPopup)\.(description|submitBtnLabel|cancelBtnLabel)$/,
      used: () => true,
    },
  ];

function isUsed(key: string): boolean {
  if (sources.includes(key)) return true;
  return ASSEMBLED.some(({ pattern, used }) => {
    const match = key.match(pattern);
    return match !== null && used(match);
  });
}

describe('every string in the catalogues', () => {
  it('has keys to check', () => {
    expect(Object.keys(en).length).toBeGreaterThan(100);
  });

  it('can actually reach a reader', () => {
    const unreachable = Object.keys(en).filter((key) => !isUsed(key));

    // Either show it or take it out — and if it is looked up by a key built
    // at runtime, describe that pattern above.
    expect(unreachable).toEqual([]);
  });
});
