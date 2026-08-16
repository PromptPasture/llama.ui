export const THEMES: readonly string[] = Object.freeze(['light', 'dark']);

/**
 * What the browser paints its own chrome with — the address bar on Android and
 * the status bar of an installed app. These mirror `--color-bg` for each theme
 * in app.css; the two have to be changed together.
 *
 * The same values are inlined in the bootstrap script in app.html, which runs
 * before any module is loaded.
 */
export const THEME_COLORS: Readonly<Record<string, string>> = Object.freeze({
  light: '#ffffff',
  dark: '#1d232a',
});

// Syntax highlight themes are out of scope for this migration.
export const SYNTAX_THEMES: readonly string[] = Object.freeze([]);
