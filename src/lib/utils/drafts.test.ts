import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readDraft, writeDraft } from './drafts';

beforeEach(() => {
  localStorage.clear();
});

describe('keeping an unsent message', () => {
  it('reads back what was left in the box', () => {
    writeDraft('c1', 'half a thought');

    expect(readDraft('c1')).toBe('half a thought');
  });

  it('keeps each conversation to itself', () => {
    writeDraft('c1', 'for the first');
    writeDraft('c2', 'for the second');

    expect(readDraft('c1')).toBe('for the first');
    expect(readDraft('c2')).toBe('for the second');
  });

  it('has nothing for a conversation nothing was typed in', () => {
    expect(readDraft('c1')).toBe('');
  });

  it('keeps the welcome screen apart from the conversations', () => {
    writeDraft(undefined, 'a question with no conversation yet');
    writeDraft('c1', 'for the first');

    // The welcome screen has no conversation behind it, and its box must not
    // pick up whatever the last conversation was holding.
    expect(readDraft(undefined)).toBe('a question with no conversation yet');
  });

  it('forgets a draft that has been emptied', () => {
    writeDraft('c1', 'half a thought');

    writeDraft('c1', '');

    expect(readDraft('c1')).toBe('');
    // Sending clears the box on every conversation ever opened; keeping the
    // keys would grow the stored object without bound.
    expect(localStorage.getItem('drafts')).not.toContain('c1');
  });

  it('writes nothing at all when there was nothing to forget', () => {
    writeDraft('c1', '');

    expect(localStorage.getItem('drafts')).toBeNull();
  });
});

describe('storage that cannot be trusted', () => {
  it('has no drafts when the stored value is not JSON', () => {
    localStorage.setItem('drafts', 'not json at all');

    expect(readDraft('c1')).toBe('');
  });

  it('has no drafts when the stored value is the wrong shape', () => {
    localStorage.setItem('drafts', '["a list", "of things"]');

    expect(readDraft('c1')).toBe('');
  });

  it('ignores an entry that is not text', () => {
    localStorage.setItem('drafts', JSON.stringify({ c1: { not: 'text' } }));

    // Otherwise the box is handed an object and shows "[object Object]".
    expect(readDraft('c1')).toBe('');
  });

  it('keeps the sound entries alongside a bad one', () => {
    localStorage.setItem('drafts', JSON.stringify({ c1: 42, c2: 'kept' }));

    expect(readDraft('c2')).toBe('kept');
  });

  it('lets the writer carry on when storage refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    // This runs on every keystroke: a full or forbidden store is not worth
    // interrupting the writing for.
    expect(() => writeDraft('c1', 'half a thought')).not.toThrow();
    vi.restoreAllMocks();
  });

  it('lets the writer carry on when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });

    expect(readDraft('c1')).toBe('');
    vi.restoreAllMocks();
  });
});
