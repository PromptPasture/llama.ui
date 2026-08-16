import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, locale, register, waitLocale } from 'svelte-i18n';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { Conversation, ConversationMatch } from '$lib/types';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  getAllConversations: vi.fn(),
  searchConversations: vi.fn(),
  onConversationChanged: vi.fn(),
  offConversationChanged: vi.fn(),
}));

vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$app/state', () => ({ page: { params: {} } }));
vi.mock('$lib/database/indexedDB', () => ({
  default: {
    getAllConversations: mocks.getAllConversations,
    searchConversations: mocks.searchConversations,
    onConversationChanged: mocks.onConversationChanged,
    offConversationChanged: mocks.offConversationChanged,
  },
}));

const { default: Sidebar } = await import('./Sidebar.svelte');
const { toast } = await import('$lib/components/toast');

// Set the locale explicitly rather than through initI18n(), which picks its
// initial locale from navigator.language and is not deterministic here.
beforeAll(async () => {
  register('en', () => import('../i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

const NOW = Date.now();

function conv(id: string, name: string, ageDays = 0): Conversation {
  return {
    id,
    name,
    lastModified: NOW - ageDays * 24 * 60 * 60 * 1000,
    currNode: -1,
  };
}

const CONVERSATIONS = [
  conv('c1', 'Recipe for bread'),
  conv('c2', 'Debugging a rust panic'),
  conv('c3', 'Holiday planning'),
];

beforeEach(() => {
  mocks.goto.mockClear();
  mocks.getAllConversations.mockResolvedValue(CONVERSATIONS);
  // Stands in for the database: the real one also reads message content, which
  // these conversations do not have.
  mocks.searchConversations.mockClear();
  mocks.searchConversations.mockImplementation(async (term: string) =>
    CONVERSATIONS.filter((c) =>
      c.name.toLowerCase().includes(term.toLowerCase())
    ).map((conv) => ({ conv }))
  );
});

async function renderSidebar(props: Record<string, unknown> = {}) {
  const onclose = vi.fn();
  const result = render(Sidebar, { props: { open: true, onclose, ...props } });
  // the list is populated from an async load
  await screen.findByText('Recipe for bread');
  return { ...result, onclose };
}

describe('Sidebar month headings', () => {
  // A fixed March, so the heading does not depend on when the suite runs.
  // Several months read the same in English and German — April, August,
  // September, November — and picking one of those by accident would make
  // this pass whatever the code did.
  const WHEN = new Date(2020, 2, 15);
  const ancient = [
    {
      id: 'old',
      name: 'An old thread',
      lastModified: WHEN.getTime(),
      currNode: -1,
    } as Conversation,
  ];
  const monthName = (loc: string) =>
    WHEN.toLocaleString(loc, { month: 'long' });

  it('is testing two months that really are spelled differently', () => {
    expect(monthName('de')).not.toBe(monthName('en'));
  });

  afterEach(async () => {
    locale.set('en');
    await waitLocale('en');
  });

  it('names the month in English when that is the language', async () => {
    mocks.getAllConversations.mockResolvedValue(ancient);
    render(Sidebar, { props: { open: true, onclose: vi.fn() } });

    expect(await screen.findByText(new RegExp(monthName('en')))).toBeVisible();
  });

  it('names the month in the language the app is set to', async () => {
    register('de', () => import('../i18n/de.json'));
    locale.set('de');
    await waitLocale('de');
    mocks.getAllConversations.mockResolvedValue(ancient);

    render(Sidebar, { props: { open: true, onclose: vi.fn() } });

    // The heading is built by the grouper rather than looked up by key, so it
    // used to stay English however the interface was set.
    expect(await screen.findByText(new RegExp(monthName('de')))).toBeVisible();
  });
});

describe('Sidebar conversation list', () => {
  it('lists the stored conversations', async () => {
    await renderSidebar();

    expect(screen.getByText('Recipe for bread')).toBeInTheDocument();
    expect(screen.getByText('Debugging a rust panic')).toBeInTheDocument();
    expect(screen.getByText('Holiday planning')).toBeInTheDocument();
  });

  it('subscribes to conversation changes and unsubscribes on teardown', async () => {
    const { unmount } = await renderSidebar();
    expect(mocks.onConversationChanged).toHaveBeenCalled();

    unmount();
    expect(mocks.offConversationChanged).toHaveBeenCalled();
  });
});

describe('Sidebar search', () => {
  const search = () => screen.getByPlaceholderText('Search');

  /**
   * Searching waits for typing to stop, so nothing has been asked for until
   * the pause has passed. Asserting before then reads the list as it was.
   */
  const searched = () =>
    vi.waitFor(() => expect(mocks.searchConversations).toHaveBeenCalled());

  it('narrows the list to matching names', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'holiday');

    expect(await screen.findByText('Holiday planning')).toBeInTheDocument();
    expect(screen.queryByText('Recipe for bread')).not.toBeInTheDocument();
  });

  it('matches regardless of case', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'RUST');

    expect(
      await screen.findByText('Debugging a rust panic')
    ).toBeInTheDocument();
    expect(screen.queryByText('Holiday planning')).not.toBeInTheDocument();
  });

  it('shows an empty list when nothing matches', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'zzzzz');
    await searched();

    expect(screen.queryByText('Recipe for bread')).not.toBeInTheDocument();
    expect(screen.queryByText('Holiday planning')).not.toBeInTheDocument();
  });

  it('asks once for a word typed in one go', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'holiday');
    await searched();

    // Every message is read on each search, so one per letter is seven scans
    // of the whole store to answer a question asked once. Not pinned to
    // exactly one: rendering seven keystrokes here can outlast the pause.
    const calls = mocks.searchConversations.mock.calls;
    expect(calls.length).toBeLessThan('holiday'.length);
    expect(calls[calls.length - 1][0]).toBe('holiday');
  });

  it('restores the full list when the search is cleared', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'holiday');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(screen.getByText('Recipe for bread')).toBeInTheDocument();
    expect(search()).toHaveValue('');
  });

  it('clears the search on Escape', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'holiday');
    await user.keyboard('{Escape}');

    expect(search()).toHaveValue('');
    expect(screen.getByText('Recipe for bread')).toBeInTheDocument();
  });

  it('offers the clear control only while searching', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    expect(
      screen.queryByRole('button', { name: 'Clear search' })
    ).not.toBeInTheDocument();

    await user.type(search(), 'a');

    expect(
      screen.getByRole('button', { name: 'Clear search' })
    ).toBeInTheDocument();
  });
});

describe('Sidebar navigation', () => {
  it('starts a new chat and closes itself', async () => {
    const user = userEvent.setup();
    const { onclose } = await renderSidebar();

    await user.click(screen.getByRole('button', { name: 'New conversation' }));

    expect(mocks.goto).toHaveBeenCalledWith('/');
    expect(onclose).toHaveBeenCalled();
  });

  it('closes when the close button is used', async () => {
    const user = userEvent.setup();
    const { onclose } = await renderSidebar();

    await user.click(screen.getByRole('button', { name: 'Close sidebar' }));

    expect(onclose).toHaveBeenCalled();
  });
});

describe('Sidebar search results arriving out of order', () => {
  const search = () => screen.getByPlaceholderText('Search');

  it('keeps the newest search, not the one that answered last', async () => {
    const user = userEvent.setup();
    // Searching reads every message, so a search for a short term can take
    // longer than the narrower one typed after it.
    const pending = new Map<string, (m: ConversationMatch[]) => void>();
    mocks.searchConversations.mockImplementation(
      (term: string) =>
        new Promise<ConversationMatch[]>((res) => pending.set(term, res))
    );
    await renderSidebar();

    // Typed with a pause, so the first search is already away when the second
    // is asked for; typed together they would coalesce into one.
    await user.type(search(), 'ho');
    await vi.waitFor(() => expect(pending.has('ho')).toBe(true));
    await user.type(search(), 'l');
    await vi.waitFor(() => expect(pending.has('hol')).toBe(true));

    // The broader search answers second, with what is now the wrong answer.
    pending.get('hol')?.([{ conv: CONVERSATIONS[2] }]);
    pending.get('ho')?.([
      { conv: CONVERSATIONS[0] },
      { conv: CONVERSATIONS[1] },
    ]);

    expect(await screen.findByText('Holiday planning')).toBeInTheDocument();
    expect(screen.queryByText('Recipe for bread')).not.toBeInTheDocument();
  });
});

describe('Sidebar showing why a conversation matched', () => {
  const search = () => screen.getByPlaceholderText('Search');

  it('shows the text the match was found in', async () => {
    const user = userEvent.setup();
    mocks.searchConversations.mockResolvedValue([
      { conv: CONVERSATIONS[0], excerpt: '…and then add the yeast…' },
    ]);
    await renderSidebar();

    await user.type(search(), 'yeast');

    // The name is the opening message trimmed, so a match found deeper in a
    // conversation is otherwise a result with no visible reason for being one.
    const item = (
      await screen.findByRole('button', {
        name: `Select conversation: ${CONVERSATIONS[0].name}`,
      })
    ).closest('li');
    expect(item?.textContent).toContain('…and then add the yeast…');
  });

  it('marks the words that matched', async () => {
    const user = userEvent.setup();
    mocks.searchConversations.mockResolvedValue([
      { conv: CONVERSATIONS[0], excerpt: '…and then add the yeast…' },
    ]);
    const { container } = await renderSidebar();

    await user.type(search(), 'yeast');

    await vi.waitFor(() => {
      // Otherwise the reader has to find the term themselves, in a fragment
      // chosen precisely because it contains it.
      expect(container.querySelector('mark')?.textContent).toBe('yeast');
    });
  });

  it('shows nothing extra when the name is what matched', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'holiday');
    await screen.findByText('Holiday planning');

    expect(
      screen
        .getByRole('button', {
          name: 'Select conversation: Holiday planning',
        })
        .textContent?.trim()
    ).toBe('Holiday planning');
  });
});

describe('Sidebar searching and finding nothing', () => {
  const search = () => screen.getByPlaceholderText('Search');

  it('says so, rather than showing an empty space', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'zzzzz');

    expect(
      await screen.findByText('No conversations found')
    ).toBeInTheDocument();
  });

  it('says nothing of the sort before the search has run', async () => {
    const user = userEvent.setup();
    // Never answers, standing in for the moment between typing and the search
    // returning.
    mocks.searchConversations.mockImplementation(
      () => new Promise<ConversationMatch[]>(() => {})
    );
    await renderSidebar();

    await user.type(search(), 'holiday');

    // Otherwise the first keystroke reports failure before anything has looked.
    expect(screen.queryByText('No conversations found')).toBeNull();
  });

  it('takes it back once something matches', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'zzzzz');
    await screen.findByText('No conversations found');
    await user.clear(search());
    await user.type(search(), 'holiday');

    expect(await screen.findByText('Holiday planning')).toBeInTheDocument();
    expect(screen.queryByText('No conversations found')).toBeNull();
  });
});

describe('Sidebar being asked to search', () => {
  it('puts the cursor in the search box', async () => {
    const { component } = await renderSidebar();

    component.focusSearch();

    // The shortcut for this means "search" everywhere else that has one; here
    // it opened a sidebar that on a wide window was already open, so pressing
    // it appeared to do nothing.
    expect(screen.getByPlaceholderText('Search')).toHaveFocus();
  });

  it('selects what is already there, so a second press starts afresh', async () => {
    const user = userEvent.setup();
    const { component } = await renderSidebar();
    const box = screen.getByPlaceholderText('Search') as HTMLInputElement;
    await user.type(box, 'holiday');

    component.focusSearch();

    expect(box.selectionStart).toBe(0);
    expect(box.selectionEnd).toBe('holiday'.length);
  });
});

describe('Sidebar Escape while searching', () => {
  const search = () => screen.getByPlaceholderText('Search');

  /** What the layout listens on to close the sidebar. */
  function watchWindow() {
    const heard: KeyboardEvent[] = [];
    const listener = (e: Event) => heard.push(e as KeyboardEvent);
    window.addEventListener('keydown', listener);
    return {
      heard,
      stop: () => window.removeEventListener('keydown', listener),
    };
  }

  it('clears the search without also closing the sidebar', async () => {
    const user = userEvent.setup();
    await renderSidebar();
    await user.type(search(), 'holiday');
    const watcher = watchWindow();

    await user.keyboard('{Escape}');

    // One press should not both empty the box and take away the panel it is
    // in; the layout closes the sidebar on the same key.
    expect(search()).toHaveValue('');
    expect(watcher.heard).toHaveLength(0);
    watcher.stop();
  });

  it('lets Escape through when there is nothing to clear', async () => {
    const user = userEvent.setup();
    await renderSidebar();
    search().focus();
    const watcher = watchWindow();

    await user.keyboard('{Escape}');

    // Nothing to clear, so the press means what it means everywhere else.
    expect(watcher.heard).toHaveLength(1);
    watcher.stop();
  });
});

describe('Sidebar when the conversations cannot be read', () => {
  it('says so rather than showing an empty sidebar', async () => {
    const shown = vi.spyOn(toast, 'error').mockImplementation(() => {});
    mocks.getAllConversations.mockRejectedValue(new Error('storage blocked'));

    render(Sidebar, { props: { open: true, onclose: vi.fn() } });

    // A browser set to allow no site data has none. Left unsaid, the whole
    // history appears to have gone.
    await vi.waitFor(() => expect(shown).toHaveBeenCalled());
    shown.mockRestore();
  });

  it('does not report a failed search as nothing matching', async () => {
    const user = userEvent.setup();
    const shown = vi.spyOn(toast, 'error').mockImplementation(() => {});
    await renderSidebar();
    mocks.searchConversations.mockRejectedValue(new Error('storage blocked'));

    await user.type(screen.getByPlaceholderText('Search'), 'holiday');

    await vi.waitFor(() => expect(shown).toHaveBeenCalled());
    expect(screen.queryByText('No conversations found')).toBeNull();
    shown.mockRestore();
  });
});

describe('a sidebar with nothing in it', () => {
  it('says so when there are no conversations', async () => {
    mocks.getAllConversations.mockResolvedValue([]);

    render(Sidebar, { props: { open: true, onclose: vi.fn() } });

    // A blank panel is indistinguishable from one that failed to load.
    expect(await screen.findByText('No conversations yet')).toBeInTheDocument();
  });

  it('says nothing before the list has been read', async () => {
    // A read that never settles: what the first frame after opening looks
    // like, before the database has answered.
    mocks.getAllConversations.mockReturnValue(new Promise(() => {}));

    render(Sidebar, { props: { open: true, onclose: vi.fn() } });
    await Promise.resolve();

    expect(screen.queryByText('No conversations yet')).not.toBeInTheDocument();
  });

  it('does not claim emptiness when the read failed', async () => {
    mocks.getAllConversations.mockRejectedValue(new Error('storage blocked'));
    const failed = vi.spyOn(toast, 'error');

    render(Sidebar, { props: { open: true, onclose: vi.fn() } });
    await vi.waitFor(() => expect(failed).toHaveBeenCalled());

    // Telling someone whose storage is unavailable that they have no
    // conversations is the same lie as showing them an empty history.
    expect(screen.queryByText('No conversations yet')).not.toBeInTheDocument();
    failed.mockRestore();
  });

  it('stops saying so once there is a conversation', async () => {
    await renderSidebar();

    expect(screen.queryByText('No conversations yet')).not.toBeInTheDocument();
  });
});
