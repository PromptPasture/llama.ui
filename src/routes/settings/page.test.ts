// Loading a preset reads the presets out of IndexedDB.
import 'fake-indexeddb/auto';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AfterNavigate } from '@sveltejs/kit';
import CONFIG_DEFAULT from '$lib/config/config-default.json';
import type { Configuration } from '$lib/types';

const mocks = vi.hoisted(() => ({
  goto: vi.fn(),
  afterNavigate: vi.fn(),
  beforeNavigate: vi.fn(),
  showConfirm: vi.fn().mockResolvedValue(true),
  showAlert: vi.fn(),
}));

vi.mock('$app/navigation', () => ({
  goto: mocks.goto,
  afterNavigate: mocks.afterNavigate,
  beforeNavigate: mocks.beforeNavigate,
}));
vi.mock('$app/paths', () => ({ resolve: (p: string) => p }));
vi.mock('$lib/state/modal.svelte', () => ({
  modal: { showConfirm: mocks.showConfirm, showAlert: mocks.showAlert },
}));

const { default: SettingsPage } = await import('./+page.svelte');
const { app } = await import('$lib/state/app.svelte');
const { inference } = await import('$lib/state/inference.svelte');
const { toast } = await import('$lib/components/toast');

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(() => {
  mocks.goto.mockClear();
  mocks.afterNavigate.mockClear();
  mocks.beforeNavigate.mockClear();
  mocks.showConfirm.mockClear().mockResolvedValue(true);
  // The page reads and writes the real configuration, so a test that saves
  // one would otherwise decide where the next test starts from.
  localStorage.clear();
  app.saveConfig({ ...CONFIG_DEFAULT } as unknown as Configuration);
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

describe('leaving with something typed but not saved', () => {
  /** Types into a real field so the page sees a genuine edit. */
  async function edit() {
    const field = screen.getByRole('textbox', { name: /API Key/i });
    await userEvent.type(field, 'sk-typed-but-not-saved');
  }

  it('leaves without asking when nothing was touched', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(mocks.showConfirm).not.toHaveBeenCalled();
    expect(mocks.goto).toHaveBeenCalledWith('/chat/1');
  });

  it('asks before throwing the changes away', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1');
    await edit();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    // Close sits next to Save and discards everything typed since the page
    // opened; a rewritten system prompt is a lot to lose to a misclick.
    expect(mocks.showConfirm).toHaveBeenCalled();
  });

  it('stays put when the reader says no', async () => {
    mocks.showConfirm.mockResolvedValue(false);
    render(SettingsPage);
    arriveFrom('/chat/1');
    await edit();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(mocks.goto).not.toHaveBeenCalled();
  });

  it('does not ask when saving, which keeps them', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1');
    await edit();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mocks.showConfirm).not.toHaveBeenCalled();
    expect(mocks.goto).toHaveBeenCalledWith('/chat/1');
  });
  it('does not ask after saving a number it had to convert', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1');

    // A text field hands back a string, so saving a numeric setting converts
    // it. That leaves the page's copy and the stored one unequal even though
    // nothing is outstanding — enough to ask about discarding what was just
    // saved, if saving went through the same door as closing.
    await userEvent.click(screen.getByRole('tab', { name: 'Advanced' }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Override Generation Options' })
    );
    const temperature = screen.getByRole('textbox', { name: 'temperature' });
    await userEvent.clear(temperature);
    await userEvent.type(temperature, '0.7');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mocks.showConfirm).not.toHaveBeenCalled();
    expect(mocks.goto).toHaveBeenCalledWith('/chat/1');
  });
  it('does not ask after loading a preset, which also stores one', async () => {
    await app.savePreset('Fast', { ...app.config, systemMessage: 'be brief' });
    render(SettingsPage);
    arriveFrom('/chat/1');

    await userEvent.click(screen.getByRole('tab', { name: 'Presets' }));
    // Loading asks for its own confirmation first, which the mock accepts.
    await userEvent.click(screen.getByRole('button', { name: 'Load' }));

    // The page's own copy still holds what was on screen before the preset
    // replaced it, so going through the guard here would offer to discard the
    // preset that was just loaded.
    expect(mocks.showConfirm).not.toHaveBeenCalledWith('Discard your changes?');
    expect(mocks.goto).toHaveBeenCalledWith('/chat/1');
  });
});

describe('leaving by some other route than the Close button', () => {
  /** Replays a navigation SvelteKit is about to start, and reports it. */
  function navigateAway(
    to: string | null,
    type: 'link' | 'popstate' | 'leave' = 'link'
  ) {
    const guard = mocks.beforeNavigate.mock.calls[0]?.[0] as (
      n: unknown
    ) => void;
    if (!guard) throw new Error('the settings page no longer guards leaving');
    const cancel = vi.fn();
    guard({
      type,
      to: to ? { url: new URL(`http://localhost${to}`) } : null,
      cancel,
    });
    return cancel;
  }

  async function edit() {
    await userEvent.type(
      screen.getByRole('textbox', { name: /API Key/i }),
      'sk-typed'
    );
  }

  it('lets a navigation through when nothing was touched', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1');

    const cancel = navigateAway('/chat/2');

    expect(cancel).not.toHaveBeenCalled();
    expect(mocks.showConfirm).not.toHaveBeenCalled();
  });

  it('stops a sidebar click long enough to ask', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1');
    await edit();

    const cancel = navigateAway('/chat/2');

    // The answer cannot be awaited inside the callback, so the navigation has
    // to be stopped first.
    expect(cancel).toHaveBeenCalled();
    expect(mocks.showConfirm).toHaveBeenCalled();
  });

  it('goes where it was headed once the reader agrees', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1');
    await edit();

    navigateAway('/chat/2');
    await vi.waitFor(() =>
      expect(mocks.goto).toHaveBeenCalledWith(
        new URL('http://localhost/chat/2')
      )
    );
  });

  it('stays put when the reader declines', async () => {
    mocks.showConfirm.mockResolvedValue(false);
    render(SettingsPage);
    arriveFrom('/chat/1');
    await edit();

    navigateAway('/chat/2');

    await expect
      .poll(() => mocks.goto.mock.calls.length, { timeout: 200 })
      .toBe(0);
  });

  it('handles the browser back gesture the same way', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1');
    await edit();

    const cancel = navigateAway('/chat/1', 'popstate');

    expect(cancel).toHaveBeenCalled();
  });

  it('refuses to unload so the browser asks instead', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1');
    await edit();

    // Closing the tab cannot show a dialog of ours; refusing here is what
    // makes the browser show its own.
    const cancel = navigateAway(null, 'leave');

    expect(cancel).toHaveBeenCalled();
  });

  it('does not interfere with leaving on purpose', async () => {
    render(SettingsPage);
    arriveFrom('/chat/1');

    // Deliberately a numeric setting. Saving converts the string a text field
    // hands back into a number, so the page's copy and the stored one stay
    // unequal afterwards — meaning 'nothing was edited' is not what keeps the
    // guard quiet here, and the flag set on the way out has to be.
    await userEvent.click(screen.getByRole('tab', { name: 'Advanced' }));
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Override Generation Options' })
    );
    const temperature = screen.getByRole('textbox', { name: 'temperature' });
    await userEvent.clear(temperature);
    await userEvent.type(temperature, '0.7');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    mocks.showConfirm.mockClear();

    const cancel = navigateAway('/chat/1', 'link');

    expect(cancel).not.toHaveBeenCalled();
    expect(mocks.showConfirm).not.toHaveBeenCalled();
  });
});

describe('finding out whether the settings work', () => {
  it('says why the models could not be fetched', async () => {
    const failure = vi
      .spyOn(inference, 'fetchModels')
      .mockRejectedValue(new Error('Unauthorized: Invalid or missing API key'));
    const shown = vi.spyOn(toast, 'error').mockImplementation(() => {});
    render(SettingsPage);
    arriveFrom('/chat/1');

    await userEvent.click(screen.getByRole('button', { name: 'Fetch Models' }));

    // Pressing it and seeing nothing happen is the same view a wrong url, a
    // rejected key and a server that is down all used to give.
    expect(shown).toHaveBeenCalledWith(
      expect.stringContaining('Unauthorized: Invalid or missing API key')
    );
    failure.mockRestore();
    shown.mockRestore();
  });

  it('says nothing when they do work', async () => {
    const ok = vi.spyOn(inference, 'fetchModels').mockResolvedValue([]);
    const shown = vi.spyOn(toast, 'error').mockImplementation(() => {});
    render(SettingsPage);
    arriveFrom('/chat/1');

    await userEvent.click(screen.getByRole('button', { name: 'Fetch Models' }));

    expect(shown).not.toHaveBeenCalled();
    ok.mockRestore();
    shown.mockRestore();
  });
});
