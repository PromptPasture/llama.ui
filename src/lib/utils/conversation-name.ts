import type { MessageExtra } from '$lib/types';

/** About as much as the sidebar can show, and as much as a tooltip should. */
const MAX_LENGTH = 60;

/**
 * Names a conversation after the message that started it.
 *
 * The opening message was taken whole, up to 256 characters, newlines and all.
 * The sidebar clips that to one line, but the name is also the tooltip, the
 * label a screen reader reads for the item, and the name of the file it
 * downloads as — so identifying a conversation meant listening to, or hovering
 * over, a paragraph.
 *
 * Cut on a word so the name ends somewhere a reader would stop, with an
 * ellipsis to say there was more.
 *
 * @param content - The first message of the conversation
 * @param attachments - What was attached to it, if anything
 * @returns A name of readable length
 */
export function toConversationName(
  content: string,
  attachments: readonly MessageExtra[] = []
): string {
  // A message can be nothing but an attachment — a pasted log, or a screenshot
  // asked about on its own. Named after the text there would be nothing to
  // name it with, and the conversation would sit in the sidebar as a blank
  // line that reads aloud as nothing.
  return shorten(content) || shorten(attachments[0]?.name ?? '');
}

/**
 * Cuts a piece of text down to a length worth reading.
 *
 * @param text - What to shorten
 * @returns The text, or as much of it as reads as a name
 */
function shorten(text: string): string {
  // Only the first line: a pasted block's later lines say nothing about it
  // that its opening does not.
  const firstLine = text.split('\n')[0].replace(/\s+/g, ' ').trim();
  const flattened = firstLine || text.replace(/\s+/g, ' ').trim();

  if (flattened.length <= MAX_LENGTH) return flattened;

  const cut = flattened.slice(0, MAX_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  // A language written without spaces has none to cut on, so fall back to the
  // length itself rather than returning the whole thing.
  const stem = lastSpace > MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${stem.trimEnd()}…`;
}
