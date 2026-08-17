import { CONFIG_DEFAULT } from '../config';
import { Configuration } from '../types';

// --- Configuration Management (localStorage) ---
export default class LocalStorage {
  /**
   * Retrieves the current application configuration.
   * Merges saved values with defaults to handle missing keys.
   * @returns The current Configuration object.
   */
  static getConfig(): Configuration {
    const savedConfigString = localStorage.getItem('config');
    let savedVal: Partial<Configuration> = {};
    if (savedConfigString) {
      try {
        savedVal = JSON.parse(savedConfigString);
      } catch (e) {
        console.error('Failed to parse saved config from localStorage:', e);
        console.error('Failed to parse saved config.');
      }
    }
    return LocalStorage.mergeConfig(savedVal);
  }

  /**
   * Layers stored values over the defaults, keeping only those whose type
   * matches. CONFIG_DEFAULT is the schema: every key holds a string, boolean
   * or number, so a stored value of another type cannot have come from a
   * healthy save.
   *
   * Presets bypass the settings screen's validation and can arrive from an
   * imported database, so a single wrong-typed value would otherwise persist
   * into localStorage. One bad `custom` is enough to make every send throw in
   * configToCustomOptions before a request is even attempted.
   *
   * @param saved Parsed contents of the stored configuration.
   * @returns A configuration whose every value has the expected type.
   */
  static mergeConfig(saved: Partial<Configuration>): Configuration {
    const merged: Configuration = { ...CONFIG_DEFAULT };
    if (!saved || typeof saved !== 'object') return merged;

    const defaults = CONFIG_DEFAULT as unknown as Record<string, unknown>;
    const target = merged as unknown as Record<string, unknown>;

    for (const [key, value] of Object.entries(saved)) {
      const fallback = defaults[key];
      if (fallback === undefined) continue; // key this version does not know
      if (typeof value !== typeof fallback) {
        console.warn(
          `Ignoring stored config '${key}': expected ${typeof fallback}, got ${value === null ? 'null' : typeof value}.`
        );
        continue;
      }
      target[key] = value;
    }
    return merged;
  }

  /**
   * Saves the application configuration to localStorage.
   * @param config The Configuration object to save.
   */
  static setConfig(config: Configuration) {
    localStorage.setItem('config', JSON.stringify(config));
  }

  /**
   * Retrieves the currently selected UI theme.
   * @returns The theme string ('auto', 'light', 'dark', etc.) or 'auto' if not set.
   */
  static getTheme(): string {
    return localStorage.getItem('theme') || 'auto';
  }

  /**
   * Saves the selected UI theme to localStorage.
   * If 'auto' is selected, the theme item is removed.
   * @param theme The theme string to save.
   */
  static setTheme(theme: string) {
    if (theme === 'auto') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', theme);
    }
  }

  /**
   * Everything this app keeps outside the database.
   *
   * Named rather than cleared wholesale: the origin may hold something this
   * app did not put there, and a list says what a reset covers.
   */
  static readonly KEYS = [
    'config',
    'theme',
    'language',
    'drafts',
    'migratedToIDB',
  ] as const;

  /**
   * Forgets all of it — the configuration and the api key in it, the chosen
   * theme and language, and any half-written message.
   *
   * For handing the machine on. Deleting the conversations leaves the
   * credentials behind, which is the part that matters most.
   */
  static forgetEverything(): void {
    for (const key of LocalStorage.KEYS) localStorage.removeItem(key);
  }

  /**
   * Retrieves the language chosen in the settings.
   * @returns The stored language tag, or null to follow the browser.
   */
  static getLanguage(): string | null {
    return localStorage.getItem('language');
  }

  /**
   * Saves the chosen language.
   * @param language The language tag to store.
   */
  static setLanguage(language: string) {
    localStorage.setItem('language', language);
  }
}
