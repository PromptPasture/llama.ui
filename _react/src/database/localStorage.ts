import toast from 'react-hot-toast';
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
        toast.error('Failed to parse saved config.');
      }
    }
    // Provide default values for any missing keys
    return {
      ...CONFIG_DEFAULT,
      ...savedVal,
    };
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
   * Retrieves the currently selected syntax theme.
   * @returns The theme string ('auto', etc.) or 'auto' if not set.
   */
  static getSyntaxTheme(): string {
    return localStorage.getItem('syntaxTheme') || 'auto';
  }

  /**
   * Saves the selected syntax theme to localStorage.
   * If 'auto' is selected, the theme item is removed.
   * @param theme The theme string to save.
   */
  static setSyntaxTheme(theme: string) {
    if (theme === 'auto') {
      localStorage.removeItem('syntaxTheme');
    } else {
      localStorage.setItem('syntaxTheme', theme);
    }
  }
}
