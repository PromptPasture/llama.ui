import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '$lib/types';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  getAllConversations: vi.fn(),
  onConversationChanged: vi.fn(),
  offConversationChanged: vi.fn(),
}));

vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$app/state', () => ({ page: { params: {} } }));
vi.mock('$lib/database/indexedDB', () => ({
  default: {
    getAllConversations: mocks.getAllConversations,
    onConversationChanged: mocks.onConversationChanged,
    offConversationChanged: mocks.offConversationChanged,
  },
}));

const { default: Sidebar } = await import('./Sidebar.svelte');

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
});

async function renderSidebar(props: Record<string, unknown> = {}) {
  const onclose = vi.fn();
  const result = render(Sidebar, { props: { open: true, onclose, ...props } });
  // the list is populated from an async load
  await screen.findByText('Recipe for bread');
  return { ...result, onclose };
}

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
  const search = () => screen.getByPlaceholderText('Search conversations...');

  it('narrows the list to matching names', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'holiday');

    expect(screen.getByText('Holiday planning')).toBeInTheDocument();
    expect(screen.queryByText('Recipe for bread')).not.toBeInTheDocument();
  });

  it('matches regardless of case', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'RUST');

    expect(screen.getByText('Debugging a rust panic')).toBeInTheDocument();
    expect(screen.queryByText('Holiday planning')).not.toBeInTheDocument();
  });

  it('shows an empty list when nothing matches', async () => {
    const user = userEvent.setup();
    await renderSidebar();

    await user.type(search(), 'zzzzz');

    expect(screen.queryByText('Recipe for bread')).not.toBeInTheDocument();
    expect(screen.queryByText('Holiday planning')).not.toBeInTheDocument();
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
