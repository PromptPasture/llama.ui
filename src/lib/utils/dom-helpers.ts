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
    return;
  }

  // Use the 'out of viewport hidden text area' trick
  const textArea = document.createElement('textarea');
  textArea.value = textToCopy;
  // Move textarea out of the viewport so it's not visible
  textArea.style.position = 'absolute';
  textArea.style.left = '-999999px';
  // Off screen is not out of reach: an element left behind still takes focus
  // when tabbed to, and one accumulates per copy.
  textArea.setAttribute('aria-hidden', 'true');
  textArea.tabIndex = -1;
  document.body.prepend(textArea);
  try {
    textArea.select();
    document.execCommand('copy');
  } finally {
    textArea.remove();
  }
};
