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

function add(message: string, level: ToastLevel, durationMs = 3500): void {
  const id = ++_seq;
  _store.update((list) => [...list, { id, message, level }]);
  setTimeout(() => _store.update((list) => list.filter((t) => t.id !== id)), durationMs);
}

export const toast = {
  info: (msg: string) => add(msg, 'info'),
  success: (msg: string) => add(msg, 'success'),
  error: (msg: string) => add(msg, 'error'),
};
