import { render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Toast from './Toast.svelte';
import { readingTimeMs, toast, toastStore } from './toast.js';

afterEach(() => {
  vi.useRealTimers();
});

/** Drains any toasts left by a previous test. */
async function clear() {
  vi.useFakeTimers();
  vi.advanceTimersByTime(20000);
  vi.useRealTimers();
}

describe('how long a toast stays up', () => {
  it('keeps short confirmations brief', () => {
    expect(readingTimeMs('Database import completed.')).toBe(3500);
  });

  it('holds a long message long enough to read', () => {
    const guidance =
      "It looks like you don't have the models set up yet or there is an issue with your Provider. Let's go to the Settings to check.";
    // 26 words at roughly 200 wpm; the old fixed 3.5s cut it off part way.
    expect(readingTimeMs(guidance)).toBeGreaterThan(8000);
  });

  it('never lingers beyond ten seconds', () => {
    expect(readingTimeMs('word '.repeat(500))).toBe(10000);
  });

  it('dismisses itself once that time has passed', async () => {
    await clear();
    vi.useFakeTimers();
    toast.success('Database import completed.');
    expect(get(toastStore)).toHaveLength(1);

    vi.advanceTimersByTime(3499);
    expect(get(toastStore)).toHaveLength(1);

    vi.advanceTimersByTime(2);
    expect(get(toastStore)).toHaveLength(0);
  });
});

describe('how a toast is announced', () => {
  it('puts an error in an assertive region so it interrupts', async () => {
    await clear();
    render(Toast);
    toast.error('Failed to get response from AI.');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to get response from AI.');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('leaves a success in the polite region', async () => {
    await clear();
    render(Toast);
    toast.success('Preset is saved successfully.');

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Preset is saved successfully.');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(await screen.findByRole('alert')).not.toHaveTextContent(
      'Preset is saved successfully.'
    );
  });
});

// Minimal store reader, avoiding a svelte/store import just for this.
function get<T>(store: { subscribe: (run: (v: T) => void) => () => void }): T {
  let value!: T;
  store.subscribe((v) => (value = v))();
  return value;
}
