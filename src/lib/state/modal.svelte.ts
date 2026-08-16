type ModalType = 'confirm' | 'prompt' | 'alert';

interface ModalEntry {
  type: ModalType;
  message: string;
  defaultValue?: string;
  resolve: (value: boolean | string | undefined) => void;
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

  showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      open({
        type: 'confirm',
        message,
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
