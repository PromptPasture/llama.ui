import { tick } from 'svelte';
import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  loadConversation: vi.fn().mockResolvedValue(true),
  unloadConversation: vi.fn(),
  ttsStop: vi.fn(),
  sendMessage: vi.fn(),
  replaceMessage: vi.fn(),
  viewingChat: null as { messages: unknown[] } | null,
  search: '',
}));

vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$app/state', () => ({
  page: {
    get url() {
      return new URL(`http://localhost/chat/c1${mocks.search}`);
    },
  },
}));
vi.mock('$lib/state/chat.svelte', () => ({
  chat: {
    loadConversation: mocks.loadConversation,
    unloadConversation: mocks.unloadConversation,
    sendMessage: mocks.sendMessage,
    replaceMessage: mocks.replaceMessage,
    // A getter, so a test can put a conversation on screen before rendering.
    get viewingChat() {
      return mocks.viewingChat;
    },
    pendingMessages: {},
    isGenerating: () => false,
  },
}));
vi.mock('$lib/state/tts.svelte', () => ({
  tts: { stop: mocks.ttsStop, isSpeaking: () => false },
}));

const { default: ChatPage } = await import('./+page.svelte');
const { toast } = await import('$lib/components/toast');
const { forgetAllAttachments } = await import('$lib/utils/attachments');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
  // jsdom has no layout and no scrolling; the page only ever asks to scroll.
  Element.prototype.scrollTo = vi.fn();
});

beforeEach(() => {
  // An unsent message is kept for the next visit, including the next test.
  localStorage.clear();
  forgetAllAttachments();
  mocks.viewingChat = null;
  mocks.search = '';
  vi.clearAllMocks();
});

/** jsdom reports every element as zero-sized, which reads as "at the bottom". */
function measuresAsScrolledUp(el: Element) {
  Object.defineProperty(el, 'scrollHeight', {
    value: 2000,
    configurable: true,
  });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  Object.defineProperty(el, 'scrollTop', { value: 0, configurable: true });
}

async function renderChat(convId = 'c1') {
  const { container, rerender } = render(ChatPage, {
    props: { data: {}, params: { convId } },
  });
  const scroller = container.querySelector('.chat-page__scroll');
  if (!scroller) throw new Error('the message list has no scrolling element');
  // Opening a conversation scrolls to its end on the next frame. Letting that
  // land first keeps it from being mistaken for something a test asked for.
  await new Promise((resolve) => setTimeout(resolve, 20));
  // The route is the same for every conversation, so switching to another one
  // hands the page new params rather than mounting it again.
  const openAnother = (id: string) =>
    rerender({ data: {}, params: { convId: id } });
  // Scoped to this page: a test may have more than one of them open.
  const box = () => within(container).getByRole('textbox');
  return { scroller, openAnother, box, container };
}

const jumpButton = () =>
  screen.queryByRole('button', { name: 'Jump to the latest message' });

/** Presses the button, having first insisted there is one to press. */
async function pressJump() {
  const button = jumpButton();
  expect(button).not.toBeNull();
  await userEvent.click(button!);
}

describe('opening a conversation', () => {
  it('shows the end of it, where the conversation was left', async () => {
    const { container } = render(ChatPage, {
      props: { data: {}, params: { convId: 'c1' } },
    });
    const scroller = container.querySelector('.chat-page__scroll');
    if (!scroller) throw new Error('the message list has no scrolling element');
    Object.defineProperty(scroller, 'scrollHeight', {
      value: 2000,
      configurable: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    // Opened at the top, a long conversation starts with a greeting from
    // weeks ago rather than the answer that was being read.
    expect(scroller.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 2000 })
    );
  });
});

describe('getting back to the latest message', () => {
  it('offers no way back while the reader is already there', async () => {
    await renderChat();

    // A button over the conversation that does nothing is just something in
    // the way of reading it.
    expect(jumpButton()).toBeNull();
  });

  it('offers a way back once the reader has scrolled up', async () => {
    const { scroller } = await renderChat();

    measuresAsScrolledUp(scroller);
    scroller.dispatchEvent(new Event('scroll'));
    await tick();

    // Scrolling up stops the reply pulling the view down, and scrolling all
    // the way back was the only way to return to it.
    expect(jumpButton()).not.toBeNull();
  });

  it('scrolls to the end of the conversation when pressed', async () => {
    const { scroller } = await renderChat();
    measuresAsScrolledUp(scroller);
    scroller.dispatchEvent(new Event('scroll'));
    await tick();
    // Opening the conversation scrolls to the end too; only the press counts.
    vi.mocked(scroller.scrollTo).mockClear();

    await pressJump();

    expect(scroller.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 2000 })
    );
  });

  it('takes itself out of the way once it has been used', async () => {
    const { scroller } = await renderChat();
    measuresAsScrolledUp(scroller);
    scroller.dispatchEvent(new Event('scroll'));
    await tick();

    await pressJump();

    // It means "keep up with the reply" rather than "move me once": the
    // reader is following again, so there is nothing left to offer.
    expect(jumpButton()).toBeNull();
  });
});

describe('leaving the conversation', () => {
  it('stops reading it aloud', async () => {
    const { unmount } = render(ChatPage, {
      props: { data: {}, params: { convId: 'c1' } },
    });

    unmount();
    await tick();

    // Speech outlives the page otherwise, and carries on reading a
    // conversation the reader has already left.
    expect(mocks.ttsStop).toHaveBeenCalled();
  });
});

describe('a message that has been typed but not sent', () => {
  it('stays behind when another conversation is opened', async () => {
    const { openAnother, box } = await renderChat('c1');
    await userEvent.type(box(), 'half a thought');

    await openAnother('c2');

    // The box belongs to the conversation it was typed in. Carrying the text
    // over means the next Enter sends it to the wrong one.
    expect(box()).toHaveValue('');
  });

  it('is waiting on the way back', async () => {
    const { openAnother, box } = await renderChat('c1');
    await userEvent.type(box(), 'half a thought');

    await openAnother('c2');
    await openAnother('c1');

    expect(box()).toHaveValue('half a thought');
  });

  it('survives the page being opened afresh', async () => {
    const first = await renderChat('c1');
    await userEvent.type(first.box(), 'half a thought');
    await first.openAnother('c2');

    // A reload, or coming back from the settings screen: a new page rather
    // than new params.
    const second = await renderChat('c1');

    expect(second.box()).toHaveValue('half a thought');
  });
});

describe('a file attached but not sent', () => {
  const attach = async (container: HTMLElement) => {
    const picker =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!picker) throw new Error('the box has no file picker');
    await userEvent.upload(
      picker,
      new File(['the contents'], 'notes.txt', { type: 'text/plain' })
    );
  };

  it('stays behind when another conversation is opened', async () => {
    const { openAnother, container } = await renderChat('c1');
    await attach(container);

    await openAnother('c2');

    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument();
  });

  it('is waiting on the way back', async () => {
    const { openAnother, container } = await renderChat('c1');
    await attach(container);

    await openAnother('c2');
    await openAnother('c1');

    expect(screen.getByText('notes.txt')).toBeInTheDocument();
  });
});

describe('asking again for a reply that never came', () => {
  const root = {
    id: 0,
    convId: 'c1',
    type: 'root',
    timestamp: 0,
    role: 'system',
    content: '',
    parent: -1,
    children: [5],
  };
  const unanswered = {
    id: 5,
    convId: 'c1',
    type: 'text',
    timestamp: 5,
    role: 'user',
    content: 'why does this crash?',
    parent: 0,
    children: [],
  };

  const reply = {
    id: 6,
    convId: 'c1',
    type: 'text',
    timestamp: 6,
    role: 'assistant',
    content: 'because of a null pointer',
    parent: 5,
    children: [],
  };

  it('replaces a reply that did come, rather than adding another', async () => {
    mocks.viewingChat = {
      messages: [{ ...root }, { ...unanswered, children: [6] }, reply],
    };
    await renderChat('c1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Regenerate response' })
    );

    // Generation starts again from the message the reply was answering, so
    // the new one is a sibling of the old rather than a turn below it.
    expect(mocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ parent: 5, content: null }),
      expect.anything()
    );
  });

  it('generates a reply to that message', async () => {
    mocks.viewingChat = { messages: [root, unanswered] };
    await renderChat('c1');

    await userEvent.click(
      screen.getByRole('button', { name: 'Get a reply to this message' })
    );

    // Taking the message's own parent would regenerate the turn above it,
    // replacing an answer the reader still has instead of getting the one
    // they never did.
    expect(mocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ parent: 5, content: null }),
      expect.anything()
    );
  });
});

describe('a conversation that cannot be read', () => {
  it('says so when it becomes unreadable after it was opened', async () => {
    const failed = vi.spyOn(toast, 'error').mockImplementation(() => {});
    await renderChat('c1');

    // What the database calls when a later read fails — another tab writing
    // to a conversation whose storage has since gone away.
    const report = mocks.loadConversation.mock.calls[0]?.[1] as (
      error: unknown
    ) => void;
    expect(report).toBeTypeOf('function');
    report(new Error('storage blocked'));

    expect(failed).toHaveBeenCalledWith('Could not read this conversation.');
    failed.mockRestore();
  });

  it('says so rather than showing an empty one', async () => {
    mocks.loadConversation.mockRejectedValue(new Error('storage blocked'));
    const failed = vi.spyOn(toast, 'error').mockImplementation(() => {});

    render(ChatPage, { props: { data: {}, params: { convId: 'c1' } } });

    // Storage can be unavailable outright. Left unsaid, the conversation
    // appears to have gone — the same lie the sidebar takes care not to tell.
    await vi.waitFor(() =>
      expect(failed).toHaveBeenCalledWith('Could not read this conversation.')
    );
    failed.mockRestore();
  });
});

describe('editing a message that is already in the conversation', () => {
  const root = {
    id: 0,
    convId: 'c1',
    type: 'root',
    timestamp: 0,
    role: 'system',
    content: '',
    parent: -1,
    children: [5],
  };
  const asked = {
    id: 5,
    convId: 'c1',
    type: 'text',
    timestamp: 5,
    role: 'user',
    content: 'why does this crash?',
    parent: 0,
    children: [6],
  };
  const answered = {
    id: 6,
    convId: 'c1',
    type: 'text',
    timestamp: 6,
    role: 'assistant',
    content: 'because of a null pointer',
    parent: 5,
    children: [],
  };

  async function openConversation() {
    mocks.viewingChat = { messages: [root, asked, answered] };
    return renderChat('c1');
  }

  async function editThrough(role: 'user' | 'assistant', text: string) {
    const user = userEvent.setup();
    const message = screen.getByRole('group', { name: `Message from ${role}` });
    await user.click(
      within(message).getByRole('button', { name: 'Edit message' })
    );
    const box = within(message).getByRole('textbox');
    await user.clear(box);
    await user.type(box, text);
    await user.click(
      within(message).getByRole('button', {
        name: role === 'user' ? 'Send' : 'Save',
      })
    );
  }

  it('asks the question again from where it was asked', async () => {
    await openConversation();

    await editThrough('user', 'why does this hang?');

    // Sent from the edited message rather than from itself, the rewritten
    // question becomes a reply to the original instead of a version of it.
    expect(mocks.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: 0,
        content: 'why does this hang?',
        role: 'user',
      }),
      expect.anything()
    );
  });

  it('does not ask again when the reply itself is rewritten', async () => {
    await openConversation();

    await editThrough('assistant', 'because of a race');

    // Correcting a reply is not a request for another one.
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.replaceMessage).toHaveBeenCalledWith(
      expect.objectContaining({ newContent: 'because of a race' }),
      expect.anything()
    );
  });
});

describe('opening a conversation at a message that was searched for', () => {
  const root = {
    id: 0,
    convId: 'c1',
    type: 'root',
    timestamp: 0,
    role: 'system',
    content: '',
    parent: -1,
    children: [5],
  };
  const early = {
    id: 5,
    convId: 'c1',
    type: 'text',
    timestamp: 5,
    role: 'user',
    content: 'the sourdough starter question',
    parent: 0,
    children: [6],
  };
  const later = {
    id: 6,
    convId: 'c1',
    type: 'assistant',
    timestamp: 6,
    role: 'assistant',
    content: 'the answer',
    parent: 5,
    children: [],
  };

  it('brings that message into view', async () => {
    const brought: unknown[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      brought.push(this.id);
    };
    mocks.viewingChat = { messages: [root, early, later] };
    mocks.search = '?m=5';

    await renderChat('c1');
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Landing at the end leaves the reader to find by eye what they had just
    // searched for.
    expect(brought).toContain('msg-5');
  });

  it('marks it, so it can be picked out from what surrounds it', async () => {
    mocks.viewingChat = { messages: [root, early, later] };
    mocks.search = '?m=5';

    const { container } = await renderChat('c1');

    // Scrolled to and then left to be found by eye is most of the way to not
    // having been found.
    expect(container.querySelector('#msg-5')?.className).toContain(
      'msg--landed'
    );
  });

  it('stops marking it once it has been noticed', async () => {
    vi.useFakeTimers();
    try {
      mocks.viewingChat = { messages: [root, early, later] };
      mocks.search = '?m=5';
      const { container } = render(ChatPage, {
        props: { data: {}, params: { convId: 'c1' } },
      });
      await vi.advanceTimersByTimeAsync(50);

      await vi.advanceTimersByTimeAsync(3000);

      // Left marked, it reads as a state the message is in rather than
      // where the reader arrived.
      expect(container.querySelector('#msg-5')?.className).not.toContain(
        'msg--landed'
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks nothing when nothing was asked for', async () => {
    mocks.viewingChat = { messages: [root, early, later] };

    const { container } = await renderChat('c1');

    expect(container.querySelector('.msg--landed')).toBeNull();
  });

  it('leaves the conversation alone when nothing was asked for', async () => {
    const brought: unknown[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      brought.push(this.id);
    };
    mocks.viewingChat = { messages: [root, early, later] };

    await renderChat('c1');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(brought).toEqual([]);
  });

  it('ignores a message that is not in this conversation', async () => {
    const brought: unknown[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      brought.push(this.id);
    };
    mocks.viewingChat = { messages: [root, early, later] };
    mocks.search = '?m=999';

    await renderChat('c1');
    await new Promise((resolve) => setTimeout(resolve, 20));

    // A stale link, or one for another conversation entirely.
    expect(brought).toEqual([]);
    // And the conversation is still the one it was: pointing the view at a
    // message that is not there leaves nothing to show at all.
    expect(screen.getByText('the sourdough starter question')).toBeVisible();
  });
});
