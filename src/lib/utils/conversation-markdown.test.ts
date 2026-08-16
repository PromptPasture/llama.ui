import { describe, expect, it } from 'vitest';
import { toMarkdown } from './conversation-markdown';
import type { Message } from '$lib/types';

const labels = { user: 'You', assistant: 'Assistant' };

const say = (role: Message['role'], content: string | null): Message =>
  ({
    id: 1,
    convId: 'c',
    type: 'text',
    timestamp: 1,
    role,
    content,
    parent: -1,
    children: [],
  }) as Message;

describe('writing a conversation out as markdown', () => {
  it('gives each turn a heading and its words', () => {
    const out = toMarkdown(
      [say('user', 'How do I centre a div?'), say('assistant', 'Use flexbox.')],
      labels
    );

    expect(out).toBe(
      '## You\n\nHow do I centre a div?\n\n## Assistant\n\nUse flexbox.'
    );
  });

  it('calls each side what the reader calls it', () => {
    const out = toMarkdown([say('user', 'hi')], {
      user: 'Вы',
      assistant: 'Ассистент',
    });

    expect(out).toContain('## Вы');
  });

  it('leaves out the system prompt', () => {
    const out = toMarkdown(
      [say('system', 'You are helpful.'), say('user', 'hi')],
      labels
    );

    // It is configuration rather than something either side said.
    expect(out).not.toContain('You are helpful.');
    expect(out).toContain('hi');
  });

  it('leaves out a turn that was never written', () => {
    const out = toMarkdown(
      [say('user', 'hi'), say('assistant', null), say('user', 'anyone?')],
      labels
    );

    // A heading with nothing under it says a turn happened when none did.
    expect(out.match(/## /g)).toHaveLength(2);
  });

  it('leaves out a turn that is only whitespace', () => {
    expect(toMarkdown([say('assistant', '   \n  ')], labels)).toBe('');
  });

  it('says nothing for an empty conversation', () => {
    expect(toMarkdown([], labels)).toBe('');
  });

  it('keeps markdown that was already in the message', () => {
    const out = toMarkdown(
      [say('assistant', '```js\nconst x = 1;\n```')],
      labels
    );

    expect(out).toContain('```js\nconst x = 1;\n```');
  });
});
