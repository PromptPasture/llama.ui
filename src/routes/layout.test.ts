import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  startServiceWorker: vi.fn(),
  showConfirm: vi.fn().mockResolvedValue(false),
  offerToConfigure: vi.fn().mockResolvedValue(false),
  getPresets: vi.fn().mockResolvedValue([]),
  getAllConversations: vi.fn().mockResolvedValue([]),
  searchConversations: vi.fn().mockResolvedValue([]),
  onConversationChanged: vi.fn(),
  offConversationChanged: vi.fn(),
  pathname: '/',
}));

vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$app/state', () => ({
  page: {
    params: {},
    get url() {
      return { pathname: mocks.pathname };
    },
  },
}));
vi.mock('$lib/service-worker', () => ({
  startServiceWorker: mocks.startServiceWorker,
}));
vi.mock('$lib/state/modal.svelte', () => ({
  modal: {
    showConfirm: mocks.showConfirm,
    get current() {
      return null;
    },
  },
}));
vi.mock('$lib/first-run', async (original) => ({
  ...(await original<typeof import('$lib/first-run')>()),
  offerToConfigure: mocks.offerToConfigure,
}));
vi.mock('$lib/database/indexedDB', () => ({
  default: {
    getPresets: mocks.getPresets,
    getAllConversations: mocks.getAllConversations,
    searchConversations: mocks.searchConversations,
    onConversationChanged: mocks.onConversationChanged,
    offConversationChanged: mocks.offConversationChanged,
  },
}));

const { default: LayoutHarness } = await import('./layout.harness.svelte');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = '/';
  mocks.showConfirm.mockResolvedValue(false);
});

/** The layout draws nothing until it has read the stored configuration. */
async function renderApp() {
  const rendered = render(LayoutHarness);
  await screen.findByText('the page itself');
  return rendered;
}

describe('the shortcuts the app answers to', () => {
  it('starts a conversation on Ctrl+N', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.keyboard('{Control>}n{/Control}');

    expect(mocks.goto).toHaveBeenCalledWith('/');
  });

  it('answers to Command as well, for the keyboards that have one', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.keyboard('{Meta>}n{/Meta}');

    // The tooltips promise ⌘N on a Mac; nothing checked that it worked.
    expect(mocks.goto).toHaveBeenCalledWith('/');
  });

  it('opens the settings on Ctrl+,', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.keyboard('{Control>},{/Control}');

    expect(mocks.goto).toHaveBeenCalledWith('/settings');
  });

  it('opens the sidebar on Ctrl+K', async () => {
    const user = userEvent.setup();
    const { container } = await renderApp();

    await user.keyboard('{Control>}k{/Control}');

    expect(container.querySelector('.sidebar.open')).not.toBeNull();
  });

  it('puts the cursor in the search box', async () => {
    const user = userEvent.setup();
    const { container } = await renderApp();

    await user.keyboard('{Control>}k{/Control}');

    // Opening the sidebar without reaching the box leaves the reader to click
    // it, which is the thing the shortcut was for.
    expect(document.activeElement).toBe(
      container.querySelector('.sidebar__search-input')
    );
  });

  it('closes the sidebar on Escape', async () => {
    const user = userEvent.setup();
    const { container } = await renderApp();
    await user.keyboard('{Control>}k{/Control}');

    await user.keyboard('{Escape}');

    expect(container.querySelector('.sidebar.open')).toBeNull();
  });

  it('leaves a plain keystroke to whatever is being typed into', async () => {
    const user = userEvent.setup();
    await renderApp();

    await user.keyboard('n');

    expect(mocks.goto).not.toHaveBeenCalled();
  });
});

describe('when a new version of the app is waiting', () => {
  it('asks with buttons that say what they do', async () => {
    await renderApp();

    const ask = mocks.startServiceWorker.mock.calls[0]?.[0] as () => void;
    expect(ask).toBeTypeOf('function');
    ask();

    // A bare OK and Cancel is what it showed, while this wording sat in every
    // catalogue.
    expect(mocks.showConfirm).toHaveBeenCalledWith(
      'Update for the latest features & fixes.',
      { confirm: 'Update', cancel: 'Later' }
    );
  });
});
