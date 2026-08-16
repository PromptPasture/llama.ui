import { describe, expect, it } from 'vitest';
import { toConversationName } from './conversation-name';

describe('naming a conversation after its first message', () => {
  it('keeps a short message as it is', () => {
    expect(toConversationName('How do I centre a div?')).toBe(
      'How do I centre a div?'
    );
  });

  it('takes only the first line of a longer message', () => {
    const name = toConversationName(
      'Fix this error\n\nTypeError: x is not a function'
    );

    // The rest of a pasted block says nothing about it that its opening does
    // not, and the name is read aloud as the item's label.
    expect(name).toBe('Fix this error');
  });

  it('shortens a long opening line at a word', () => {
    const name = toConversationName(
      'I would like a detailed explanation of how the borrow checker decides when a reference outlives its owner'
    );

    const opening =
      'I would like a detailed explanation of how the borrow checker decides when a reference outlives its owner';

    expect(name.length).toBeLessThanOrEqual(61);
    expect(name.endsWith('…')).toBe(true);
    // Cut on a word: what is kept is followed by a space in the original,
    // rather than by the rest of a word it stopped halfway through.
    const kept = name.slice(0, -1);
    expect(opening.startsWith(`${kept} `)).toBe(true);
  });

  it('does not leave a space before the ellipsis', () => {
    expect(toConversationName(`${'word '.repeat(30)}`)).not.toContain(' …');
  });

  it('cuts by length where there are no spaces to cut on', () => {
    const name = toConversationName('あ'.repeat(200));

    // Japanese and Chinese are written without spaces between words.
    expect(name.length).toBeLessThanOrEqual(61);
    expect(name.endsWith('…')).toBe(true);
  });

  it('flattens the whitespace it keeps', () => {
    expect(toConversationName('  spaced    out  ')).toBe('spaced out');
  });

  it('falls back past empty leading lines', () => {
    expect(toConversationName('\n\nthe actual question')).toBe(
      'the actual question'
    );
  });

  it('has nothing to say about an empty message', () => {
    expect(toConversationName('')).toBe('');
  });
});
