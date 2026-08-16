/**
 * The most recent id handed out, so that two allocations in the same
 * millisecond cannot repeat.
 */
let lastIssuedId = 0;

/**
 * Issues an id for a conversation or message.
 *
 * Ids are timestamps and both stores key on them uniquely, so anything minted
 * twice within the same millisecond collided and failed the write. A new
 * conversation and its first message are created back to back, which is
 * exactly the case that used to land in the same millisecond.
 *
 * Keeping a high-water mark preserves the ordering the timestamps give while
 * making a repeat impossible. Every caller has to use this: a value taken
 * straight from Date.now() elsewhere can still land on one already issued.
 *
 * @returns A millisecond timestamp, never one already issued this session.
 */
export function nextId(): number {
  const now = Date.now();
  lastIssuedId = now > lastIssuedId ? now : lastIssuedId + 1;
  return lastIssuedId;
}
