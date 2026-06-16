/**
 * Escapes HTML attribute values by replacing special characters with their HTML entities.
 * Specifically replaces `>` with `&gt;` and `"` with `&quot;`.
 *
 * @param str - The string to escape
 * @returns The escaped string safe for use in HTML attributes
 */
export const escapeAttr = (str: string) =>
  str.replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Copies text to the clipboard using the modern Clipboard API when available,
 * or falls back to the legacy `execCommand` method for older browsers or insecure contexts.
 *
 * @param textToCopy - The text to copy to the clipboard
 */
export const copyStr = (textToCopy: string) => {
  // Navigator clipboard api needs a secure context (https)
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(textToCopy);
  } else {
    // Use the 'out of viewport hidden text area' trick
    const textArea = document.createElement('textarea');
    textArea.value = textToCopy;
    // Move textarea out of the viewport so it's not visible
    textArea.style.position = 'absolute';
    textArea.style.left = '-999999px';
    document.body.prepend(textArea);
    textArea.select();
    document.execCommand('copy');
  }
};
