import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

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
  models: [] as { id: string; name: string }[],
  initialize: vi.fn().mockResolvedValue(undefined),
  modelToAdopt: vi.fn().mockReturnValue(null),
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
vi.mock('$lib/state/inference.svelte', () => ({
  inference: {
    initialize: mocks.initialize,
    modelToAdopt: mocks.modelToAdopt,
    get models() {
      return mocks.models;
    },
    get provider() {
      return null;
    },
  },
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
const { SETUP_GRACE_MS } = await import('$lib/first-run');
const { app } = await import('$lib/state/app.svelte');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = '/';
  mocks.models = [];
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
      { confirm: 'Update', cancel: 'Later', danger: false }
    );
  });
});

describe('offering to set a provider up', () => {
  /**
   * The offer waits before it is made, so a provider that is merely slow to
   * list its models is not mistaken for none at all.
   */
  async function waitOutTheGracePeriod() {
    await vi.advanceTimersByTimeAsync(SETUP_GRACE_MS + 100);
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers when there is nothing to send a message to', async () => {
    render(LayoutHarness);
    await vi.advanceTimersByTimeAsync(0);

    await waitOutTheGracePeriod();

    // A first visitor has no reason to know the app cannot answer anything
    // until a provider is configured.
    expect(mocks.offerToConfigure).toHaveBeenCalled();
  });

  it('says nothing until the models have had time to arrive', async () => {
    render(LayoutHarness);
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(SETUP_GRACE_MS - 100);

    expect(mocks.offerToConfigure).not.toHaveBeenCalled();
  });

  it('says nothing while the settings are already open', async () => {
    mocks.pathname = '/settings';
    render(LayoutHarness);
    await vi.advanceTimersByTimeAsync(0);

    await waitOutTheGracePeriod();

    // That is where the offer leads, and someone reading them has found
    // their own way there.
    expect(mocks.offerToConfigure).not.toHaveBeenCalled();
  });

  it('says nothing to someone whose provider works', async () => {
    mocks.models = [{ id: 'a-model', name: 'A model' }];
    render(LayoutHarness);
    await vi.advanceTimersByTimeAsync(0);

    await waitOutTheGracePeriod();

    // Interrupting someone who is set up to tell them they are not is the
    // worst version of this.
    expect(mocks.offerToConfigure).not.toHaveBeenCalled();
  });

  it('offers against the configured address', async () => {
    app.saveConfig({ ...app.config, baseUrl: 'http://localhost:8080' });
    render(LayoutHarness);
    await vi.advanceTimersByTimeAsync(0);

    await waitOutTheGracePeriod();

    // The wording depends on it: an empty address means a first visit, and
    // one that is set means a provider that answered with no models.
    expect(mocks.offerToConfigure).toHaveBeenCalledWith(
      'http://localhost:8080'
    );
  });
});

describe('keeping the inference provider in step with the settings', () => {
  it('sets it up from the stored configuration', async () => {
    await renderApp();

    expect(mocks.initialize).toHaveBeenCalledWith(app.config);
  });

  it('writes back the model it had to fall back to', async () => {
    mocks.modelToAdopt.mockReturnValue('a-model-that-exists');

    await renderApp();

    // Held only in memory, the picker in the header disagreed with what
    // messages were actually being sent to.
    await vi.waitFor(() =>
      expect(app.config.model).toBe('a-model-that-exists')
    );
  });

  it('leaves the chosen model alone when it can be used', async () => {
    app.saveConfig({ ...app.config, model: 'the-chosen-one' });
    mocks.modelToAdopt.mockReturnValue(null);

    await renderApp();

    expect(app.config.model).toBe('the-chosen-one');
  });
});
