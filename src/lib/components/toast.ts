import { get, writable } from 'svelte/store';

export type ToastLevel = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  level: ToastLevel;
  /** How long it was given, so a paused one can be given it again. */
  durationMs: number;
}

const _store = writable<ToastItem[]>([]);
export const toastStore = { subscribe: _store.subscribe };

let _seq = 0;

/**
 * How long a message needs to be readable: a moment to notice the toast, plus
 * roughly 200 words per minute. Short confirmations keep the old 3.5s; the
 * longest message in the catalogue explains how to configure an inference
 * provider in 26 words, and used to disappear less than half way through.
 *
 * @param message The text being shown.
 * @returns A duration in milliseconds, between 3.5 and 10 seconds.
 */
export function readingTimeMs(message: string): number {
  const words = message.trim().split(/\s+/).length;
  return Math.min(Math.max(1000 + words * 300, 3500), 10000);
}

/** The countdown for each toast on screen, so it can be stopped and started. */
const _timers = new Map<number, ReturnType<typeof setTimeout>>();

function forget(id: number): void {
  const timer = _timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  _timers.delete(id);
  _store.update((list) => list.filter((t) => t.id !== id));
}

function countDown(id: number, durationMs: number): void {
  const existing = _timers.get(id);
  if (existing !== undefined) clearTimeout(existing);
  _timers.set(
    id,
    setTimeout(() => forget(id), durationMs)
  );
}

function add(
  message: string,
  level: ToastLevel,
  durationMs = readingTimeMs(message)
): void {
  const id = ++_seq;
  _store.update((list) => [...list, { id, message, level, durationMs }]);
  countDown(id, durationMs);
}

export const toast = {
  info: (msg: string) => add(msg, 'info'),
  success: (msg: string) => add(msg, 'success'),
  error: (msg: string) => add(msg, 'error'),

  /**
   * Takes one away before its time is up.
   *
   * An error is given up to ten seconds to be read, which is right for reading
   * it and long to sit over the corner of a conversation once it has been.
   *
   * @param id - Which one
   */
  dismiss(id: number): void {
    forget(id);
  },

  /**
   * Stops the countdown while the message is being read.
   *
   * It is focusable, so it can be tabbed to — and vanishing from under the
   * keyboard takes the reader's place with it. The same holds for a pointer
   * resting on a long failure.
   *
   * @param id - Which one
   */
  hold(id: number): void {
    const timer = _timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    _timers.delete(id);
  },

  /**
   * Starts the countdown again, from the beginning.
   *
   * Whatever was left of it when the reader arrived is not worth keeping
   * track of: they have just stopped reading, and a fresh moment to notice it
   * going is kinder than the remainder of a moment.
   *
   * @param id - Which one
   */
  release(id: number): void {
    const item = get(_store).find((t) => t.id === id);
    if (item) countDown(id, item.durationMs);
  },
};
