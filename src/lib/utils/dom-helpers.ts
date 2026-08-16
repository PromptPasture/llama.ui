/** The part of a scrollable element this module needs to look at. */
export interface ScrollPosition {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/**
 * How close to the end still counts as being at it. A reader who has stopped a
 * few pixels short — a trackpad that under-shoots, a rounding difference at
 * some zoom levels — means to be at the bottom.
 */
const AT_BOTTOM_TOLERANCE_PX = 48;

/**
 * Whether a scrollable element is showing its end.
 *
 * Used to decide whether a growing conversation should keep following the
 * reply. Content shorter than the viewport is always at its end.
 *
 * @param el - The scrollable element to measure
 * @param tolerance - How many pixels short of the end still count as the end
 * @returns Whether the element is scrolled to its end
 */
export const isAtBottom = (
  el: ScrollPosition,
  tolerance: number = AT_BOTTOM_TOLERANCE_PX
): boolean => el.scrollHeight - el.scrollTop - el.clientHeight <= tolerance;

/**
 * Copies text to the clipboard using the modern Clipboard API when available,
 * or falls back to the legacy `execCommand` method for older browsers or insecure contexts.
 *
 * @param textToCopy - The text to copy to the clipboard
 */
/**
 * Puts text on the clipboard.
 *
 * Says whether it worked. The clipboard refuses for ordinary reasons — the
 * permission withheld, the document not focused — and the refusal arrives as
 * a rejected promise. Unawaited, it went nowhere: the button reported success
 * it had never checked, and the reader pasted whatever was there before.
 *
 * @param textToCopy - What to put on the clipboard
 * @returns Whether the text is now on it
 */
export const copyStr = async (textToCopy: string): Promise<boolean> => {
  // Navigator clipboard api needs a secure context (https)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(textToCopy);
      return true;
    } catch {
      return false;
    }
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
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textArea.remove();
  }
};
