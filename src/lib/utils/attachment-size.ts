import type { MessageExtra } from '$lib/types';

/** What a base64 string costs to decode: four characters carry three bytes. */
const BASE64_RATIO = 3 / 4;

/**
 * How much an attachment amounts to.
 *
 * A file name says nothing about what is being sent. A pasted log and a
 * three-line note look alike in the box, and one of them can be more than the
 * model will take — the difference is worth seeing before pressing send
 * rather than after the reply is refused.
 *
 * @param extra - The attachment to measure
 * @returns Its size in bytes
 */
export function attachmentSize(extra: MessageExtra): number {
  switch (extra.type) {
    case 'imageFile':
      return base64Bytes(extra.base64Url);
    case 'audioFile':
      return base64Bytes(extra.base64Data);
    default:
      // Measured as bytes rather than characters: the text is sent as UTF-8,
      // where anything outside ASCII costs more than one byte apiece.
      return new TextEncoder().encode(extra.content).length;
  }
}

/**
 * The size of what a base64 string encodes.
 *
 * @param encoded - Base64, with or without a `data:` prefix
 * @returns The number of bytes it stands for
 */
function base64Bytes(encoded: string): number {
  const payload = encoded.slice(encoded.indexOf(',') + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.round(payload.length * BASE64_RATIO) - padding);
}
