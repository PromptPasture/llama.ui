import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOneConversation: vi.fn(),
  getMessages: vi.fn().mockResolvedValue([]),
  onConversationChanged: vi.fn(),
}));

vi.mock('$lib/database/indexedDB', () => ({ default: mocks }));

const { chat } = await import('./chat.svelte');

// Set the locale explicitly rather than through initI18n(), which picks its
// initial locale from navigator.language and is not deterministic here.
beforeAll(async () => {
  register('en', () => import('../i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

function deps(overrides: Record<string, unknown> = {}) {
  return {
    config: {} as never,
    provider: null,
    selectedModel: null,
    navigate: vi.fn(),
    toast: vi.fn(),
    ...overrides,
  };
}

describe('loading a conversation', () => {
  it('reports that a missing conversation was not found', async () => {
    mocks.getOneConversation.mockResolvedValueOnce(undefined);

    // A stale link or a deleted conversation must be distinguishable from an
    // empty one, or the page silently renders as a normal blank chat.
    await expect(chat.loadConversation('gone')).resolves.toBe(false);
    expect(chat.viewingChat).toBeNull();
  });

  it('reports success and exposes the conversation when it exists', async () => {
    mocks.getOneConversation.mockResolvedValueOnce({
      id: 'conv-1',
      name: 'Kept',
      lastModified: 1,
      currNode: -1,
    });

    await expect(chat.loadConversation('conv-1')).resolves.toBe(true);
    expect(chat.viewingChat?.conv.name).toBe('Kept');
  });
});

describe('generating with nothing configured', () => {
  it('tells the user instead of failing silently', async () => {
    const d = deps();

    await chat._generate(
      { convId: 'conv-1', leafNodeId: 1, onChunk: () => {} },
      d as never
    );

    // Out of the box baseUrl is empty, so no provider is built. A new user
    // would otherwise send a message and simply never get a reply.
    expect(d.toast).toHaveBeenCalledTimes(1);
    expect(d.toast).toHaveBeenCalledWith(
      expect.stringContaining("don't have the models set up")
    );
  });

  it('points the user at the settings screen', async () => {
    const d = deps();

    await chat._generate(
      { convId: 'conv-1', leafNodeId: 1, onChunk: () => {} },
      d as never
    );

    expect(d.toast).toHaveBeenCalledWith(expect.stringContaining('Settings'));
  });
});
