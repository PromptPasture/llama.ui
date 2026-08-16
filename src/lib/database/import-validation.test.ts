import { describe, expect, it } from 'vitest';
import IndexedDB from './indexedDB';

const validExport = () => [
  {
    table: 'conversations',
    rows: [
      {
        id: 'conv-1',
        name: 'A chat',
        lastModified: 1700000000000,
        currNode: -1,
      },
    ],
  },
  {
    table: 'messages',
    rows: [
      {
        id: 1,
        convId: 'conv-1',
        type: 'text',
        role: 'user',
        content: 'hi',
        parent: -1,
        children: [],
        timestamp: 1700000000000,
      },
    ],
  },
  { table: 'userConfigurations', rows: [] },
];

const check = (data: unknown) => () => IndexedDB.assertValidExport(data);

describe('accepting a genuine export', () => {
  it('accepts what exportDB produces', () => {
    expect(check(validExport())).not.toThrow();
  });

  it('accepts an export carrying only conversations', () => {
    expect(check([validExport()[0]])).not.toThrow();
  });
});

describe('rejecting files that are not exports', () => {
  it.each([
    ['an object', { a: 1 }],
    ['a bare string', 'hello'],
    ['a number', 42],
    ['null', null],
  ])('rejects %s', (_label, payload) => {
    expect(check(payload)).toThrow(/not a llama\.ui export/);
  });

  it('rejects an empty array, which would otherwise report success', () => {
    // Importing the wrong file used to say "Import completed" and do nothing.
    expect(check([])).toThrow(/no llama\.ui tables/);
  });

  it('rejects a file whose tables are all unknown', () => {
    expect(check([{ table: 'somethingElse', rows: [] }])).toThrow(
      /no llama\.ui tables/
    );
  });

  it('rejects records missing table or rows', () => {
    expect(check([{ rows: [] }])).toThrow(/not a llama\.ui export/);
    expect(check([{ table: 'conversations' }])).toThrow(
      /not a llama\.ui export/
    );
  });
});

describe('rejecting rows that would corrupt the database', () => {
  it('rejects a conversation with no name, which breaks sidebar search', () => {
    const data = [
      { table: 'conversations', rows: [{ id: 'c1', lastModified: 1 }] },
    ];
    expect(check(data)).toThrow(/malformed conversation/);
  });

  it('rejects a conversation with no lastModified, which cannot be grouped', () => {
    const data = [{ table: 'conversations', rows: [{ id: 'c1', name: 'x' }] }];
    expect(check(data)).toThrow(/malformed conversation/);
  });

  it('rejects a conversation whose id is not a string', () => {
    const data = [
      { table: 'conversations', rows: [{ id: 7, name: 'x', lastModified: 1 }] },
    ];
    expect(check(data)).toThrow(/malformed conversation/);
  });

  it('rejects a message not tied to a conversation', () => {
    const data = [{ table: 'messages', rows: [{ id: 1 }] }];
    expect(check(data)).toThrow(/malformed message/);
  });

  it('rejects a null row', () => {
    const data = [{ table: 'conversations', rows: [null] }];
    expect(check(data)).toThrow(/invalid row/);
  });
});
