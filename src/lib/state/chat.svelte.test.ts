import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOneConversation: vi.fn(),
  getMessages: vi.fn().mockResolvedValue([]),
  onConversationChanged: vi.fn(),
  filterByLeafNodeId: vi.fn().mockReturnValue([]),
  appendMsg: vi.fn().mockResolvedValue(undefined),
}));

const stream = vi.hoisted(() => ({ generateChatStream: vi.fn() }));

vi.mock('$lib/database/indexedDB', () => ({ default: mocks }));
vi.mock('$lib/services/inference-service', () => stream);
vi.mock('$lib/api/message-normalization', () => ({
  normalizeMsgsForAPI: () => [],
}));

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

describe('stopping generation partway', () => {
  function abortAfterStreaming(text: string) {
    stream.generateChatStream.mockImplementationOnce(
      async ({ onUpdate }: { onUpdate: (u: unknown) => void }) => {
        onUpdate({ content: text });
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }
    );
  }

  it('keeps the text streamed before the user pressed stop', async () => {
    mocks.appendMsg.mockClear();
    abortAfterStreaming('half an answer');

    await chat._generate(
      { convId: 'conv-1', leafNodeId: 1, onChunk: () => {} },
      deps({ provider: {} }) as never
    );

    // Watching a reply appear and then vanish on stop is the wrong trade:
    // every mainstream chat client keeps what was produced.
    expect(mocks.appendMsg).toHaveBeenCalledTimes(1);
    expect(mocks.appendMsg.mock.calls[0][0]).toMatchObject({
      content: 'half an answer',
      role: 'assistant',
    });
  });

  it('saves nothing when stopped before any text arrived', async () => {
    mocks.appendMsg.mockClear();
    stream.generateChatStream.mockImplementationOnce(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });

    await chat._generate(
      { convId: 'conv-1', leafNodeId: 1, onChunk: () => {} },
      deps({ provider: {} }) as never
    );

    expect(mocks.appendMsg).not.toHaveBeenCalled();
  });

  it('does not report an error when the user stopped deliberately', async () => {
    abortAfterStreaming('partial');
    const d = deps({ provider: {} });

    await chat._generate(
      { convId: 'conv-1', leafNodeId: 1, onChunk: () => {} },
      d as never
    );

    expect(d.toast).not.toHaveBeenCalled();
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
