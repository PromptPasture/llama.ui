type ModalType = 'confirm' | 'prompt' | 'alert';

interface ModalEntry {
  type: ModalType;
  message: string;
  defaultValue?: string;
  /** Wording for the buttons, when the generic pair does not say enough. */
  labels?: ModalLabels;
  resolve: (value: boolean | string | undefined) => void;
}

export interface ModalLabels {
  confirm?: string;
  cancel?: string;
  /**
   * Whether saying yes destroys something.
   *
   * True unless said otherwise: most of what is asked here deletes a
   * conversation or overwrites the settings, and warning where there is no
   * danger is the lesser of the two mistakes. An offer to update, or to open
   * the settings on a first visit, is not a warning and should not look like
   * one.
   */
  danger?: boolean;
}

/**
 * Questions waiting to be answered, the first of which is on screen.
 *
 * A queue rather than one at a time: asking a second question used to replace
 * the first, and whoever was waiting on that one waited for ever. Nothing on
 * screen can ask while a modal is open — the dialog makes the rest of the page
 * inert — but a service worker finding an update does not go through the page.
 */
const state = $state<{ queue: ModalEntry[] }>({ queue: [] });

function open(entry: ModalEntry): void {
  state.queue = [...state.queue, entry];
}

export const modal = {
  get current() {
    return state.queue[0] ?? null;
  },

  showConfirm(message: string, labels?: ModalLabels): Promise<boolean> {
    return new Promise((resolve) => {
      open({
        type: 'confirm',
        message,
        labels,
        resolve: resolve as ModalEntry['resolve'],
      });
    });
  },

  showPrompt(
    message: string,
    defaultValue?: string
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      open({
        type: 'prompt',
        message,
        defaultValue,
        resolve: resolve as ModalEntry['resolve'],
      });
    });
  },

  showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      open({
        type: 'alert',
        message,
        resolve: resolve as ModalEntry['resolve'],
      });
    });
  },

  respond(value: boolean | string | undefined): void {
    const answered = state.queue[0];
    if (!answered) return;
    // Taken off the queue before resolving, so the next question is the
    // current one by the time anyone waiting on this one runs.
    state.queue = state.queue.slice(1);
    answered.resolve(value);
  },
};
