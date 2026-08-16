import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { groupConversationsByDate } from './conversation-grouper';
import type { Conversation } from '../types';

// Dates are built with local-time constructors, matching the grouper's own use
// of getFullYear/getMonth/getDate, so the expectations hold in any timezone.
const NOW = new Date(2024, 2, 15, 12, 0, 0); // 15 March 2024, midday

function conv(id: string, at: Date): Conversation {
  return { id, lastModified: at.getTime(), currNode: -1, name: id };
}

const titles = (groups: { title?: string }[]) => groups.map((g) => g.title);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('groupConversationsByDate', () => {
  it('returns nothing for an empty list', () => {
    expect(groupConversationsByDate([], 'en')).toEqual([]);
  });

  it('places a conversation from earlier today under Today', () => {
    const groups = groupConversationsByDate(
      [conv('a', new Date(2024, 2, 15, 8))],
      'en'
    );
    expect(titles(groups)).toEqual(['Today']);
  });

  it('separates yesterday from today', () => {
    const groups = groupConversationsByDate(
      [
        conv('today', new Date(2024, 2, 15, 1)),
        conv('yest', new Date(2024, 2, 14, 23)),
      ],
      'en'
    );
    expect(titles(groups)).toEqual(['Today', 'Yesterday']);
    expect(groups[1].conversations.map((c) => c.id)).toEqual(['yest']);
  });

  it('buckets the last week and month', () => {
    const groups = groupConversationsByDate(
      [
        conv('week', new Date(2024, 2, 12)),
        conv('month', new Date(2024, 1, 24)),
      ],
      'en'
    );
    expect(titles(groups)).toEqual(['Previous 7 Days', 'Previous 30 Days']);
  });

  it('falls back to month and year beyond thirty days', () => {
    const groups = groupConversationsByDate(
      [conv('jan', new Date(2024, 0, 15)), conv('dec', new Date(2023, 11, 6))],
      'en'
    );
    expect(titles(groups)).toEqual(['January 2024', 'December 2023']);
  });

  it('orders month groups newest first', () => {
    const groups = groupConversationsByDate(
      [
        conv('nov', new Date(2023, 10, 5)),
        conv('jan', new Date(2024, 0, 15)),
        conv('dec', new Date(2023, 11, 6)),
      ],
      'en'
    );
    expect(titles(groups)).toEqual([
      'January 2024',
      'December 2023',
      'November 2023',
    ]);
  });

  it('orders relative groups before month groups', () => {
    const groups = groupConversationsByDate(
      [
        conv('old', new Date(2024, 0, 15)),
        conv('today', new Date(2024, 2, 15, 9)),
        conv('month', new Date(2024, 1, 24)),
        conv('yest', new Date(2024, 2, 14, 10)),
        conv('week', new Date(2024, 2, 11)),
      ],
      'en'
    );
    expect(titles(groups)).toEqual([
      'Today',
      'Yesterday',
      'Previous 7 Days',
      'Previous 30 Days',
      'January 2024',
    ]);
  });

  it('sorts most recently modified first within a group', () => {
    const groups = groupConversationsByDate(
      [
        conv('older', new Date(2024, 2, 15, 8)),
        conv('newer', new Date(2024, 2, 15, 11)),
        conv('oldest', new Date(2024, 2, 15, 2)),
      ],
      'en'
    );
    expect(groups[0].conversations.map((c) => c.id)).toEqual([
      'newer',
      'older',
      'oldest',
    ]);
  });

  it('omits groups that have no conversations', () => {
    const groups = groupConversationsByDate(
      [conv('a', new Date(2024, 2, 15, 8))],
      'en'
    );
    expect(groups).toHaveLength(1);
  });

  it('does not mutate the array it is given', () => {
    const input = [
      conv('a', new Date(2024, 2, 10)),
      conv('b', new Date(2024, 2, 15, 8)),
    ];
    const order = input.map((c) => c.id);
    groupConversationsByDate(input, 'en');
    expect(input.map((c) => c.id)).toEqual(order);
  });

  it('orders month groups correctly under a non-English locale', () => {
    const groups = groupConversationsByDate(
      [conv('jan', new Date(2024, 0, 15)), conv('dec', new Date(2023, 11, 6))],
      'de'
    );
    // Whatever the month is called, January 2024 must precede December 2023.
    expect(groups.map((g) => g.conversations[0].id)).toEqual(['jan', 'dec']);
  });
});
