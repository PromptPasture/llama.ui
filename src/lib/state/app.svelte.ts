import { CONFIG_DEFAULT } from '$lib/config';
import IndexedDB from '$lib/database/indexedDB';
import LocalStorage from '$lib/database/localStorage';
import { t } from '$lib/i18n/translate';
import type {
  Configuration,
  ConfigurationPreset,
  ExportJsonStructure,
} from '$lib/types';

type ToastFn = (message: string) => void;

interface AppState {
  config: Configuration;
  presets: ConfigurationPreset[];
  currentTheme: string;
}

const state = $state<AppState>({
  config: CONFIG_DEFAULT,
  presets: [],
  currentTheme: 'light',
});

export const app = {
  get config() {
    return state.config;
  },
  get presets() {
    return state.presets;
  },
  get currentTheme() {
    return state.currentTheme;
  },

  async init(): Promise<void> {
    state.config = LocalStorage.getConfig();
    state.presets = await IndexedDB.getPresets();
    const savedTheme = LocalStorage.getTheme();
    app.switchTheme(savedTheme);

    // The configuration is read once and written back whole — the model
    // picker saves the entire object. A second tab that had loaded the older
    // configuration would therefore undo whatever the first had changed, so
    // adopt what another tab writes. The event only fires in other tabs.
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === 'config') state.config = LocalStorage.getConfig();
    });
  },

  saveConfig(config: Configuration): void {
    LocalStorage.setConfig(config);
    state.config = config;
  },

  async savePreset(
    name: string,
    config: Configuration,
    toast?: ToastFn
  ): Promise<void> {
    await IndexedDB.savePreset(name, config);
    state.presets = await IndexedDB.getPresets();
    toast?.(t('state.preset.saved'));
  },

  async removePreset(name: string, toast?: ToastFn): Promise<void> {
    await IndexedDB.removePreset(name);
    state.presets = await IndexedDB.getPresets();
    toast?.(t('state.preset.removed'));
  },

  switchTheme(theme: string): void {
    LocalStorage.setTheme(theme);
    state.currentTheme = theme;
    // 'auto' means follow the system. The stylesheet expresses that as
    // `:root:not([data-theme])`, so the attribute has to be absent — setting it
    // to 'auto' matches no theme rule and leaves the light defaults on :root.
    if (theme === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  },

  async importDB(
    data: string,
    toast?: { success: ToastFn; error: ToastFn }
  ): Promise<void> {
    try {
      await IndexedDB.importDB(JSON.parse(data));
      state.presets = await IndexedDB.getPresets();
      toast?.success(t('state.database.import.completed'));
    } catch (error) {
      console.error('Error during database import:', error);
      toast?.error(t('state.database.import.failed'));
      throw error;
    }
  },

  async exportDB(
    convId?: string,
    toast?: { success: ToastFn; error: ToastFn }
  ): Promise<ExportJsonStructure> {
    try {
      const data = await IndexedDB.exportDB(convId);
      toast?.success(t('state.database.export.completed'));
      return data;
    } catch (error) {
      console.error('Error during database export:', error);
      toast?.error(t('state.database.export.failed'));
      throw error;
    }
  },
};
