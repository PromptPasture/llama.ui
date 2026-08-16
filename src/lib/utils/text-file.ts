/**
 * The largest file worth reading into a prompt.
 *
 * Not a protocol limit: the whole file is decoded into a string and held in
 * memory, and anything approaching this is already far past what a context
 * window will take. The point is to refuse in a sentence rather than lock the
 * page up while reading something that could never have been sent.
 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** How much of a file to look at before deciding what it is. */
const SNIFF_BYTES = 4096;

/**
 * Guesses whether a file is binary rather than text.
 *
 * A null byte is the long-standing test, and the one that matters here: it is
 * what separates an executable, an image or an archive from source code, logs
 * and prose. Decoding one as text produces pages of replacement characters,
 * which are useless to a model and would be sent anyway.
 *
 * UTF-16 text is null-heavy and will be called binary. That is the honest
 * answer for a prompt: decoded as UTF-8 it is unreadable.
 *
 * @param bytes - The start of the file, or all of it
 * @returns Whether it should be refused as binary
 */
export function looksBinary(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, SNIFF_BYTES);
  for (let i = 0; i < end; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

/**
 * Says a size the way a person would.
 *
 * @param bytes - A number of bytes
 * @returns The size in the largest unit that leaves it above one
 */
export function describeSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  // Whole numbers for bytes, one decimal for anything scaled, and no trailing
  // '.0' on the round ones.
  const shown = unit === 0 ? String(size) : String(Math.round(size * 10) / 10);
  return `${shown}${units[unit]}`;
}
