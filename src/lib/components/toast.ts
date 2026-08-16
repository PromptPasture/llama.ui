import { writable } from 'svelte/store';

export type ToastLevel = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  level: ToastLevel;
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

function add(
  message: string,
  level: ToastLevel,
  durationMs = readingTimeMs(message)
): void {
  const id = ++_seq;
  _store.update((list) => [...list, { id, message, level }]);
  setTimeout(
    () => _store.update((list) => list.filter((t) => t.id !== id)),
    durationMs
  );
}

export const toast = {
  info: (msg: string) => add(msg, 'info'),
  success: (msg: string) => add(msg, 'success'),
  error: (msg: string) => add(msg, 'error'),
};
