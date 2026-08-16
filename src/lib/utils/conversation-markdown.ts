import type { Message } from '$lib/types';

/** What to call each side in the written-out conversation. */
export interface RoleLabels {
  user: string;
  assistant: string;
}

/**
 * Writes a conversation out as markdown.
 *
 * The stored form is JSON, which is right for reading back in and useless for
 * showing anyone: sharing a conversation, or keeping it alongside notes, wants
 * the words. Each turn becomes a heading and its text, which reads as plain
 * text and renders as a conversation anywhere markdown is understood.
 *
 * Reasoning is left out. It is folded away on screen, and what gets shared is
 * the exchange rather than the working.
 *
 * @param messages - The turns to write, in order
 * @param labels - What to call each side
 * @returns The conversation as markdown, without a trailing newline
 */
export function toMarkdown(
  messages: readonly Message[],
  labels: RoleLabels
): string {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const who = m.role === 'user' ? labels.user : labels.assistant;
      // Content is null for a reply that was never written; the heading alone
      // would say a turn happened when none did.
      const said = typeof m.content === 'string' ? m.content.trim() : '';
      return said ? `## ${who}\n\n${said}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}
