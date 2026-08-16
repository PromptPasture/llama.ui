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
