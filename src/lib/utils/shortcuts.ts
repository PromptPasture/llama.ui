/** Platforms whose people press Command where everyone else presses Control. */
const APPLE = /mac|iphone|ipad|ipod/i;

/**
 * Whether to name the modifier Command rather than Control.
 *
 * The shortcuts themselves accept either, so this is only about what to call
 * it: telling a Mac user to press Ctrl+K names a key they will not press.
 *
 * @returns Whether this is an Apple platform
 */
export function usesCommandKey(): boolean {
  if (typeof navigator === 'undefined') return false;
  const modern = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData;
  // navigator.platform is deprecated and still the only answer in browsers
  // that have no userAgentData.
  return APPLE.test(modern?.platform ?? navigator.platform ?? '');
}

/**
 * Writes a shortcut the way the reader's keyboard has it.
 *
 * @param key - The key pressed with the modifier, e.g. 'K'
 * @returns Something to show alongside the name of a button
 */
export function shortcutHint(key: string): string {
  return usesCommandKey() ? `⌘${key}` : `Ctrl+${key}`;
}

/**
 * The same shortcut in the form ARIA defines.
 *
 * Both modifiers are listed because the app answers to both, and because this
 * is read out rather than looked at: it should say what will work.
 *
 * @param key - The key pressed with the modifier, e.g. 'K'
 * @returns A value for aria-keyshortcuts
 */
export function keyShortcuts(key: string): string {
  return `Control+${key} Meta+${key}`;
}

/**
 * A button's tooltip, with the shortcut that does the same thing.
 *
 * @param label - What the button is called, translated
 * @param key - The key pressed with the modifier
 * @returns The label followed by the shortcut
 */
export function titleWithShortcut(label: string, key: string): string {
  return `${label} (${shortcutHint(key)})`;
}
