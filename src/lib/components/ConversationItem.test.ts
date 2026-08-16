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
  showPrompt: vi.fn(),
  updateConversationName: vi.fn(),
  exportDB: vi.fn(),
  downloadAsFile: vi.fn(),
}));

vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$lib/state/modal.svelte', () => ({
  modal: { showConfirm: mocks.showConfirm, showPrompt: mocks.showPrompt },
}));
vi.mock('$lib/state/chat.svelte', () => ({
  chat: { isGenerating: mocks.isGenerating },
}));
vi.mock('$lib/database/indexedDB', () => ({
  default: {
    deleteConversation: mocks.deleteConversation,
    updateConversationName: mocks.updateConversationName,
    exportDB: mocks.exportDB,
  },
}));

vi.mock('$lib/utils/downloadAsFile', () => ({
  downloadAsFile: mocks.downloadAsFile,
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
  mocks.updateConversationName.mockResolvedValue(undefined);
  mocks.exportDB.mockResolvedValue([]);
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

describe('renaming a conversation', () => {
  async function renameTo(name: string | undefined) {
    mocks.showPrompt.mockResolvedValue(name);
    const user = userEvent.setup();
    render(ConversationItem, { props: { conv, currentConvId: 'conv-1' } });

    await user.click(screen.getByRole('button', { name: 'Show more options' }));
    await user.click(screen.getByRole('button', { name: /Rename/ }));
  }

  it('stores the trimmed name', async () => {
    await renameTo('  A better name  ');

    expect(mocks.updateConversationName).toHaveBeenCalledWith(
      'conv-1',
      'A better name'
    );
  });

  it('does nothing when the prompt is dismissed', async () => {
    await renameTo(undefined);

    expect(mocks.updateConversationName).not.toHaveBeenCalled();
  });

  it('does nothing when the new name is only whitespace', async () => {
    await renameTo('   ');

    expect(mocks.updateConversationName).not.toHaveBeenCalled();
  });

  it('reports a rename that failed', async () => {
    mocks.updateConversationName.mockRejectedValue(new Error('storage full'));

    await renameTo('A better name');

    // The write was not awaited, so the old name stayed in the list with
    // nothing said about why.
    expect(mocks.error).toHaveBeenCalled();
  });
});

describe('downloading a conversation', () => {
  async function download() {
    const user = userEvent.setup();
    render(ConversationItem, { props: { conv, currentConvId: 'conv-1' } });

    await user.click(screen.getByRole('button', { name: 'Show more options' }));
    await user.click(screen.getByRole('button', { name: /Download/ }));
  }

  it('writes out the exported conversation', async () => {
    mocks.exportDB.mockResolvedValue([{ table: 'conversations', rows: [] }]);

    await download();

    expect(mocks.downloadAsFile).toHaveBeenCalledWith(
      [expect.stringContaining('conversations')],
      'conversation_conv-1.json'
    );
  });

  it('reports an export that failed instead of doing nothing', async () => {
    mocks.exportDB.mockRejectedValue(new Error('unreadable'));

    await download();

    expect(mocks.downloadAsFile).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
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

describe('how a conversation is presented to a screen reader', () => {
  it('is a list item, not a menu item', async () => {
    const { container } = render(ConversationItem, { props: { conv } });

    // A menuitem may hold no focusable descendants, and this holds two: the
    // conversation itself and the button that opens its actions.
    expect(container.querySelector('[role="menuitem"]')).toBeNull();
    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });

  it('offers the conversation and its actions as buttons', async () => {
    const user = userEvent.setup();
    render(ConversationItem, { props: { conv } });

    await user.click(screen.getByRole('button', { name: 'Show more options' }));

    // Tabbing between buttons is what this offers, so buttons is what they
    // are: an ARIA menu would promise arrow keys that do nothing here.
    for (const name of [/Rename/, /Download/, /Delete/]) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('says what the list of actions is for', async () => {
    const user = userEvent.setup();
    render(ConversationItem, { props: { conv } });

    await user.click(screen.getByRole('button', { name: 'Show more options' }));

    expect(
      screen.getByRole('list', { name: 'More options' })
    ).toBeInTheDocument();
  });
});

describe('reaching the conversation actions from the keyboard', () => {
  const openMenu = async () => {
    const user = userEvent.setup();
    render(ConversationItem, { props: { conv } });
    await user.click(screen.getByRole('button', { name: 'Show more options' }));
    return user;
  };

  it('puts the cursor on the first action when the list opens', async () => {
    await openMenu();

    // Otherwise the list is on screen and the keyboard is still on the button
    // that opened it, several tab stops away from anything in it.
    expect(screen.getByRole('button', { name: /Rename/ })).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const user = await openMenu();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('button', { name: /Rename/ })).toBeNull();
  });

  it('hands the cursor back to the button that opened it', async () => {
    const user = await openMenu();

    await user.keyboard('{Escape}');

    // The element holding focus has just been removed; without this the
    // keyboard falls back to the document and loses its place in the sidebar.
    expect(
      screen.getByRole('button', { name: 'Show more options' })
    ).toHaveFocus();
  });

  it('does not let Escape through to close the whole sidebar as well', async () => {
    const user = await openMenu();
    const escapes: KeyboardEvent[] = [];
    window.addEventListener('keydown', (e) => escapes.push(e));

    await user.keyboard('{Escape}');

    expect(escapes).toHaveLength(0);
  });
});
