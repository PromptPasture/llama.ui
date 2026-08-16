import { Database, TimingReport } from '../types';

// --- Migration Logic (from localStorage to IndexedDB) ---

// these are old types, LS prefix stands for LocalStorage
interface LSConversation {
  id: string; // format: `conv-{timestamp}`
  lastModified: number; // timestamp from Date.now()
  messages: LSMessage[];
}
interface LSMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timings?: TimingReport;
}

/**
 * Checks that a parsed localStorage entry really is a legacy conversation.
 *
 * Anything under a `conv-` key is otherwise trusted on sight, and one entry of
 * the wrong shape throws inside the migration transaction. That rolls the whole
 * transaction back and leaves the completion flag unset, so every later load
 * retries and fails the same way — every legacy conversation stays invisible
 * for good.
 *
 * @param value The parsed contents of one localStorage entry.
 * @returns Whether it can safely be migrated.
 */
function isLegacyConversation(value: unknown): value is LSConversation {
  if (!value || typeof value !== 'object') return false;
  const conv = value as Partial<LSConversation>;
  if (typeof conv.id !== 'string') return false;
  if (typeof conv.lastModified !== 'number') return false;
  if (!Array.isArray(conv.messages)) return false;
  return conv.messages.every(
    (msg) =>
      msg &&
      typeof msg === 'object' &&
      typeof msg.id === 'number' &&
      typeof msg.content === 'string'
  );
}

/**
 * Migrates conversation data from localStorage to IndexedDB.
 * Runs only once, indicated by the 'migratedToIDB' flag in localStorage.
 * @returns A promise that resolves when migration is complete or skipped.
 */
export async function migrationLStoIDB(db: Database) {
  const MIGRATION_FLAG_KEY = 'migratedToIDB';
  if (localStorage.getItem(MIGRATION_FLAG_KEY)) {
    return; // Already migrated
  }

  console.log('Starting migration from localStorage to IndexedDB...');
  const res: LSConversation[] = [];

  // Iterate through localStorage keys to find conversation data
  for (const key in localStorage) {
    if (key.startsWith('conv-')) {
      try {
        const item = localStorage.getItem(key);
        if (item) {
          const parsedItem: unknown = JSON.parse(item);
          if (isLegacyConversation(parsedItem)) {
            res.push(parsedItem);
          } else {
            console.warn(
              `Skipping localStorage item '${key}': not a legacy conversation.`
            );
          }
        }
      } catch (e) {
        console.warn(`Failed to parse localStorage item with key ${key}:`, e);
      }
    }
  }

  if (res.length === 0) {
    console.log('No legacy conversations found for migration.');
    return;
  }

  // Perform migration within a single transaction
  await db
    .transaction('rw', db.conversations, db.messages, async () => {
      let migratedCount = 0;
      for (const conv of res) {
        const { id: convId, lastModified, messages } = conv;

        // Validate legacy conversation structure
        if (messages.length < 2) {
          console.log(
            `Skipping conversation ${convId} with fewer than 2 messages.`
          );
          continue;
        }
        const firstMsg = messages[0];
        const lastMsg = messages[messages.length - 1];
        if (!firstMsg || !lastMsg) {
          console.log(
            `Skipping conversation ${convId} with ${messages.length} messages.`
          );
          continue;
        }

        const name = firstMsg.content || '(no messages)';

        // 1. Add the conversation record
        await db.conversations.add({
          id: convId,
          lastModified,
          currNode: lastMsg.id,
          name,
        });

        // 2. Create and add the root node
        const rootId = firstMsg.id - 2;
        await db.messages.add({
          id: rootId,
          convId: convId,
          type: 'root',
          timestamp: rootId,
          role: 'system',
          content: '',
          parent: -1,
          children: [firstMsg.id],
        });

        // 3. Add the legacy messages, linking them appropriately
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          await db.messages.add({
            ...msg,
            type: 'text',
            convId: convId,
            timestamp: msg.id,
            parent: i === 0 ? rootId : messages[i - 1].id,
            children: i === messages.length - 1 ? [] : [messages[i + 1].id],
          });
        }

        migratedCount++;
        console.log(
          `Migrated conversation ${convId} with ${messages.length} messages.`
        );
      }
      console.log(
        `Migration complete. Migrated ${migratedCount} conversations from localStorage to IndexedDB.`
      );
    })
    .then(() => {
      // Mark migration as complete only after the transaction finishes successfully
      localStorage.setItem(MIGRATION_FLAG_KEY, '1');
    })
    .catch((error) => {
      console.error('Error during migration transaction:', error);
      console.error('An error occurred during data migration.');
    });
}
