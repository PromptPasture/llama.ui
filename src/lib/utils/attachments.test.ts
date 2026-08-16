import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetAllAttachments,
  readAttachments,
  writeAttachments,
  type PendingAttachment,
} from './attachments';

const file = (id: number, name: string): PendingAttachment => ({
  id,
  extra: { type: 'textFile', name, content: 'the contents' },
});

beforeEach(() => {
  forgetAllAttachments();
});

describe('attachments waiting to be sent', () => {
  it('reads back what was left attached', () => {
    writeAttachments('c1', [file(1, 'notes.txt')]);

    expect(readAttachments('c1')).toEqual([file(1, 'notes.txt')]);
  });

  it('keeps each conversation to itself', () => {
    writeAttachments('c1', [file(1, 'first.txt')]);
    writeAttachments('c2', [file(2, 'second.txt')]);

    expect(readAttachments('c1')).toEqual([file(1, 'first.txt')]);
    expect(readAttachments('c2')).toEqual([file(2, 'second.txt')]);
  });

  it('has nothing for a conversation nothing was attached to', () => {
    expect(readAttachments('c1')).toEqual([]);
  });

  it('keeps the welcome screen apart from the conversations', () => {
    writeAttachments(undefined, [file(1, 'before.txt')]);
    writeAttachments('c1', [file(2, 'after.txt')]);

    // The welcome screen has no conversation behind it, and its box must not
    // pick up whatever the last conversation was holding.
    expect(readAttachments(undefined)).toEqual([file(1, 'before.txt')]);
  });

  it('forgets what has been taken off again', () => {
    writeAttachments('c1', [file(1, 'notes.txt')]);

    writeAttachments('c1', []);

    expect(readAttachments('c1')).toEqual([]);
  });

  it('replaces rather than adds to what was there', () => {
    writeAttachments('c1', [file(1, 'first.txt')]);

    writeAttachments('c1', [file(2, 'second.txt')]);

    expect(readAttachments('c1')).toEqual([file(2, 'second.txt')]);
  });
});
