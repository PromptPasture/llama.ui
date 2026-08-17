import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Left and right are not the same as start and end.
 *
 * Arabic is one of the twelve languages that ship, and the layout turns round
 * with it. A rule written in left and right does not turn: a quotation kept
 * its bar on the side the text ends, a list indented away from its own
 * markers, and the reasoning section padded itself on one side while drawing
 * its line down the other — that one mixed the two in a single rule.
 */
const SRC = path.resolve(__dirname, '../..');

const IGNORED = /\.(test|spec)\.ts$|\.harness\.svelte$/;

function filesUnder(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(full, found);
    else if (/\.(svelte|css)$/.test(entry.name) && !IGNORED.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Properties and utilities that name a side of the screen rather than a side
 * of the text. Anchored so `border-radius` is not mistaken for `border-r`.
 */
const SIDED = [
  /(?:^|[^-\w])(?:margin|padding|border)-(?:left|right)\s*:/,
  /(?:^|[\s"'`{])(?:ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r)-[\w./[\]]+/,
  /(?:^|[\s"'`{])text-(?:left|right)(?:$|[\s"'`};])/,
];

/**
 * The sided rules in one file.
 *
 * @param source - The contents of a component or stylesheet
 * @returns Each offending fragment, so a failure says what to change
 */
export function sidedRulesIn(source: string): string[] {
  const found: string[] = [];
  for (const line of source.split('\n')) {
    // A line may say why it has to be sided.
    if (/direction|physical on purpose/i.test(line)) continue;
    for (const pattern of SIDED) {
      const hit = pattern.exec(line);
      if (hit) found.push(hit[0].trim());
    }
  }
  return found;
}

const files = filesUnder(SRC).map((file) => ({
  file: path.relative(SRC, file),
  src: fs.readFileSync(file, 'utf8'),
}));

describe('every rule that picks a side', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it('picks the start or the end, not the left or the right', () => {
    const sided = files.flatMap(({ file, src }) =>
      sidedRulesIn(src).map((rule) => `${file}: ${rule}`)
    );

    // ps/pe, ms/me, border-inline-start, text-start — these turn round with
    // the text; left and right do not.
    expect(sided).toEqual([]);
  });
});

describe('the check itself', () => {
  it('catches a physical border', () => {
    expect(sidedRulesIn('  border-left: 2px solid red;')).toHaveLength(1);
  });

  it('catches a physical padding utility', () => {
    expect(sidedRulesIn('  @apply pl-4 text-sm;')).toHaveLength(1);
  });

  it('catches forced alignment', () => {
    expect(sidedRulesIn('  @apply text-left;')).toHaveLength(1);
  });

  it('leaves border-radius alone', () => {
    // It ends with -radius, not with a side.
    expect(sidedRulesIn('  border-radius: var(--radius-lg);')).toEqual([]);
  });

  it('leaves the logical ones alone', () => {
    expect(
      sidedRulesIn(
        '  @apply ps-4 pe-2 text-start;\n  border-inline-start: 2px solid red;'
      )
    ).toEqual([]);
  });

  it('leaves a rounded corner utility alone', () => {
    expect(sidedRulesIn('  @apply rounded-md;')).toEqual([]);
  });
});
