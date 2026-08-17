import { render, screen } from '@testing-library/svelte';
import { init, register, waitLocale } from 'svelte-i18n';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const { default: ModalHost } = await import('./ModalHost.svelte');
const { modal } = await import('$lib/state/modal.svelte');

// jsdom implements neither showModal nor close; these stand in for the parts
// this component relies on. See Dialog.test.ts, which does the same.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

beforeAll(async () => {
  register('en', () => import('$lib/i18n/en.json'));
  void init({ fallbackLocale: 'en', initialLocale: 'en' });
  await waitLocale('en');
});

afterEach(() => {
  for (let i = 0; modal.current && i < 20; i++) modal.respond(undefined);
});

describe('the buttons of a confirmation', () => {
  it('says what the two choices do, when it was told', async () => {
    render(ModalHost);
    void modal.showConfirm('Set up a provider?', {
      confirm: 'Open Settings',
      cancel: 'Skip',
    });

    // 'OK' says nothing about where it leads.
    expect(
      await screen.findByRole('button', { name: 'Open Settings' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });

  it('falls back to the translated pair otherwise', async () => {
    render(ModalHost);
    void modal.showConfirm('Delete everything?');

    expect(
      await screen.findByRole('button', { name: 'Confirm' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('answers with the choice that was pressed', async () => {
    render(ModalHost);
    const answer = modal.showConfirm('Set up a provider?', {
      confirm: 'Open Settings',
      cancel: 'Skip',
    });

    (await screen.findByRole('button', { name: 'Open Settings' })).click();

    expect(await answer).toBe(true);
  });
});

describe('how a confirmation looks', () => {
  it('warns by default, because most of these destroy something', async () => {
    const answered = modal.showConfirm('Delete everything?');
    render(ModalHost);

    // Delete a conversation, forget everything, discard the settings: the
    // common case here is losing something.
    expect(screen.getByRole('button', { name: 'Confirm' }).className).toContain(
      'btn--danger'
    );
    modal.respond(false);
    await answered;
  });

  it('does not warn when nothing is being destroyed', async () => {
    const answered = modal.showConfirm('Update available', {
      confirm: 'Update',
      danger: false,
    });
    render(ModalHost);

    // An offer to update, or to open the settings on a first visit, is not a
    // warning and should not be dressed as one.
    const button = screen.getByRole('button', { name: 'Update' });
    expect(button.className).not.toContain('btn--danger');
    modal.respond(false);
    await answered;
  });
});
