import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A label needs something to attach to.
 *
 * `aria-label` on a plain div or span does nothing at all: those elements have
 * no role, so nothing is exposed for the label to name, and it is dropped. The
 * message box carried its label on the wrapper around it and was left with
 * only its placeholder; the disabled model picker was a labelled div, so its
 * value was announced with nothing to say it was the model.
 *
 * Both looked covered — `getByLabelText` finds an attribute wherever it sits,
 * whether or not a reader would ever hear it.
 */
const SRC = path.resolve(__dirname, '.');

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

/** Elements with no role of their own, so nothing for a label to name. */
const NO_ROLE_OF_ITS_OWN = new Set(['div', 'span', 'p']);

/**
 * Reads the attributes of every opening tag.
 *
 * Brace-aware, because an arrow function in a handler puts a `>` inside the
 * tag and stopping at the first one would cut it short.
 *
 * @param src - The contents of a component
 * @returns Each opening tag's name and the attribute text that followed it
 */
function openingTags(src: string): { name: string; attrs: string }[] {
  const tags: { name: string; attrs: string }[] = [];
  const start = /<([a-zA-Z][\w-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = start.exec(src))) {
    let i = start.lastIndex;
    let depth = 0;
    let quote = '';
    while (i < src.length) {
      const c = src[i];
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
      i++;
    }
    tags.push({ name: match[1], attrs: src.slice(start.lastIndex, i) });
  }
  return tags;
}

/**
 * Finds labels that name nothing.
 *
 * @param src - The contents of a component
 * @returns The name of each offending tag
 */
function labelsWithNothingToName(src: string): string[] {
  return openingTags(src)
    .filter(
      ({ name, attrs }) =>
        NO_ROLE_OF_ITS_OWN.has(name) &&
        /\baria-label=/.test(attrs) &&
        !/\brole=/.test(attrs)
    )
    .map(({ name }) => name);
}

describe('every label names something', () => {
  it('has components to check', () => {
    expect(components.length).toBeGreaterThan(15);
  });

  it('holds across the whole interface', () => {
    const found = components.flatMap(({ file, src }) =>
      labelsWithNothingToName(src).map((name) => `${file}: <${name}>`)
    );

    // Put the label on the control itself, or give the element a role.
    expect(found).toEqual([]);
  });
});

describe('the check itself', () => {
  it('catches a label on an element with no role', () => {
    expect(
      labelsWithNothingToName(`<div class="box" aria-label={$_('a.b')}></div>`)
    ).toEqual(['div']);
  });

  it('accepts one on an element that has been given a role', () => {
    expect(
      labelsWithNothingToName(`<div role="group" aria-label={$_('a.b')}></div>`)
    ).toEqual([]);
  });

  it('accepts one on an element that has a role already', () => {
    expect(
      labelsWithNothingToName(`<nav aria-label={$_('a.b')}></nav>`)
    ).toEqual([]);
  });

  it('is not cut short by an arrow function in a handler', () => {
    // The `>` of `=>` sits inside the tag; stopping there would hide the role
    // that follows and report a component that is perfectly fine.
    expect(
      labelsWithNothingToName(
        `<div onclick={() => (open = !open)} role="button" aria-label={$_('a.b')}></div>`
      )
    ).toEqual([]);
  });

  it('reads past a comparison inside an expression', () => {
    expect(
      labelsWithNothingToName(
        `<div class={n > 2 ? 'a' : 'b'} aria-label={$_('a.b')}></div>`
      )
    ).toEqual(['div']);
  });
});
