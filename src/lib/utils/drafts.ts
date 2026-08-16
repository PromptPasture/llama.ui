const STORAGE_KEY = 'drafts';

/** The box on the welcome screen, which has no conversation behind it yet. */
const NEW_CHAT = '';

/**
 * Messages that have been typed but not sent, kept per conversation.
 *
 * Every conversation is the same route, so opening another one hands the page
 * new parameters rather than mounting it again — and the message box, being
 * part of that page, kept whatever was in it. A half-written question followed
 * the reader into the next conversation, where the next Enter would send it to
 * the wrong one. Leaving the route instead threw the text away.
 *
 * Stored rather than merely remembered, so a reload does not lose it either.
 */
function read(): Record<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, text]) => typeof text === 'string'
      )
    ) as Record<string, string>;
  } catch {
    // Unreadable or unparseable storage means no drafts, not a broken box.
    return {};
  }
}

/**
 * Reads back what was left in the box for a conversation.
 *
 * @param convId - The conversation, or undefined for the welcome screen
 * @returns The unsent text, or an empty string
 */
export function readDraft(convId: string | undefined): string {
  return read()[convId ?? NEW_CHAT] ?? '';
}

/**
 * Remembers what is in the box for a conversation.
 *
 * Failures are swallowed: this runs on every keystroke, and storage that is
 * full or forbidden is not worth interrupting the writing to say so.
 *
 * @param convId - The conversation, or undefined for the welcome screen
 * @param text - What the box holds; empty forgets the draft
 */
export function writeDraft(convId: string | undefined, text: string): void {
  const drafts = read();
  const key = convId ?? NEW_CHAT;
  if (text) {
    drafts[key] = text;
  } else if (!(key in drafts)) {
    // Nothing to forget, so nothing to write.
    return;
  } else {
    delete drafts[key];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Keeping the draft in the box matters more than storing it.
  }
}
