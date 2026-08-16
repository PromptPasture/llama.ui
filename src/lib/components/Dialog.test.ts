import { render } from '@testing-library/svelte';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import DialogHarness from './Dialog.harness.svelte';

// jsdom implements neither showModal nor close, so the modal behaviour a
// browser provides — focus trapping, dismissing on Escape — cannot be
// exercised here. These stand in for the parts of the contract this component
// relies on: opening marks the dialog open, closing emits `close`.
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

function open(onclose = vi.fn()) {
  const result = render(DialogHarness, {
    props: { open: true, title: 'Delete everything?', onclose },
  });
  const dialog = result.container.querySelector('dialog')!;
  return { ...result, dialog, onclose };
}

describe('showing a dialog', () => {
  it('opens as a modal and shows its title', () => {
    const { dialog } = open();

    expect(dialog.open).toBe(true);
    expect(dialog).toHaveTextContent('Delete everything?');
  });

  it('names itself by its title for assistive technology', () => {
    const { dialog } = open();

    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(dialog.querySelector(`#${labelledBy}`)).toHaveTextContent(
      'Delete everything?'
    );
  });
});

describe('closing a dialog', () => {
  it('reports the close once, not twice', () => {
    const { dialog, onclose } = open();

    dialog.close();

    // Escape used to be handled here as well as by the dialog itself, so a
    // single dismissal reported twice.
    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('reports nothing until it actually closes', () => {
    const { onclose } = open();

    expect(onclose).not.toHaveBeenCalled();
  });
});
