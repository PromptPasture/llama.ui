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
    document.documentElement.setAttribute('data-theme', theme);
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
