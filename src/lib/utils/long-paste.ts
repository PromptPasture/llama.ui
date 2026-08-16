/**
 * Decides whether pasted text is too long to sit in the message box.
 *
 * Pasting a log or a source file fills the box with thousands of lines, which
 * pushes the conversation off the screen and leaves the writer scrolling
 * inside a textarea to find where their own question went. Past a length it is
 * better kept as an attachment: the model still receives it, and the box stays
 * a box.
 *
 * @param text - What was pasted
 * @param limit - The length past which to attach it; 0 turns this off
 * @returns Whether it should be attached rather than inserted
 */
export function isLongPaste(text: string, limit: number): boolean {
  return limit > 0 && text.length > limit;
}
