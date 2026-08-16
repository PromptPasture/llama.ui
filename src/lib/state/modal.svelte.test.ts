import { beforeEach, describe, expect, it } from 'vitest';
import { modal } from './modal.svelte';

beforeEach(() => {
  // Answer anything left over, so each test starts with nothing on screen.
  // Bounded: a respond() that fails to advance would otherwise spin here
  // rather than fail the test that broke it.
  for (let i = 0; modal.current && i < 20; i++) modal.respond(undefined);
});

describe('asking one question', () => {
  it('shows it', () => {
    void modal.showConfirm('Delete everything?');

    expect(modal.current?.type).toBe('confirm');
    expect(modal.current?.message).toBe('Delete everything?');
  });

  it('answers the caller', async () => {
    const answer = modal.showConfirm('Delete everything?');

    modal.respond(true);

    expect(await answer).toBe(true);
    expect(modal.current).toBeNull();
  });

  it('returns what was typed into a prompt', async () => {
    const answer = modal.showPrompt('New name', 'Old name');
    expect(modal.current?.defaultValue).toBe('Old name');

    modal.respond('A better name');

    expect(await answer).toBe('A better name');
  });
});

describe('asking a second question while the first is unanswered', () => {
  it('leaves the first one on screen', () => {
    void modal.showConfirm('Discard your changes?');
    void modal.showConfirm('A new version is ready. Reload?');

    // Replacing it would take the question away mid-read and answer nothing.
    expect(modal.current?.message).toBe('Discard your changes?');
  });

  it('answers the first, then shows the second', async () => {
    const first = modal.showConfirm('Discard your changes?');
    const second = modal.showConfirm('A new version is ready. Reload?');

    modal.respond(false);
    expect(await first).toBe(false);
    expect(modal.current?.message).toBe('A new version is ready. Reload?');

    modal.respond(true);
    expect(await second).toBe(true);
  });

  it('loses neither answer', async () => {
    // A displaced question used to resolve never, so anything awaiting it —
    // a navigation held back pending an answer, say — waited for ever.
    const first = modal.showConfirm('Discard your changes?');
    const second = modal.showPrompt('New name');

    modal.respond(true);
    modal.respond('typed');

    expect(await Promise.all([first, second])).toEqual([true, 'typed']);
  });

  it('has nothing left on screen once both are answered', () => {
    void modal.showConfirm('One?');
    void modal.showAlert('Two');

    modal.respond(true);
    modal.respond(undefined);

    expect(modal.current).toBeNull();
  });
});

describe('answering when nothing was asked', () => {
  it('does nothing', () => {
    expect(() => modal.respond(true)).not.toThrow();
    expect(modal.current).toBeNull();
  });
});

describe('wording the buttons of a confirm', () => {
  it('carries the wording it was given', () => {
    void modal.showConfirm('Set up a provider?', {
      confirm: 'Open Settings',
      cancel: 'Skip',
    });

    expect(modal.current?.labels).toEqual({
      confirm: 'Open Settings',
      cancel: 'Skip',
    });
  });

  it('carries none when none was given', () => {
    void modal.showConfirm('Delete everything?');

    // The host falls back to its own translated pair.
    expect(modal.current?.labels).toBeUndefined();
  });
});
