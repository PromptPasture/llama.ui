import { describe, expect, it } from 'vitest';
import { excerptAround, splitAround } from './excerpt';

describe('showing why a conversation matched', () => {
  it('returns the surrounding words', () => {
    const text = 'We talked at length about sourdough starters and hydration.';

    expect(excerptAround(text, 'sourdough')).toBe(text);
  });

  it('trims a long passage down to the match', () => {
    const text = `${'a '.repeat(60)}needle${' b'.repeat(60)}`;

    const out = excerptAround(text, 'needle');

    expect(out).toContain('needle');
    expect(out.startsWith('…')).toBe(true);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThan(120);
  });

  it('marks only the end when the match is at the start', () => {
    const out = excerptAround(`needle${' b'.repeat(60)}`, 'needle');

    expect(out.startsWith('…')).toBe(false);
    expect(out.endsWith('…')).toBe(true);
  });

  it('flattens the line breaks markdown arrives with', () => {
    const out = excerptAround('# Heading\n\n- one\n- needle here', 'needle');

    // A result is one line; newlines and indentation cannot be shown in it.
    expect(out).not.toContain('\n');
    expect(out).toContain('needle here');
  });

  it('finds the term whatever the case', () => {
    expect(excerptAround('The Needle in question', 'needle')).toContain(
      'Needle'
    );
  });

  it('says nothing when the term is not there', () => {
    expect(excerptAround('no such thing here', 'needle')).toBe('');
  });

  it('says nothing for a blank term', () => {
    expect(excerptAround('some text', '   ')).toBe('');
  });
});

describe('marking the match inside an excerpt', () => {
  it('splits the text into the match and what surrounds it', () => {
    expect(splitAround('add the yeast now', 'yeast')).toEqual({
      before: 'add the ',
      match: 'yeast',
      after: ' now',
    });
  });

  it('keeps the capitalisation the text used', () => {
    // Not the capitalisation that was typed into the search box.
    expect(splitAround('The Needle here', 'needle').match).toBe('Needle');
  });

  it('marks the first occurrence only', () => {
    const { before, after } = splitAround('yeast and more yeast', 'yeast');

    expect(before).toBe('');
    expect(after).toBe(' and more yeast');
  });

  it('leaves the text whole when the term is not in it', () => {
    expect(splitAround('nothing here', 'yeast')).toEqual({
      before: 'nothing here',
      match: '',
      after: '',
    });
  });

  it('leaves it whole for a blank term', () => {
    expect(splitAround('nothing here', '  ').match).toBe('');
  });
});
