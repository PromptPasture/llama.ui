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

/** An excerpt split into the part that matched and the text around it. */
export interface SplitExcerpt {
  before: string;
  match: string;
  after: string;
}

/**
 * Splits an excerpt around the term that was searched for, so the match can be
 * marked in the middle of it.
 *
 * The match is taken from the text rather than the term, so it keeps the
 * capitalisation it was written with.
 *
 * @param text - The excerpt
 * @param term - The term that was searched for
 * @returns The three parts; `match` is empty when the term is not present
 */
export function splitAround(text: string, term: string): SplitExcerpt {
  const needle = term.trim().toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at === -1) return { before: text, match: '', after: '' };

  return {
    before: text.slice(0, at),
    match: text.slice(at, at + needle.length),
    after: text.slice(at + needle.length),
  };
}
