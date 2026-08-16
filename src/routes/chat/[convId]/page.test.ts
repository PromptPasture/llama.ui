import { render, screen, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  loadConversation: vi.fn().mockResolvedValue(true),
  unloadConversation: vi.fn(),
  ttsStop: vi.fn(),
}));

vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$lib/state/chat.svelte', () => ({
  chat: {
    loadConversation: mocks.loadConversation,
    unloadConversation: mocks.unloadConversation,
    viewingChat: null,
    pendingMessages: {},
    isGenerating: () => false,
  },
}));
vi.mock('$lib/state/tts.svelte', () => ({
  tts: { stop: mocks.ttsStop, isSpeaking: () => false },
}));

const { default: ChatPage } = await import('./+page.svelte');
const { forgetAllAttachments } = await import('$lib/utils/attachments');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
  // jsdom has no layout and no scrolling; the page only ever asks to scroll.
  Element.prototype.scrollTo = vi.fn();
});

beforeEach(() => {
  // An unsent message is kept for the next visit, including the next test.
  localStorage.clear();
  forgetAllAttachments();
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
    await scroller.dispatchEvent(new Event('scroll'));

    // Scrolling up stops the reply pulling the view down, and scrolling all
    // the way back was the only way to return to it.
    expect(jumpButton()).not.toBeNull();
  });

  it('scrolls to the end of the conversation when pressed', async () => {
    const { scroller } = await renderChat();
    measuresAsScrolledUp(scroller);
    await scroller.dispatchEvent(new Event('scroll'));
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
    await scroller.dispatchEvent(new Event('scroll'));

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

    await unmount();

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
