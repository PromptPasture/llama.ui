import { describe, expect, it } from 'vitest';
import { historyToMarkdown } from './history-markdown';
import type { Conversation, Message } from '$lib/types';

const labels = { user: 'You', assistant: 'Assistant' };

const conv = (name: string): Conversation =>
  ({ id: name, name, lastModified: 1, currNode: -1 }) as Conversation;

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

describe('writing the whole history out', () => {
  it('gives each conversation a heading above its turns', () => {
    const out = historyToMarkdown(
      [
        {
          conv: conv('Bread recipe'),
          messages: [say('user', 'how much yeast')],
        },
      ],
      labels
    );

    expect(out).toBe('# Bread recipe\n\n## You\n\nhow much yeast');
  });

  it('keeps the conversations apart', () => {
    const out = historyToMarkdown(
      [
        { conv: conv('First'), messages: [say('user', 'one')] },
        { conv: conv('Second'), messages: [say('user', 'two')] },
      ],
      labels
    );

    // A rule between them, so one does not read as a continuation of the
    // last.
    expect(out).toContain('# First');
    expect(out).toContain('\n\n---\n\n');
    expect(out).toContain('# Second');
  });

  it('keeps them in the order they were given', () => {
    const out = historyToMarkdown(
      [
        { conv: conv('Newer'), messages: [say('user', 'a')] },
        { conv: conv('Older'), messages: [say('user', 'b')] },
      ],
      labels
    );

    expect(out.indexOf('# Newer')).toBeLessThan(out.indexOf('# Older'));
  });

  it('leaves out a conversation with nothing said in it', () => {
    const out = historyToMarkdown(
      [
        { conv: conv('Empty'), messages: [] },
        { conv: conv('Real'), messages: [say('user', 'a')] },
      ],
      labels
    );

    // A heading with nothing under it says a conversation happened that has
    // nothing in it.
    expect(out).not.toContain('# Empty');
    expect(out).toContain('# Real');
  });

  it('calls each side what the reader calls it', () => {
    const out = historyToMarkdown(
      [{ conv: conv('Хлеб'), messages: [say('user', 'сколько дрожжей')] }],
      { user: 'Вы', assistant: 'Ассистент' }
    );

    expect(out).toContain('## Вы');
  });

  it('says nothing for an empty history', () => {
    expect(historyToMarkdown([], labels)).toBe('');
  });
});
