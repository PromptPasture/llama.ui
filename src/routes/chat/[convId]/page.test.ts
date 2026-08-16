import { render, screen } from '@testing-library/svelte';
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

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
  // jsdom has no layout and no scrolling; the page only ever asks to scroll.
  Element.prototype.scrollTo = vi.fn();
});

beforeEach(() => {
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

async function renderChat() {
  const { container } = render(ChatPage, {
    props: { data: {}, params: { convId: 'c1' } },
  });
  const scroller = container.querySelector('.chat-page__scroll');
  if (!scroller) throw new Error('the message list has no scrolling element');
  // Opening a conversation scrolls to its end on the next frame. Letting that
  // land first keeps it from being mistaken for something a test asked for.
  await new Promise((resolve) => setTimeout(resolve, 20));
  return scroller;
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
    const scroller = await renderChat();

    measuresAsScrolledUp(scroller);
    await scroller.dispatchEvent(new Event('scroll'));

    // Scrolling up stops the reply pulling the view down, and scrolling all
    // the way back was the only way to return to it.
    expect(jumpButton()).not.toBeNull();
  });

  it('scrolls to the end of the conversation when pressed', async () => {
    const scroller = await renderChat();
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
    const scroller = await renderChat();
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
