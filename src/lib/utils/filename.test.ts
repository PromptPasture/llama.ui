import { describe, expect, it } from 'vitest';
import { toFileName } from './filename';

describe('naming a downloaded file', () => {
  it('keeps a plain name as it is', () => {
    expect(toFileName('Bread recipe', 'fallback')).toBe('Bread recipe');
  });

  it('replaces what a file system will not take', () => {
    expect(toFileName('report: q1/q2 <draft>', 'fallback')).toBe(
      'report q1 q2 draft'
    );
  });

  it('shortens a name far longer than a file name may be', () => {
    const out = toFileName('a'.repeat(300), 'fallback');

    // A conversation is named after its opening message, up to 256 characters.
    expect(out.length).toBeLessThanOrEqual(60);
  });

  it('does not start with a dot, which would hide the file', () => {
    expect(toFileName('...hidden', 'fallback')).toBe('hidden');
  });

  it('does not end with a dot or a space, which Windows drops', () => {
    expect(toFileName('trailing. ', 'fallback')).toBe('trailing');
  });

  it('falls back when nothing usable is left', () => {
    expect(toFileName('///', 'conversation')).toBe('conversation');
    expect(toFileName('   ', 'conversation')).toBe('conversation');
    expect(toFileName('', 'conversation')).toBe('conversation');
  });

  it('keeps letters that are not English', () => {
    expect(toFileName('Рецепт хлеба', 'fallback')).toBe('Рецепт хлеба');
  });
});
