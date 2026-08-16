import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CHANNEL_NAME = 'llama-ui:conversations';

type Listener = (message: { data: string }) => void;

/**
 * Stands in for the browser's BroadcastChannel, which jsdom does not provide.
 * Deliberately does not echo a posted message back to its sender, which is how
 * the real one behaves.
 */
class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  posted: string[] = [];
  private listeners: Listener[] = [];

  constructor(public name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(data: string) {
    this.posted.push(data);
  }

  addEventListener(type: string, listener: Listener) {
    if (type === 'message') this.listeners.push(listener);
  }

  close() {}

  /** Delivers what some other tab has just sent. */
  receive(data: string) {
    for (const listener of this.listeners) listener({ data });
  }
}

let channel: FakeBroadcastChannel;
let IndexedDB: typeof import('./indexedDB').default;

beforeEach(async () => {
  FakeBroadcastChannel.instances = [];
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
  // The channel is opened as the module loads, so the stub has to be in place
  // before it is imported.
  vi.resetModules();
  IndexedDB = (await import('./indexedDB')).default;
  // Dexie opens a channel of its own, so pick ours out by name.
  channel = FakeBroadcastChannel.instances.filter(
    (c) => c.name === CHANNEL_NAME
  )[0];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('telling the other tabs', () => {
  it('opens exactly one channel of its own', () => {
    expect(
      FakeBroadcastChannel.instances.filter((c) => c.name === CHANNEL_NAME)
    ).toHaveLength(1);
  });

  it('announces a new conversation', async () => {
    const conv = await IndexedDB.createConversation('Bread recipe');

    expect(channel.posted).toContain(conv.id);
  });

  it('announces a deleted one', async () => {
    const conv = await IndexedDB.createConversation('Bread recipe');
    channel.posted.length = 0;

    await IndexedDB.deleteConversation(conv.id);

    // Otherwise the other tab keeps it listed and offers to open something
    // that is no longer there.
    expect(channel.posted).toContain(conv.id);
  });
});

describe('hearing from another tab', () => {
  it('passes the change on to whatever is listening here', () => {
    const changed = vi.fn();
    IndexedDB.onConversationChanged(changed);

    channel.receive('conv-from-elsewhere');

    // The sidebar reloads the list on this; without it, the other tab's work
    // stays invisible until a reload.
    expect(changed).toHaveBeenCalledWith('conv-from-elsewhere');
    IndexedDB.offConversationChanged(changed);
  });

  it('does not send it straight back', () => {
    channel.receive('conv-from-elsewhere');

    // Announcing what we were told would bounce between the tabs forever.
    expect(channel.posted).toHaveLength(0);
  });
});

describe('a browser without BroadcastChannel', () => {
  it('still works within the tab that made the change', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.resetModules();
    const Isolated = (await import('./indexedDB')).default;
    const changed = vi.fn();
    Isolated.onConversationChanged(changed);

    const conv = await Isolated.createConversation('Bread recipe');

    expect(changed).toHaveBeenCalledWith(conv.id);
    Isolated.offConversationChanged(changed);
  });
});
