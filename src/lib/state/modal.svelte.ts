type ModalType = 'confirm' | 'prompt' | 'alert';

interface ModalEntry {
  type: ModalType;
  message: string;
  defaultValue?: string;
  resolve: (value: boolean | string | undefined) => void;
}

const state = $state<{ current: ModalEntry | null }>({ current: null });

function open(entry: ModalEntry): void {
  state.current = entry;
}

function close(): void {
  state.current = null;
}

export const modal = {
  get current() {
    return state.current;
  },

  showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      open({ type: 'confirm', message, resolve: resolve as ModalEntry['resolve'] });
    });
  },

  showPrompt(message: string, defaultValue?: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      open({ type: 'prompt', message, defaultValue, resolve: resolve as ModalEntry['resolve'] });
    });
  },

  showAlert(message: string): Promise<void> {
    return new Promise((resolve) => {
      open({ type: 'alert', message, resolve: resolve as ModalEntry['resolve'] });
    });
  },

  respond(value: boolean | string | undefined): void {
    state.current?.resolve(value);
    close();
  },
};
