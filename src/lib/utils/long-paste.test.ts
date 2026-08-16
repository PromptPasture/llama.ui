import { describe, expect, it } from 'vitest';
import { isLongPaste } from './long-paste';

describe('deciding what to do with a paste', () => {
  it('leaves a short one in the box', () => {
    expect(isLongPaste('a stack trace, but a short one', 100)).toBe(false);
  });

  it('attaches one past the limit', () => {
    expect(isLongPaste('x'.repeat(101), 100)).toBe(true);
  });

  it('leaves one exactly at the limit alone', () => {
    expect(isLongPaste('x'.repeat(100), 100)).toBe(false);
  });

  it('is turned off by a limit of zero', () => {
    // What the setting says: 0 disables it, so every paste goes in the box.
    expect(isLongPaste('x'.repeat(100000), 0)).toBe(false);
  });

  it('is turned off by a negative limit', () => {
    // A stored configuration can hold any number; a negative one must not
    // mean "attach everything, including the empty string".
    expect(isLongPaste('', -1)).toBe(false);
  });

  it('has nothing to attach for an empty paste', () => {
    expect(isLongPaste('', 100)).toBe(false);
  });
});
