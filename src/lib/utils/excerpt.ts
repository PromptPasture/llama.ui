/** Characters of context to show on either side of a match. */
const CONTEXT_CHARS = 40;

/**
 * A short piece of text around the first occurrence of a term.
 *
 * Search results name the conversation, which for a match found deep inside
 * one says nothing about why it matched. This is the sentence fragment that
 * did match, with an ellipsis wherever text has been cut away.
 *
 * Whitespace is collapsed: message content is markdown, so it arrives with
 * line breaks and indentation that a single line of result cannot show.
 *
 * @param text - The text the term was found in
 * @param term - The term that was searched for
 * @param context - Characters to keep on either side of the match
 * @returns The fragment, or an empty string if the term is not there
 */
export function excerptAround(
  text: string,
  term: string,
  context: number = CONTEXT_CHARS
): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const needle = term.trim().toLowerCase();
  if (!needle) return '';

  const at = flat.toLowerCase().indexOf(needle);
  if (at === -1) return '';

  const from = Math.max(0, at - context);
  const to = Math.min(flat.length, at + needle.length + context);
  return (
    (from > 0 ? '…' : '') + flat.slice(from, to) + (to < flat.length ? '…' : '')
  );
}
