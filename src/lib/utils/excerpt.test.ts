import { describe, expect, it } from 'vitest';
import { excerptAround } from './excerpt';

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
