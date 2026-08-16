import type { MessageExtra } from '$lib/types';

/** An attachment waiting to be sent, with an id of its own because two of
 * them can share a name — the same file picked twice. */
export interface PendingAttachment {
  id: number;
  extra: MessageExtra;
}

/** The box on the welcome screen, which has no conversation behind it yet. */
const NEW_CHAT = '';

/**
 * Attachments waiting to be sent, kept per conversation.
 *
 * Held in memory rather than stored alongside the draft text: an attachment is
 * as large as the file it came from, and a few of them would fill the
 * browser's storage quota and cost the reader every draft they have. So this
 * survives moving around the app — going to the settings to change the model
 * and coming back is the usual way to lose them — but not a reload.
 */
const byConversation = new Map<string, PendingAttachment[]>();

/**
 * Reads back what was attached for a conversation.
 *
 * @param convId - The conversation, or undefined for the welcome screen
 * @returns The attachments waiting there, oldest first
 */
export function readAttachments(
  convId: string | undefined
): PendingAttachment[] {
  return byConversation.get(convId ?? NEW_CHAT) ?? [];
}

/**
 * Remembers what is attached for a conversation.
 *
 * @param convId - The conversation, or undefined for the welcome screen
 * @param items - What is attached; an empty list forgets the conversation
 */
export function writeAttachments(
  convId: string | undefined,
  items: PendingAttachment[]
): void {
  const key = convId ?? NEW_CHAT;
  if (items.length === 0) byConversation.delete(key);
  else byConversation.set(key, items);
}

/** Forgets everything. Only the tests need this; a reload does it for real. */
export function forgetAllAttachments(): void {
  byConversation.clear();
}
