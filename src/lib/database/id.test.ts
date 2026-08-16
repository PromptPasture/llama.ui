import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextId } from './id';

afterEach(() => {
  vi.useRealTimers();
});

describe('issuing ids', () => {
  it('never repeats, however fast it is called', () => {
    const issued = Array.from({ length: 5000 }, () => nextId());

    expect(new Set(issued).size).toBe(issued.length);
  });

  it('keeps increasing', () => {
    const issued = Array.from({ length: 1000 }, () => nextId());

    for (let i = 1; i < issued.length; i++) {
      expect(issued[i]).toBeGreaterThan(issued[i - 1]);
    }
  });

  it('does not repeat when the clock stands still', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 1));

    // A conversation and its first message are created back to back, which is
    // exactly the case that used to land in the same millisecond.
    const a = nextId();
    const b = nextId();
    const c = nextId();

    expect(new Set([a, b, c]).size).toBe(3);
    expect(b).toBe(a + 1);
    expect(c).toBe(b + 1);
  });

  it('follows the clock forward once it has moved on', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2030, 0, 1));

    const first = nextId();
    vi.setSystemTime(new Date(2030, 0, 2));
    const later = nextId();

    expect(later).toBeGreaterThan(first);
    expect(later).toBe(new Date(2030, 0, 2).getTime());
  });

  it('stays ahead of a clock that steps backwards', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2031, 0, 2));
    const first = nextId();

    // Daylight saving, an NTP correction, or a user changing the clock.
    vi.setSystemTime(new Date(2031, 0, 1));
    const afterStepBack = nextId();

    expect(afterStepBack).toBeGreaterThan(first);
  });
});
