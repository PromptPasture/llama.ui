import { toMarkdown, type RoleLabels } from './conversation-markdown';
import type { Conversation, Message } from '$lib/types';

/** One conversation, and the turns of it that are on screen. */
export interface ConversationTranscript {
  conv: Conversation;
  messages: readonly Message[];
}

/**
 * Writes the whole history out as one readable document.
 *
 * The JSON export is for reading back into the app; this is for keeping,
 * for searching in something else, or for leaving with. Each conversation
 * becomes a heading with its turns beneath, which is what `toMarkdown`
 * already produces for one of them.
 *
 * @param transcripts - The conversations to write, in the order they should
 *   appear
 * @param labels - What to call each side
 * @returns The history as markdown, without a trailing newline
 */
export function historyToMarkdown(
  transcripts: readonly ConversationTranscript[],
  labels: RoleLabels
): string {
  return transcripts
    .map(({ conv, messages }) => {
      const body = toMarkdown(messages, labels);
      // A heading with nothing under it says a conversation happened that
      // has nothing in it — which is true of one deleted down to its root.
      return body ? `# ${conv.name}\n\n${body}` : '';
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
}
