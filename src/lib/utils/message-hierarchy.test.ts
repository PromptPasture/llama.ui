import { describe, expect, it } from 'vitest';
import { getListMessageDisplay } from './message-hierarchy';
import type { Message } from '../types';

function msg(
  id: number,
  parent: number,
  children: number[],
  overrides: Partial<Message> = {}
): Message {
  return {
    id,
    convId: 'conv-1',
    type: 'text',
    timestamp: id,
    role: id % 2 === 1 ? 'user' : 'assistant',
    content: `m${id}`,
    parent,
    children,
    ...overrides,
  };
}

const root = (children: number[]) =>
  msg(0, -1, children, { type: 'root', role: 'system', content: '' });

/**
 * root
 *  └── 1 (user)
 *       ├── 2 (assistant)
 *       └── 4 (assistant)   <- a regeneration of 2
 */
const regenerated = [
  root([1]),
  msg(1, 0, [2, 4]),
  msg(2, 1, []),
  msg(4, 1, []),
];

describe('getListMessageDisplay', () => {
  it('returns nothing for an empty conversation', () => {
    expect(getListMessageDisplay([], -1)).toEqual([]);
  });

  it('omits the root node from the displayed list', () => {
    const list = getListMessageDisplay(regenerated, 2);
    expect(list.every((d) => d.msg.type !== 'root')).toBe(true);
  });

  it('walks the path from the chosen leaf back to the root, oldest first', () => {
    const list = getListMessageDisplay(regenerated, 2);
    expect(list.map((d) => d.msg.id)).toEqual([1, 2]);
  });

  it('reports the sibling position of the selected branch', () => {
    const list = getListMessageDisplay(regenerated, 2);
    const leaf = list.at(-1)!;
    expect(leaf.siblingCurrIdx).toBe(0);
    expect(leaf.siblingLeafNodeIds).toEqual([2, 4]);
  });

  it('reports the other branch when it is the one selected', () => {
    const list = getListMessageDisplay(regenerated, 4);
    expect(list.map((d) => d.msg.id)).toEqual([1, 4]);
    const leaf = list.at(-1)!;
    expect(leaf.siblingCurrIdx).toBe(1);
    expect(leaf.siblingLeafNodeIds).toEqual([2, 4]);
  });

  it('resolves a sibling to the deepest node of its branch, not the branch head', () => {
    /**
     * root
     *  └── 1
     *       ├── 2 ── 3      <- branch A continues
     *       └── 4 ── 5 ── 6 <- branch B continues further
     */
    const deep = [
      root([1]),
      msg(1, 0, [2, 4]),
      msg(2, 1, [3]),
      msg(3, 2, []),
      msg(4, 1, [5]),
      msg(5, 4, [6]),
      msg(6, 5, []),
    ];
    const list = getListMessageDisplay(deep, 3);
    const branchPoint = list.find((d) => d.msg.id === 2)!;
    expect(branchPoint.siblingLeafNodeIds).toEqual([3, 6]);
    expect(branchPoint.siblingCurrIdx).toBe(0);
  });

  it('tracks sibling branches hanging directly off the root', () => {
    /**
     * Editing the opening message forks at the root.
     *
     * root
     *  ├── 1 (user, original) ── 2
     *  └── 3 (user, edited)   ── 4
     */
    const edited = [
      root([1, 3]),
      msg(1, 0, [2]),
      msg(2, 1, []),
      msg(3, 0, [4]),
      msg(4, 3, []),
    ];
    const list = getListMessageDisplay(edited, 4);
    expect(list.map((d) => d.msg.id)).toEqual([3, 4]);
    const firstTurn = list[0];
    expect(firstTurn.siblingLeafNodeIds).toEqual([2, 4]);
    expect(firstTurn.siblingCurrIdx).toBe(1);
  });

  it('marks a single-child message as having exactly one sibling', () => {
    const linear = [root([1]), msg(1, 0, [2]), msg(2, 1, [])];
    const list = getListMessageDisplay(linear, 2);
    expect(list.map((d) => d.siblingLeafNodeIds.length)).toEqual([1, 1]);
    expect(list.every((d) => d.siblingCurrIdx === 0)).toBe(true);
  });

  it('falls back to the newest message when the leaf id is unknown', () => {
    const list = getListMessageDisplay(regenerated, 999);
    // message 4 carries the latest timestamp, so its branch is shown
    expect(list.map((d) => d.msg.id)).toEqual([1, 4]);
  });

  it('keeps the conversation in chronological order across several turns', () => {
    const chat = [
      root([1]),
      msg(1, 0, [2]),
      msg(2, 1, [3]),
      msg(3, 2, [4]),
      msg(4, 3, []),
    ];
    expect(getListMessageDisplay(chat, 4).map((d) => d.msg.id)).toEqual([
      1, 2, 3, 4,
    ]);
  });
});

describe('a message graph that loops back on itself', () => {
  /**
   * Two messages each claiming the other as parent and as child. An import
   * checks ids and conversation ids and nothing else, so a damaged or hostile
   * file can say this — and a walk with no end freezes the tab silently, on
   * that load and every load after it, since the file is now stored.
   */
  const looping = [
    {
      id: 1,
      convId: 'c',
      type: 'text',
      timestamp: 1,
      role: 'user',
      content: 'a',
      parent: 2,
      children: [2],
    },
    {
      id: 2,
      convId: 'c',
      type: 'text',
      timestamp: 2,
      role: 'assistant',
      content: 'b',
      parent: 1,
      children: [1],
    },
  ] as Message[];

  it('is walked to an end rather than for ever', () => {
    const shown = getListMessageDisplay(looping, 2);

    expect(Array.isArray(shown)).toBe(true);
  });

  it('shows each message at most once', () => {
    const ids = getListMessageDisplay(looping, 2).map((d) => d.msg.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('still shows a sound conversation in full', () => {
    const sound = [
      {
        id: 0,
        convId: 'c',
        type: 'root',
        timestamp: 0,
        role: 'system',
        content: '',
        parent: -1,
        children: [1],
      },
      {
        id: 1,
        convId: 'c',
        type: 'text',
        timestamp: 1,
        role: 'user',
        content: 'a',
        parent: 0,
        children: [2],
      },
      {
        id: 2,
        convId: 'c',
        type: 'text',
        timestamp: 2,
        role: 'assistant',
        content: 'b',
        parent: 1,
        children: [],
      },
    ] as Message[];

    expect(getListMessageDisplay(sound, 2).map((d) => d.msg.id)).toEqual([
      1, 2,
    ]);
  });
});

describe('a message stored without the fields the walk needs', () => {
  /**
   * Import now refuses these, but a file taken before it did could have
   * stored one — and that conversation should still open.
   */
  const missingChildren = [
    {
      id: 0,
      convId: 'c',
      type: 'root',
      timestamp: 0,
      role: 'system',
      content: '',
      parent: -1,
      children: [1],
    },
    {
      id: 1,
      convId: 'c',
      type: 'text',
      timestamp: 1,
      role: 'user',
      content: 'a',
      parent: 0,
    },
  ] as unknown as Message[];

  it('is shown rather than throwing while it is drawn', () => {
    expect(
      getListMessageDisplay(missingChildren, 1).map((d) => d.msg.id)
    ).toEqual([1]);
  });

  it('is shown when it is the parent whose children are missing', () => {
    const parentMissing = [
      {
        id: 0,
        convId: 'c',
        type: 'root',
        timestamp: 0,
        role: 'system',
        content: '',
        parent: -1,
      },
      {
        id: 1,
        convId: 'c',
        type: 'text',
        timestamp: 1,
        role: 'user',
        content: 'a',
        parent: 0,
        children: [],
      },
    ] as unknown as Message[];

    expect(
      getListMessageDisplay(parentMissing, 1).map((d) => d.msg.id)
    ).toEqual([1]);
  });
});
