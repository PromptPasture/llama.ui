import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Text the reader sees belongs in the catalogues, not in the markup.
 *
 * Seven strings reached users in English whatever language they had chosen,
 * because they were typed into components: two aria-labels, the name of the
 * settings tab strip, and the four messages shown when a setting is rejected.
 * None of it showed up in the tests, because a test that asserts an English
 * string passes whether the string is translated or not.
 */
const SRC = path.resolve(__dirname, '../..');

/** Test harnesses render throwaway markup and are not shipped. */
const IGNORED = /\.(test|spec)\.ts$|\.harness\.svelte$/;

function filesUnder(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(full, found);
    else if (!IGNORED.test(entry.name)) found.push(full);
  }
  return found;
}

const components = filesUnder(SRC)
  .filter((f) => f.endsWith('.svelte'))
  .map((file) => ({
    file: path.relative(SRC, file),
    src: fs.readFileSync(file, 'utf8'),
  }));

/** An attribute whose value is a bare string rather than an expression. */
const LITERAL_ATTRIBUTE =
  /\b(aria-label|aria-description|placeholder|title)="([^"{}]+)"/g;

/** A message handed to a toast or a dialog as a bare string. */
const LITERAL_MESSAGE =
  /(toast\.(?:error|success|info)|show(?:Confirm|Alert|Prompt))\(\s*[`'"][A-Z]/g;

describe('text the reader sees', () => {
  it('has components to check', () => {
    expect(components.length).toBeGreaterThan(15);
  });

  it('is never written into an attribute', () => {
    const found = components.flatMap(({ file, src }) =>
      [...src.matchAll(LITERAL_ATTRIBUTE)].map(
        ([, attribute, value]) => `${file}: ${attribute}="${value}"`
      )
    );

    // Use $_('some.key') instead, and add the wording to every catalogue.
    expect(found).toEqual([]);
  });

  it('is never handed straight to a toast or a dialog', () => {
    const sources = filesUnder(SRC)
      .filter((f) => /\.(svelte|ts)$/.test(f))
      .map((file) => ({
        file: path.relative(SRC, file),
        src: fs.readFileSync(file, 'utf8'),
      }));

    const found = sources.flatMap(({ file, src }) =>
      [...src.matchAll(LITERAL_MESSAGE)].map(
        ([match]) => `${file}: ${match.trim()}…`
      )
    );

    expect(found).toEqual([]);
  });
});

describe('icons that point along the line of text', () => {
  it('have a rule to mirror them where the text runs the other way', () => {
    const css = fs.readFileSync(path.join(SRC, 'app.css'), 'utf8');

    // The components mark such icons with this class; without the rule the
    // mark does nothing and a back arrow points forwards in Arabic.
    expect(css).toMatch(/\[dir=['"]?rtl['"]?\]\s+\.rtl-flip/);
  });

  it('are marked somewhere, so the rule is not orphaned', () => {
    const marked = components.filter(({ src }) => src.includes('rtl-flip'));

    expect(marked.length).toBeGreaterThan(0);
  });
});
