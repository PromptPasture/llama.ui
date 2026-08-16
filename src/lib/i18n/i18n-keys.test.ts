import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './en.json';

/**
 * svelte-i18n renders the key itself when a message is missing and no `default`
 * was supplied, so a typo surfaces to users as a raw string like
 * "header.ariaLabels.clear". Only `en.json` is checked: it is the
 * fallbackLocale, so a key defined there resolves for every locale.
 */

const SRC = path.resolve(__dirname, '../..');

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (
      /\.(svelte|ts)$/.test(entry.name) &&
      !/\.test\.ts$/.test(entry.name)
    )
      found.push(full);
  }
  return found;
}

interface Usage {
  key: string;
  hasDefault: boolean;
  file: string;
}

/** Reads the argument list of a `$_(` call, balancing nested parentheses. */
function argsOf(source: string, openParenIndex: number): string {
  let depth = 0;
  for (let i = openParenIndex; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') {
      depth--;
      if (depth === 0) return source.slice(openParenIndex + 1, i);
    }
  }
  return source.slice(openParenIndex + 1);
}

function usagesIn(file: string): Usage[] {
  const source = fs.readFileSync(file, 'utf8');
  const usages: Usage[] = [];
  const call = /\$_\(\s*(['"`])([^'"`]*)\1/g;
  let match: RegExpExecArray | null;

  while ((match = call.exec(source)) !== null) {
    const key = match[2];
    // Keys assembled at runtime cannot be checked statically.
    if (key.includes('${')) continue;
    const args = argsOf(source, source.indexOf('(', match.index));
    usages.push({
      key,
      hasDefault: /\bdefault\s*:/.test(args),
      file: path.relative(SRC, file),
    });
  }
  return usages;
}

const usages = sourceFiles(SRC).flatMap(usagesIn);
const catalogue = new Set(Object.keys(en));

describe('translation keys', () => {
  it('finds translation usages to check', () => {
    expect(usages.length).toBeGreaterThan(50);
  });

  it('resolves every key that has no default', () => {
    const unresolved = usages
      .filter((u) => !u.hasDefault && !catalogue.has(u.key))
      .map((u) => `${u.key}  (${u.file})`);

    expect(unresolved).toEqual([]);
  });
});
