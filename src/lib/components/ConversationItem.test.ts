import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '$lib/types';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  showConfirm: vi.fn(),
  deleteConversation: vi.fn(),
  isGenerating: vi.fn(() => false),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$lib/state/modal.svelte', () => ({
  modal: { showConfirm: mocks.showConfirm, showPrompt: vi.fn() },
}));
vi.mock('$lib/state/chat.svelte', () => ({
  chat: { isGenerating: mocks.isGenerating },
}));
vi.mock('$lib/database/indexedDB', () => ({
  default: {
    deleteConversation: mocks.deleteConversation,
    updateConversationName: vi.fn(),
    exportDB: vi.fn(),
  },
}));
vi.mock('$lib/components/toast.js', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const { default: ConversationItem } = await import('./ConversationItem.svelte');

// Set the locale explicitly rather than through initI18n(), which picks its
// initial locale from navigator.language and is not deterministic here.
beforeAll(async () => {
  register('en', () => import('../i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

const conv: Conversation = {
  id: 'conv-1',
  name: 'A conversation',
  lastModified: 1700000000000,
  currNode: -1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isGenerating.mockReturnValue(false);
  mocks.deleteConversation.mockResolvedValue(undefined);
  mocks.showConfirm.mockResolvedValue(true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/** Opens the item's menu and presses Delete. */
async function deleteFrom(currentConvId?: string) {
  const user = userEvent.setup();
  render(ConversationItem, { props: { conv, currentConvId } });

  await user.click(screen.getByRole('button', { name: 'Show more options' }));
  await user.click(screen.getByRole('button', { name: /Delete/ }));
}

describe('deleting a conversation', () => {
  it('asks first, and does nothing when declined', async () => {
    mocks.showConfirm.mockResolvedValue(false);

    await deleteFrom('conv-1');

    expect(mocks.showConfirm).toHaveBeenCalled();
    expect(mocks.deleteConversation).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('deletes once confirmed and says so afterwards', async () => {
    await deleteFrom('conv-1');

    expect(mocks.deleteConversation).toHaveBeenCalledWith('conv-1');
    expect(mocks.success).toHaveBeenCalled();
  });

  it('does not claim success when the delete fails', async () => {
    mocks.deleteConversation.mockRejectedValue(new Error('storage full'));

    await deleteFrom('conv-1');

    // The message used to be raised before the delete was attempted, so a
    // failure looked exactly like a success with the conversation still there.
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
  });

  it('stays put when the deleted conversation was not the open one', async () => {
    await deleteFrom('some-other-conversation');

    // Tidying the sidebar should not take the reader out of what they are
    // reading.
    expect(mocks.goto).not.toHaveBeenCalled();
  });

  it('leaves for the new chat screen when the open one is deleted', async () => {
    await deleteFrom('conv-1');

    expect(mocks.goto).toHaveBeenCalledWith('/');
  });

  it('does not navigate away when the delete failed', async () => {
    mocks.deleteConversation.mockRejectedValue(new Error('storage full'));

    await deleteFrom('conv-1');

    expect(mocks.goto).not.toHaveBeenCalled();
  });
});

describe('while a reply is being generated', () => {
  it('refuses to delete and explains why', async () => {
    mocks.isGenerating.mockReturnValue(true);

    await deleteFrom('conv-1');

    expect(mocks.showConfirm).not.toHaveBeenCalled();
    expect(mocks.deleteConversation).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
  });
});
