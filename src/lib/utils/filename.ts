/**
 * How much of a name to keep. A conversation is named after its opening
 * message trimmed to 256 characters, which is far longer than most file
 * systems accept in a single component.
 */
const MAX_LENGTH = 60;

/** Characters no common file system will take. */
const UNUSABLE = /[/\\:*?"<>|]/g;

/**
 * Turns a name into something that can be saved as a file.
 *
 * Downloads were named after the conversation's id — `conv-1786899330012` —
 * so three of them in a folder could not be told apart without opening each
 * one. The name is what the reader knows the conversation by.
 *
 * @param name - What the thing is called
 * @param fallback - Used when the name has nothing usable left in it
 * @returns A single file name component, without an extension
 */
export function toFileName(name: string, fallback: string): string {
  const cleaned = name
    .replace(UNUSABLE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // A leading dot hides the file on Unix, and a trailing dot or space is
    // dropped silently by Windows.
    .replace(/^\.+/, '')
    .slice(0, MAX_LENGTH)
    .replace(/[. ]+$/, '')
    .trim();

  return cleaned || fallback;
}
