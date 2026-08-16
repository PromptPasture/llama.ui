import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrationLStoIDB } from './migration';
import type { Database } from '../types';

const FLAG = 'migratedToIDB';

interface Added {
  conversations: unknown[];
  messages: unknown[];
}

/** A stand-in for the Dexie database, recording what the migration writes. */
function fakeDb(opts: { failOn?: 'conversation' } = {}) {
  const added: Added = { conversations: [], messages: [] };
  const db = {
    conversations: {
      add: vi.fn(async (row: unknown) => {
        if (opts.failOn === 'conversation') throw new Error('constraint');
        added.conversations.push(row);
      }),
    },
    messages: {
      add: vi.fn(async (row: unknown) => {
        added.messages.push(row);
      }),
    },
    transaction: vi.fn(
      async (_mode: string, _t1: unknown, _t2: unknown, fn: () => unknown) =>
        fn()
    ),
  };
  return { db: db as unknown as Database, added };
}

const legacy = (id: string, messages: unknown[]) =>
  JSON.stringify({ id, lastModified: 1700000000000, messages });

const pair = (a: number) => [
  { id: a, role: 'user', content: 'question' },
  { id: a + 1, role: 'assistant', content: 'answer' },
];

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('deciding whether to run', () => {
  it('does nothing once the flag is set', async () => {
    localStorage.setItem(FLAG, '1');
    localStorage.setItem('conv-1', legacy('conv-1', pair(10)));
    const { db, added } = fakeDb();

    await migrationLStoIDB(db);

    expect(added.conversations).toHaveLength(0);
  });

  it('leaves the flag unset when there is nothing to migrate', async () => {
    const { db } = fakeDb();
    await migrationLStoIDB(db);
    expect(localStorage.getItem(FLAG)).toBeNull();
  });

  it('ignores keys that are not conversations', async () => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('config', '{}');
    const { db, added } = fakeDb();

    await migrationLStoIDB(db);

    expect(added.conversations).toHaveLength(0);
  });
});

describe('migrating legacy conversations', () => {
  it('moves a conversation and its messages, adding a root node', async () => {
    localStorage.setItem('conv-1', legacy('conv-1', pair(10)));
    const { db, added } = fakeDb();

    await migrationLStoIDB(db);

    expect(added.conversations).toHaveLength(1);
    // one root plus the two legacy messages
    expect(added.messages).toHaveLength(3);
    expect(added.messages[0]).toMatchObject({ type: 'root', parent: -1 });
    expect(localStorage.getItem(FLAG)).toBe('1');
  });

  it('chains each message to the one before it', async () => {
    localStorage.setItem('conv-1', legacy('conv-1', pair(10)));
    const { db, added } = fakeDb();

    await migrationLStoIDB(db);

    const [root, first, second] = added.messages as Array<{
      id: number;
      parent: number;
      children: number[];
    }>;
    expect(first.parent).toBe(root.id);
    expect(root.children).toEqual([first.id]);
    expect(second.parent).toBe(first.id);
    expect(second.children).toEqual([]);
  });
});

describe('surviving a bad localStorage entry', () => {
  it('skips an entry of the wrong shape and migrates the rest', async () => {
    localStorage.setItem('conv-1', legacy('conv-1', pair(10)));
    localStorage.setItem('conv-broken', JSON.stringify({ note: 'not one' }));
    localStorage.setItem('conv-2', legacy('conv-2', pair(20)));
    const { db, added } = fakeDb();

    await migrationLStoIDB(db);

    // One bad entry used to throw inside the transaction, roll everything
    // back, and leave the flag unset — so it failed again on every load and
    // the legacy conversations never appeared.
    expect(added.conversations).toHaveLength(2);
    expect(localStorage.getItem(FLAG)).toBe('1');
  });

  it('skips an entry whose messages are not an array', async () => {
    localStorage.setItem(
      'conv-odd',
      JSON.stringify({ id: 'conv-odd', lastModified: 1, messages: 'nope' })
    );
    localStorage.setItem('conv-1', legacy('conv-1', pair(10)));
    const { db, added } = fakeDb();

    await migrationLStoIDB(db);

    expect(added.conversations).toHaveLength(1);
  });

  it('skips an entry holding a malformed message', async () => {
    localStorage.setItem('conv-bad', legacy('conv-bad', [{ id: 1 }, {}]));
    localStorage.setItem('conv-1', legacy('conv-1', pair(10)));
    const { db, added } = fakeDb();

    await migrationLStoIDB(db);

    expect(added.conversations).toHaveLength(1);
  });

  it('skips unparsable JSON', async () => {
    localStorage.setItem('conv-junk', '{not json');
    localStorage.setItem('conv-1', legacy('conv-1', pair(10)));
    const { db, added } = fakeDb();

    await migrationLStoIDB(db);

    expect(added.conversations).toHaveLength(1);
  });

  it('does not claim success when the write fails', async () => {
    localStorage.setItem('conv-1', legacy('conv-1', pair(10)));
    const { db } = fakeDb({ failOn: 'conversation' });

    await migrationLStoIDB(db);

    // Leaving the flag unset is what allows a later attempt to succeed.
    expect(localStorage.getItem(FLAG)).toBeNull();
  });
});
