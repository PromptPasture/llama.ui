import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { init, register, waitLocale } from 'svelte-i18n';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  importDB: vi.fn().mockResolvedValue(undefined),
  exportDB: vi.fn().mockResolvedValue([]),
  downloadAsFile: vi.fn(),
  showConfirm: vi.fn().mockResolvedValue(true),
  getAllConversations: vi.fn().mockResolvedValue([]),
  deleteAllConversations: vi.fn().mockResolvedValue(0),
  forgetDatabase: vi.fn().mockResolvedValue(undefined),
  forgetEverything: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('$lib/state/app.svelte', () => ({ app: mocks }));
vi.mock('$lib/utils/downloadAsFile', () => ({
  downloadAsFile: mocks.downloadAsFile,
}));
vi.mock('$lib/state/modal.svelte', () => ({
  modal: { showConfirm: mocks.showConfirm },
}));
vi.mock('$lib/database/indexedDB', () => ({
  default: {
    getAllConversations: mocks.getAllConversations,
    deleteAllConversations: mocks.deleteAllConversations,
    forgetEverything: mocks.forgetDatabase,
  },
}));
vi.mock('$lib/database/localStorage', () => ({
  default: { forgetEverything: mocks.forgetEverything },
}));
vi.mock('$lib/components/toast.js', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const { default: ImportExportTab } = await import('./ImportExportTab.svelte');

// Set the locale explicitly rather than going through initI18n(), which picks
// its initial locale from navigator.language and is not deterministic here.
beforeAll(async () => {
  register('en', () => import('../../lib/i18n/en.json'));
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

beforeEach(() => {
  // Each of these decides for itself what is stored and what the reader
  // answers; left over, whichever test ran last decides instead.
  mocks.showConfirm.mockReset().mockResolvedValue(true);
  mocks.getAllConversations.mockReset().mockResolvedValue([]);
  mocks.deleteAllConversations.mockReset().mockResolvedValue(0);
  mocks.forgetDatabase.mockReset().mockResolvedValue(undefined);
  mocks.forgetEverything.mockReset();
  mocks.success.mockClear();
  mocks.error.mockClear();
});

function renderTab() {
  const result = render(ImportExportTab, { props: { onclose: () => {} } });
  const fileInput = result.container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  return { ...result, fileInput };
}

describe('ImportExportTab import control', () => {
  it('is a real button rather than a label wearing a button role', () => {
    renderTab();
    const button = screen.getByRole('button', { name: 'Import' });
    expect(button.tagName).toBe('BUTTON');
  });

  it('opens the file picker when clicked', async () => {
    const user = userEvent.setup();
    const { fileInput } = renderTab();
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => {});

    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('opens the file picker from the keyboard with Enter', async () => {
    const user = userEvent.setup();
    const { fileInput } = renderTab();
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => {});

    screen.getByRole('button', { name: 'Import' }).focus();
    await user.keyboard('{Enter}');

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('opens the file picker from the keyboard with Space', async () => {
    const user = userEvent.setup();
    const { fileInput } = renderTab();
    const click = vi.spyOn(fileInput, 'click').mockImplementation(() => {});

    screen.getByRole('button', { name: 'Import' }).focus();
    await user.keyboard(' ');

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('is reachable by tabbing, alongside export', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Import' })).toHaveFocus();
  });

  it('clears the input so a rejected file can be chosen again', async () => {
    const user = userEvent.setup();
    mocks.importDB.mockRejectedValueOnce(new Error('not a llama.ui export'));
    const { fileInput } = renderTab();

    await user.upload(
      fileInput,
      new File(['nonsense'], 'wrong.json', { type: 'application/json' })
    );

    // Selecting an unchanged value fires no change event, so without this the
    // user cannot retry the same file after fixing it.
    expect(mocks.importDB).toHaveBeenCalled();
    expect(fileInput.value).toBe('');
  });

  it('clears the input after a successful import too', async () => {
    const user = userEvent.setup();
    mocks.importDB.mockResolvedValueOnce(undefined);
    const { fileInput } = renderTab();

    await user.upload(
      fileInput,
      new File(['[]'], 'db.json', { type: 'application/json' })
    );

    expect(fileInput.value).toBe('');
  });

  it('does not close the settings screen when the import fails', async () => {
    const user = userEvent.setup();
    mocks.importDB.mockRejectedValueOnce(new Error('malformed conversation'));
    const onclose = vi.fn();
    const { container } = render(ImportExportTab, { props: { onclose } });
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    await user.upload(
      input,
      new File(['{}'], 'bad.json', { type: 'application/json' })
    );

    expect(onclose).not.toHaveBeenCalled();
  });

  it('keeps the file input itself out of the tab order', () => {
    const { fileInput } = renderTab();
    expect(fileInput).toHaveAttribute('hidden');
    expect(fileInput).toHaveAttribute('accept', '.json');
  });
});

describe('what the exported database is called', () => {
  it('carries the day it was taken', async () => {
    const user = userEvent.setup();
    mocks.downloadAsFile.mockClear();
    renderTab();

    await user.click(screen.getByRole('button', { name: /Export/i }));

    // A fixed name leaves the browser to tell two backups apart by appending
    // (1) to the second.
    const [, name] = mocks.downloadAsFile.mock.calls[0];
    expect(name).toMatch(/^llama-ui-database-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('clearing the history', () => {
  const twoStored = () => {
    mocks.getAllConversations.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    mocks.deleteAllConversations.mockResolvedValue(2);
  };

  async function pressDeleteAll() {
    const user = userEvent.setup();
    render(ImportExportTab, { props: { onclose: () => {} } });
    await user.click(
      screen.getByRole('button', { name: 'Delete all conversations' })
    );
  }

  it('asks first, saying how many and that it cannot be undone', async () => {
    twoStored();

    await pressDeleteAll();

    // Everything is kept in this browser and nowhere else.
    expect(mocks.showConfirm).toHaveBeenCalledWith(
      expect.stringContaining('2')
    );
    expect(mocks.showConfirm.mock.calls[0][0]).toMatch(/cannot be undone/i);
  });

  it('deletes them once that is agreed to', async () => {
    twoStored();
    mocks.showConfirm.mockResolvedValue(true);

    await pressDeleteAll();

    expect(mocks.deleteAllConversations).toHaveBeenCalled();
  });

  it('deletes nothing when the answer is no', async () => {
    twoStored();
    mocks.showConfirm.mockResolvedValue(false);

    await pressDeleteAll();

    expect(mocks.deleteAllConversations).not.toHaveBeenCalled();
    mocks.showConfirm.mockResolvedValue(true);
  });

  it('does not ask when there is nothing stored', async () => {
    mocks.getAllConversations.mockResolvedValue([]);

    await pressDeleteAll();

    // A confirmation for deleting nothing is a question with one answer.
    expect(mocks.showConfirm).not.toHaveBeenCalled();
    expect(mocks.deleteAllConversations).not.toHaveBeenCalled();
  });

  it('says how many went', async () => {
    twoStored();

    await pressDeleteAll();

    await vi.waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('2'))
    );
  });

  it('says so when they could not be deleted', async () => {
    twoStored();
    mocks.deleteAllConversations.mockRejectedValue(new Error('storage gone'));

    await pressDeleteAll();

    // Some may have gone already; silence would leave the reader believing
    // the rest went too.
    await vi.waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'Could not delete the conversations.'
      )
    );
  });
});

describe('handing the machine on', () => {
  async function pressForgetEverything(onreload = vi.fn()) {
    const user = userEvent.setup();
    render(ImportExportTab, { props: { onclose: () => {}, onreload } });
    await user.click(screen.getByRole('button', { name: 'Forget everything' }));
    return onreload;
  }

  it('asks first, naming what goes', async () => {
    await pressForgetEverything();

    const asked = mocks.showConfirm.mock.calls[0][0] as string;
    expect(asked).toMatch(/api key/i);
    expect(asked).toMatch(/cannot be undone/i);
  });

  it('forgets the conversations, the presets and the key', async () => {
    await pressForgetEverything();

    // Deleting the conversations alone leaves the credential behind, which is
    // the part that matters when the machine changes hands.
    await vi.waitFor(() => {
      expect(mocks.forgetDatabase).toHaveBeenCalled();
      expect(mocks.forgetEverything).toHaveBeenCalled();
    });
  });

  it('starts the app again, so nothing forgotten is still in memory', async () => {
    const onreload = await pressForgetEverything();

    await vi.waitFor(() => expect(onreload).toHaveBeenCalled());
  });

  it('forgets nothing when the answer is no', async () => {
    mocks.showConfirm.mockResolvedValue(false);

    const onreload = await pressForgetEverything();

    expect(mocks.forgetDatabase).not.toHaveBeenCalled();
    expect(mocks.forgetEverything).not.toHaveBeenCalled();
    expect(onreload).not.toHaveBeenCalled();
  });

  it('says so, and stays put, when it could not', async () => {
    mocks.forgetDatabase.mockRejectedValue(new Error('storage gone'));

    const onreload = await pressForgetEverything();

    await vi.waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('Could not forget everything.')
    );
    // Reloading would look like it had worked.
    expect(onreload).not.toHaveBeenCalled();
  });
});
