import { init, locale, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOneConversation: vi.fn(),
  getMessages: vi.fn().mockResolvedValue([]),
  onConversationChanged: vi.fn(),
  offConversationChanged: vi.fn(),
  filterByLeafNodeId: vi.fn().mockReturnValue([]),
  appendMsg: vi.fn().mockResolvedValue(undefined),
  branchConversation: vi.fn(),
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
  register('ru', () => import('../i18n/ru.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

// Each test says for itself whether the conversation is there; without a
// default, whichever earlier test last called mockResolvedValue decides.
beforeEach(() => {
  mocks.getOneConversation.mockResolvedValue({ id: 'conv-1', currNode: -1 });
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

describe('conversation change listeners', () => {
  const conv = { id: 'c', name: 'n', lastModified: 1, currNode: -1 };

  it('removes the very listener it registered', async () => {
    mocks.onConversationChanged.mockClear();
    mocks.offConversationChanged.mockClear();
    mocks.getOneConversation.mockResolvedValue(conv);

    await chat.loadConversation('c');
    chat.unloadConversation();

    // Removal is by identity, so an equivalent-looking closure removes nothing.
    const registered = mocks.onConversationChanged.mock.calls.at(-1)![0];
    expect(mocks.offConversationChanged).toHaveBeenCalledWith(registered);
  });

  it('does not accumulate listeners across repeated visits', async () => {
    mocks.onConversationChanged.mockClear();
    mocks.offConversationChanged.mockClear();
    mocks.getOneConversation.mockResolvedValue(conv);

    const live = new Set<unknown>();
    mocks.onConversationChanged.mockImplementation((cb: unknown) =>
      live.add(cb)
    );
    mocks.offConversationChanged.mockImplementation((cb: unknown) =>
      live.delete(cb)
    );

    for (let i = 0; i < 20; i++) {
      await chat.loadConversation('c');
      chat.unloadConversation();
    }

    // Every leaked listener reloads the whole message list on each change.
    expect(live.size).toBe(0);

    mocks.onConversationChanged.mockReset();
    mocks.offConversationChanged.mockReset();
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

describe('sending with nothing configured to send to', () => {
  const send = (over: Record<string, unknown> = {}) =>
    chat.sendMessage(
      {
        convId: 'conv-1',
        type: 'text',
        role: 'user',
        parent: -1,
        content: 'hello',
        extra: undefined,
        onChunk: () => {},
      },
      deps(over)
    );

  it('says why nothing happened', async () => {
    const d = deps();
    await chat.sendMessage(
      {
        convId: 'conv-1',
        type: 'text',
        role: 'user',
        parent: -1,
        content: 'hello',
        extra: undefined,
        onChunk: () => {},
      },
      d
    );

    expect(d.toast).toHaveBeenCalled();
  });

  it('reports the send as refused, so the box keeps the message', async () => {
    expect(await send()).toBe(false);
  });

  it('does not store the message', async () => {
    mocks.appendMsg.mockClear();

    await send();

    // A request that fails was still sent, and belongs in the conversation
    // where it can be tried again. This one was never attempted: stored, it
    // would sit there unanswered with nothing able to ask again.
    expect(mocks.appendMsg).not.toHaveBeenCalled();
  });
});

describe('a reply that says nothing but its reasoning', () => {
  const generate = () =>
    chat._generate(
      { convId: 'conv-1', leafNodeId: 1, onChunk: () => {} },
      deps({ provider: {} }) as never
    );

  beforeEach(() => {
    mocks.appendMsg.mockClear();
  });

  it('is kept', async () => {
    stream.generateChatStream.mockImplementationOnce(
      async ({ onUpdate }: { onUpdate: (u: unknown) => void }) => {
        onUpdate({ reasoning_content: 'thinking it through' });
      }
    );

    await generate();

    // The thinking used to stream in and then vanish with the message that
    // carried it, leaving the question looking unanswered.
    expect(mocks.appendMsg).toHaveBeenCalledOnce();
    expect(mocks.appendMsg.mock.calls[0][0]).toMatchObject({
      reasoning_content: 'thinking it through',
      content: '',
    });
  });

  it('is kept when the reader stops it part way', async () => {
    stream.generateChatStream.mockImplementationOnce(
      async ({ onUpdate }: { onUpdate: (u: unknown) => void }) => {
        onUpdate({ reasoning_content: 'half a thought' });
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      }
    );

    await generate();

    expect(mocks.appendMsg).toHaveBeenCalledOnce();
  });

  it('stores content as text, never as nothing', async () => {
    stream.generateChatStream.mockImplementationOnce(
      async ({ onUpdate }: { onUpdate: (u: unknown) => void }) => {
        onUpdate({ reasoning_content: 'thinking it through' });
      }
    );

    await generate();

    // A null would reach the markdown renderer as the message body.
    expect(typeof mocks.appendMsg.mock.calls[0][0].content).toBe('string');
  });
});

describe('a reply that says nothing at all', () => {
  it('is not stored', async () => {
    mocks.appendMsg.mockClear();
    stream.generateChatStream.mockImplementationOnce(async () => {});

    await chat._generate(
      { convId: 'conv-1', leafNodeId: 1, onChunk: () => {} },
      deps({ provider: {} }) as never
    );

    // Nothing arrived, so there is nothing to keep: an empty bubble would say
    // less than no bubble.
    expect(mocks.appendMsg).not.toHaveBeenCalled();
  });
});

describe('saving an edit to a reply', () => {
  const edit = (over: Record<string, unknown> = {}) =>
    chat.replaceMessage(
      {
        msg: {
          id: 7,
          convId: 'conv-1',
          type: 'text',
          timestamp: 7,
          role: 'assistant',
          content: 'the old wording',
          parent: 6,
          children: [],
        } as never,
        newContent: 'the corrected wording',
        onChunk: () => {},
      },
      deps({ provider: {}, ...over }) as never
    );

  beforeEach(() => {
    mocks.appendMsg.mockClear().mockResolvedValue(undefined);
    stream.generateChatStream.mockClear();
  });

  it('stores the corrected wording', async () => {
    await edit();

    expect(mocks.appendMsg).toHaveBeenCalledOnce();
    expect(mocks.appendMsg.mock.calls[0][0]).toMatchObject({
      content: 'the corrected wording',
      role: 'assistant',
    });
  });

  it('keeps it beside the wording it replaces', async () => {
    await edit();

    // Appended under the same parent, so the original is still there to
    // switch back to.
    expect(mocks.appendMsg.mock.calls[0][1]).toBe(6);
  });

  it('does not ask for another reply', async () => {
    await edit();

    // The button says Save. Generating here appended a second reply under the
    // one just corrected, and charged a whole generation for pressing it.
    expect(stream.generateChatStream).not.toHaveBeenCalled();
  });

  it('says so when the edit could not be stored', async () => {
    mocks.appendMsg.mockRejectedValue(new Error('disk full'));
    const d = deps({ provider: {} });

    await chat.replaceMessage(
      {
        msg: { id: 7, convId: 'conv-1', parent: 6, role: 'assistant' } as never,
        newContent: 'the corrected wording',
        onChunk: () => {},
      },
      d as never
    );

    // Unreported, a failed save looks exactly like one that worked: the editor
    // closes and the old text comes back.
    expect(d.toast).toHaveBeenCalled();
  });
});

describe('a conversation deleted while it was being answered', () => {
  const generate = (d = deps({ provider: {} })) =>
    chat._generate(
      { convId: 'conv-1', leafNodeId: 1, onChunk: () => {} },
      d as never
    );

  beforeEach(() => {
    mocks.appendMsg.mockClear().mockResolvedValue(undefined);
    stream.generateChatStream.mockImplementationOnce(
      async ({ onUpdate }: { onUpdate: (u: unknown) => void }) => {
        onUpdate({ content: 'the answer' });
      }
    );
  });

  it('does not store the reply', async () => {
    mocks.getOneConversation.mockResolvedValue(undefined);

    await generate();

    // A tab will not delete a conversation it is answering in, but it cannot
    // see that another tab is. Appending anyway leaves messages pointing at a
    // conversation that is gone, which nothing reads and nothing deletes.
    expect(mocks.appendMsg).not.toHaveBeenCalled();
  });

  it('says what happened', async () => {
    mocks.getOneConversation.mockResolvedValue(undefined);
    const d = deps({ provider: {} });

    await generate(d);

    expect(d.toast).toHaveBeenCalled();
  });

  it('stores it as usual when the conversation is still there', async () => {
    await generate();

    expect(mocks.appendMsg).toHaveBeenCalledOnce();
  });
});

describe('branching a conversation', () => {
  it('names the branch after the one it came from', async () => {
    await locale.set('ru');
    await waitLocale();
    mocks.getOneConversation.mockResolvedValue({
      id: 'conv-1',
      name: 'Bread recipe',
      currNode: -1,
    });
    mocks.branchConversation.mockResolvedValue({ id: 'conv-2' });

    await chat.branchMessage({ convId: 'conv-1', id: 7 } as never, {
      navigate: vi.fn(),
      toast: vi.fn(),
    });

    // Asserted in Russian: in English the translated name and the hardcoded
    // one it replaced read exactly the same, so this would pass either way.
    expect(mocks.branchConversation).toHaveBeenCalledWith(
      'conv-1',
      7,
      'Bread recipe — ветка'
    );

    await locale.set('en');
    await waitLocale();
  });
});
