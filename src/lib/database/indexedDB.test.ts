import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import IndexedDB from './indexedDB';
import type { ExportJsonStructure, Message } from '../types';

beforeAll(() => {
  // The legacy migration is covered separately; keep it out of the way here.
  localStorage.setItem('migratedToIDB', '1');
});

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

// Message ids are unique across the whole store, and the app derives them from
// Date.now(). Tests run inside the same millisecond, so they need their own
// counter to avoid colliding with each other.
let nextId = 1_000_000;

/** Builds a conversation whose messages form a single chain from the root. */
async function chat(name: string, turns: string[]) {
  const conv = await IndexedDB.createConversation(name);
  const ids: number[] = [];
  let parent = conv.currNode;
  for (const content of turns) {
    const id = ++nextId;
    await IndexedDB.appendMsg(
      {
        id,
        convId: conv.id,
        type: 'text',
        timestamp: id,
        role: ids.length % 2 === 0 ? 'user' : 'assistant',
        content,
        parent,
        children: [],
      } as Message,
      parent
    );
    ids.push(id);
    parent = id;
  }
  return { conv, ids };
}

const byId = (msgs: readonly Message[], id: number) =>
  msgs.find((m) => m.id === id)!;

describe('creating a conversation', () => {
  it('starts it with a root message', async () => {
    const conv = await IndexedDB.createConversation('First');
    const msgs = await IndexedDB.getMessages(conv.id);

    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ type: 'root', parent: -1, children: [] });
    expect(conv.currNode).toBe(msgs[0].id);
  });

  it('lists conversations with the most recent first', async () => {
    const older = await IndexedDB.createConversation('Older');
    await new Promise((r) => setTimeout(r, 5));
    const newer = await IndexedDB.createConversation('Newer');

    const all = await IndexedDB.getAllConversations();
    const positions = all.map((c) => c.id);

    expect(positions.indexOf(newer.id)).toBeLessThan(
      positions.indexOf(older.id)
    );
  });
});

describe('appending a message', () => {
  it('links it to its parent in both directions', async () => {
    const { conv, ids } = await chat('Linking', ['hello', 'hi there']);
    const msgs = await IndexedDB.getMessages(conv.id);

    const root = msgs.find((m) => m.type === 'root')!;
    expect(byId(msgs, ids[0]).parent).toBe(root.id);
    expect(byId(msgs, root.id).children).toContain(ids[0]);
    expect(byId(msgs, ids[1]).parent).toBe(ids[0]);
    expect(byId(msgs, ids[0]).children).toContain(ids[1]);
  });

  it('moves the conversation to the newly added message', async () => {
    const { conv, ids } = await chat('Current node', ['a', 'b']);
    const stored = await IndexedDB.getOneConversation(conv.id);

    expect(stored?.currNode).toBe(ids.at(-1));
  });

  it('refuses a parent that does not exist', async () => {
    const conv = await IndexedDB.createConversation('Orphan');

    await expect(
      IndexedDB.appendMsg(
        {
          id: 999999,
          convId: conv.id,
          type: 'text',
          timestamp: 1,
          role: 'user',
          content: 'x',
          parent: 123,
          children: [],
        } as Message,
        123
      )
    ).rejects.toThrow(/does not exist/);
  });
});

describe('deleting a message', () => {
  it('removes it together with everything below it', async () => {
    const { conv, ids } = await chat('Deleting', ['one', 'two', 'three']);
    const before = await IndexedDB.getMessages(conv.id);

    await IndexedDB.deleteMessage(byId(before, ids[1]));
    const after = await IndexedDB.getMessages(conv.id);

    expect(after.map((m) => m.id)).toContain(ids[0]);
    expect(after.map((m) => m.id)).not.toContain(ids[1]);
    expect(after.map((m) => m.id)).not.toContain(ids[2]);
  });

  it('takes the deleted child out of its parent', async () => {
    const { conv, ids } = await chat('Rewiring', ['one', 'two']);
    const before = await IndexedDB.getMessages(conv.id);

    await IndexedDB.deleteMessage(byId(before, ids[1]));
    const after = await IndexedDB.getMessages(conv.id);

    // A dangling child id would break the tree walk that renders the thread.
    expect(byId(after, ids[0]).children).not.toContain(ids[1]);
  });

  it('moves the conversation back to the parent when the current node goes', async () => {
    const { conv, ids } = await chat('Current node moves', ['one', 'two']);
    const before = await IndexedDB.getMessages(conv.id);

    await IndexedDB.deleteMessage(byId(before, ids[1]));
    const stored = await IndexedDB.getOneConversation(conv.id);

    expect(stored?.currNode).toBe(ids[0]);
  });

  it('refuses a message from another conversation', async () => {
    const a = await chat('A', ['one']);
    const b = await chat('B', ['one']);
    const bMsgs = await IndexedDB.getMessages(b.conv.id);

    await expect(
      IndexedDB.deleteMessage({
        ...byId(bMsgs, b.ids[0]),
        convId: a.conv.id,
      })
    ).rejects.toThrow(/not found/);
  });
});

describe('branching a conversation', () => {
  it('copies the path up to the chosen message under fresh ids', async () => {
    const { conv, ids } = await chat('Branching', ['one', 'two', 'three']);

    const branch = await IndexedDB.branchConversation(
      conv.id,
      ids[1],
      'A branch'
    );
    const copied = await IndexedDB.getMessages(branch.id);

    // root plus the first two turns; the third is past the branch point.
    // getMessages promises no particular order, so compare as a set.
    expect(copied).toHaveLength(3);
    expect(copied.map((m) => m.content).sort()).toEqual(['', 'one', 'two']);
    expect(copied.every((m) => !ids.includes(m.id))).toBe(true);
  });

  it('rewires the copy so the chain still holds together', async () => {
    const { conv, ids } = await chat('Branch links', ['one', 'two']);

    const branch = await IndexedDB.branchConversation(
      conv.id,
      ids[1],
      'A branch'
    );
    const copied = await IndexedDB.getMessages(branch.id);

    const root = copied.find((m) => m.type === 'root')!;
    const first = copied.find((m) => m.content === 'one')!;
    const second = copied.find((m) => m.content === 'two')!;

    expect(root.parent).toBe(-1);
    expect(first.parent).toBe(root.id);
    expect(root.children).toEqual([first.id]);
    expect(second.parent).toBe(first.id);
    expect(copied.every((m) => m.convId === branch.id)).toBe(true);
  });

  it('leaves the original conversation untouched', async () => {
    const { conv, ids } = await chat('Original intact', ['one', 'two']);
    const before = await IndexedDB.getMessages(conv.id);

    await IndexedDB.branchConversation(conv.id, ids[1], 'A branch');
    const after = await IndexedDB.getMessages(conv.id);

    expect(after).toHaveLength(before.length);
    expect(after.map((m) => m.id).sort()).toEqual(
      before.map((m) => m.id).sort()
    );
  });

  it('refuses a message that is not in the conversation', async () => {
    const { conv } = await chat('Bad branch', ['one']);

    await expect(
      IndexedDB.branchConversation(conv.id, 424242, 'A branch')
    ).rejects.toThrow(/not found/);
  });
});

describe('exporting and importing', () => {
  it('round-trips a conversation through its own export', async () => {
    const { conv } = await chat('Round trip', ['one', 'two']);
    const exported = await IndexedDB.exportDB(conv.id);

    // The importer validates; its own exporter must satisfy that.
    expect(() => IndexedDB.assertValidExport(exported)).not.toThrow();
    await expect(IndexedDB.importDB(exported)).resolves.not.toThrow();
  });

  it('restores a conversation that was deleted', async () => {
    const { conv } = await chat('Restore me', ['one']);
    const exported = await IndexedDB.exportDB(conv.id);

    await IndexedDB.deleteConversation(conv.id);
    expect(await IndexedDB.getOneConversation(conv.id)).toBeNull();

    await IndexedDB.importDB(exported);

    expect(await IndexedDB.getOneConversation(conv.id)).toMatchObject({
      name: 'Restore me',
    });
  });
});

describe('searching the conversations', () => {
  // The store outlives each test in this file, and these assertions are about
  // exactly which conversations come back.
  beforeEach(async () => {
    for (const conv of await IndexedDB.getAllConversations()) {
      await IndexedDB.deleteConversation(conv.id);
    }
  });

  const names = async (term: string) =>
    (await IndexedDB.searchConversations(term)).map((m) => m.conv.name);

  it('finds one by its name', async () => {
    await chat('Bread recipe', ['how much yeast']);
    await chat('Rust borrow checker', ['what is a lifetime']);

    expect(await names('bread')).toEqual(['Bread recipe']);
  });

  it('finds one by something said inside it', async () => {
    await chat('Bread recipe', ['how much yeast']);
    await chat('Rust borrow checker', ['what is a lifetime']);

    // A name is only the opening message trimmed, so searching names alone
    // finds a conversation by how it began and never by where it went.
    expect(await names('lifetime')).toEqual(['Rust borrow checker']);
  });

  it('ignores case on both sides', async () => {
    await chat('Bread recipe', ['Sourdough STARTER']);

    expect(await names('sourdough starter')).toEqual(['Bread recipe']);
    expect(await names('BREAD')).toEqual(['Bread recipe']);
  });

  it('lists a conversation once when the name and a message both match', async () => {
    await chat('Bread recipe', ['more bread please', 'and bread again']);

    expect(await names('bread')).toEqual(['Bread recipe']);
  });

  it('finds nothing for a term nobody used', async () => {
    await chat('Bread recipe', ['how much yeast']);

    expect(await names('quantum')).toEqual([]);
  });

  it('returns everything for a blank search', async () => {
    await chat('Bread recipe', ['how much yeast']);
    await chat('Rust borrow checker', ['what is a lifetime']);

    expect((await names('   ')).sort()).toEqual([
      'Bread recipe',
      'Rust borrow checker',
    ]);
  });

  it('is not upset by an imported message with no text in it', async () => {
    await chat('Bread recipe', ['how much yeast']);
    // Import checks a message's id and convId and nothing else, so a file can
    // put anything at all in content. This pins the outcome — the search still
    // answers — rather than the type check that guards it, which cannot be
    // shown to be load-bearing here: removing it does not fail this test.
    await IndexedDB.importDB([
      {
        table: 'conversations',
        rows: [{ id: 'imported', name: 'From a file', lastModified: 1 }],
      },
      {
        table: 'messages',
        rows: [{ id: ++nextId, convId: 'imported', content: null }],
      },
    ] as unknown as ExportJsonStructure);

    expect(await names('yeast')).toEqual(['Bread recipe']);
  });
});

describe('what a search result says about the match', () => {
  beforeEach(async () => {
    for (const conv of await IndexedDB.getAllConversations()) {
      await IndexedDB.deleteConversation(conv.id);
    }
  });

  it('carries the text around a match found inside', async () => {
    await chat('Bread recipe', ['Let the sourdough starter rest overnight.']);

    const [match] = await IndexedDB.searchConversations('starter');

    expect(match.excerpt).toContain('sourdough starter rest');
  });

  it('says which message the words were found in', async () => {
    await chat('Bread recipe', [
      'first message',
      'Let the sourdough starter rest overnight.',
    ]);

    const [match] = await IndexedDB.searchConversations('starter');

    // Without it, opening a result lands at the end of a long conversation
    // the reader must then search through by eye.
    const messages = await IndexedDB.getMessages(match.conv.id);
    const found = messages.find((m) => m.id === match.messageId);
    expect(found?.content).toContain('sourdough starter');
  });

  it('carries no message when the name is what matched', async () => {
    await chat('Bread recipe', ['more bread please']);

    const [match] = await IndexedDB.searchConversations('bread');

    expect(match.messageId).toBeUndefined();
  });

  it('carries nothing when the name is what matched', async () => {
    // The messages mention it too, so finding no excerpt is a decision rather
    // than an absence of anything to quote.
    await chat('Bread recipe', ['more bread please']);

    const [match] = await IndexedDB.searchConversations('bread');

    // Repeating the name underneath the name says nothing.
    expect(match.excerpt).toBeUndefined();
  });

  it('quotes the first match, not the last', async () => {
    await chat('Notes', ['first mention of docker', 'second one about docker']);

    const [match] = await IndexedDB.searchConversations('docker');

    expect(match.excerpt).toContain('first mention');
  });
});

describe('naming a branch', () => {
  it('calls it whatever it was told to', async () => {
    const { conv, ids } = await chat('Bread recipe', ['one', 'two']);

    const branch = await IndexedDB.branchConversation(
      conv.id,
      ids[1],
      'パン のレシピ - 分岐'
    );

    // The name is written into the database and read by whoever opens the
    // conversation, so it belongs in their language; this layer knows nothing
    // about languages and is handed the finished name.
    expect(branch.name).toBe('パン のレシピ - 分岐');
  });
});
