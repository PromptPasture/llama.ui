import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AfterNavigate } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  afterNavigate: vi.fn(),
}));

vi.mock('$app/navigation', () => ({
  goto: mocks.goto,
  afterNavigate: mocks.afterNavigate,
}));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));

const { default: SettingsPage } = await import('./+page.svelte');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(() => {
  mocks.goto.mockClear();
  mocks.afterNavigate.mockClear();
});

/** Replays the navigation that brought the user to the settings. */
function arriveFrom(pathname: string | null) {
  const callback = mocks.afterNavigate.mock.calls[0]?.[0] as (
    n: Pick<AfterNavigate, 'from'>
  ) => void;
  if (!callback) throw new Error('the settings page no longer tracks arrivals');
  callback({
    from: pathname
      ? ({
          url: new URL(`http://localhost${pathname}`),
        } as AfterNavigate['from'])
      : null,
  });
}

describe('leaving the settings', () => {
  it('returns to the conversation it was opened from', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1755000000000');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    // Going to '/' instead would strand the user on an empty new chat, with
    // the conversation they were reading only reachable via the sidebar.
    expect(mocks.goto).toHaveBeenCalledWith('/chat/1755000000000');
  });

  it('returns there after saving too', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1755000000000');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mocks.goto).toHaveBeenCalledWith('/chat/1755000000000');
  });

  it('falls back to a new chat when opened directly', async () => {
    render(SettingsPage);
    // A bookmark, a shared link, or the installed app's launcher: there is no
    // previous page to go back to.
    arriveFrom(null);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(mocks.goto).toHaveBeenCalledWith('/');
  });

  it('does not send the settings back to themselves', async () => {
    render(SettingsPage);
    arriveFrom('/settings');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(mocks.goto).toHaveBeenCalledWith('/');
  });
});
