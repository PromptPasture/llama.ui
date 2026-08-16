import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  createConversation: vi.fn(),
  sendMessage: vi.fn().mockResolvedValue(true),
  isGenerating: vi.fn(() => false),
  stopGenerating: vi.fn(),
  error: vi.fn(),
  showConfirm: vi.fn().mockResolvedValue(false),
  provider: null as unknown,
}));

vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$lib/database/indexedDB', () => ({
  default: { createConversation: mocks.createConversation },
}));
vi.mock('$lib/state/chat.svelte', () => ({
  chat: {
    sendMessage: mocks.sendMessage,
    isGenerating: mocks.isGenerating,
    stopGenerating: mocks.stopGenerating,
  },
}));
vi.mock('$lib/state/inference.svelte', () => ({
  inference: {
    get provider() {
      return mocks.provider;
    },
    get selectedModel() {
      return null;
    },
  },
}));
vi.mock('$lib/state/modal.svelte', () => ({
  modal: { showConfirm: mocks.showConfirm },
}));
vi.mock('$lib/components/toast.js', () => ({
  toast: { error: mocks.error, success: vi.fn(), info: vi.fn() },
}));

const { default: HomePage } = await import('./+page.svelte');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(() => {
  mocks.goto.mockClear();
  mocks.createConversation.mockClear().mockResolvedValue({
    id: 'conv-1',
    currNode: -1,
  });
  mocks.sendMessage.mockClear();
  mocks.error.mockClear();
  mocks.showConfirm.mockClear().mockResolvedValue(false);
  mocks.provider = null;
});

async function typeAndSend(text: string) {
  const user = userEvent.setup();
  render(HomePage);
  const box = screen.getByRole('textbox');
  await user.type(box, `${text}{Enter}`);
  return box;
}

describe('sending the first message with nothing configured', () => {
  it('does not start a conversation', async () => {
    await typeAndSend('hello');

    // The conversation was being created, and navigated to, before anything
    // checked whether it could be answered — leaving a new visitor in an empty
    // conversation they did not ask for.
    expect(mocks.createConversation).not.toHaveBeenCalled();
    expect(mocks.goto).not.toHaveBeenCalled();
  });

  it('offers to go and set one up', async () => {
    await typeAndSend('hello');

    // The message used to say 'let's go to the Settings' and then leave the
    // reader to find them; the buttons for this have been translated in all
    // twelve catalogues since before anything showed them.
    const [message, labels] = mocks.showConfirm.mock.calls[0];
    expect(message).toContain('Settings');
    expect(labels).toEqual({ confirm: 'Open Settings', cancel: 'Skip' });
  });

  it('takes them there when they accept', async () => {
    mocks.showConfirm.mockResolvedValue(true);

    await typeAndSend('hello');

    expect(mocks.goto).toHaveBeenCalledWith('/settings');
  });

  it('stays put when they decline', async () => {
    await typeAndSend('hello');

    expect(mocks.goto).not.toHaveBeenCalled();
  });

  it('keeps what was typed', async () => {
    const box = await typeAndSend('hello');

    // There is nothing to retype once the provider is set up, if the box has
    // been emptied.
    expect(box).toHaveValue('hello');
  });
});

describe('sending the first message once a provider is set up', () => {
  it('starts a conversation and goes to it', async () => {
    mocks.provider = { id: 'llama.cpp' };

    await typeAndSend('hello');

    expect(mocks.createConversation).toHaveBeenCalledWith('hello');
    expect(mocks.goto).toHaveBeenCalledWith('/chat/[convId]');
    expect(mocks.sendMessage).toHaveBeenCalled();
  });
});

describe('what a new conversation is called', () => {
  it('is named after the message that started it', async () => {
    mocks.provider = { id: 'llama.cpp' };

    await typeAndSend('How do I centre a div?');

    expect(mocks.createConversation).toHaveBeenCalledWith(
      'How do I centre a div?'
    );
  });

  it('is not named after a paragraph of it', async () => {
    mocks.provider = { id: 'llama.cpp' };
    const long =
      'I would like a detailed explanation of how the borrow checker decides when a reference outlives its owner';

    await typeAndSend(long);

    // The name is the tooltip, the label read aloud for the item in the list,
    // and the name of the file it downloads as. It used to be the first 256
    // characters of the message, newlines and all.
    const [name] = mocks.createConversation.mock.calls[0];
    expect(name.length).toBeLessThan(long.length);
    expect(name.endsWith('…')).toBe(true);
  });
});

describe('when the conversation cannot be started', () => {
  it('keeps what was typed rather than losing it', async () => {
    mocks.provider = { id: 'llama.cpp' };
    mocks.createConversation.mockRejectedValue(new Error('storage blocked'));

    const box = await typeAndSend('a message worth keeping');

    // The box is emptied as the message is sent; a failure after that took the
    // words with it and said nothing.
    expect(box).toHaveValue('a message worth keeping');
    expect(mocks.error).toHaveBeenCalled();
  });

  it('does not navigate to a conversation that was never made', async () => {
    mocks.provider = { id: 'llama.cpp' };
    mocks.createConversation.mockRejectedValue(new Error('storage blocked'));

    await typeAndSend('hello');

    expect(mocks.goto).not.toHaveBeenCalled();
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });
});
