// Conversations are stored in IndexedDB via Dexie.
// Format (conceptual): { [convId]: { id: string, lastModified: number, messages: [...] } }

import Dexie from 'dexie';
import { isDev } from '../config';
import {
  Configuration,
  ConfigurationPreset,
  Conversation,
  ConversationMatch,
  Database,
  ExportJsonStructure,
  Message,
} from '../types';
import { excerptAround } from '../utils/excerpt';
import { nextId } from './id';
import { migrationLStoIDB } from './migration';

// --- Event Handling ---

/**
 * Event target for internal communication about conversation changes.
 */
const event = new EventTarget();

/**
 * Type for callback functions triggered on conversation change.
 */
type CallbackConversationChanged = (convId: string) => void;

/**
 * Stores registered event listeners to allow for removal.
 */
const onConversationChangedHandlers: [
  CallbackConversationChanged,
  EventListener,
][] = [];

/**
 * Carries changes to the other tabs. They share the database but not the event
 * target above, so without this a conversation started, renamed or deleted
 * here stayed invisible there until the page was reloaded — and a deleted one
 * stayed in their sidebar, leading to a conversation that no longer exists.
 *
 * Null where the browser has no BroadcastChannel; everything still works
 * within the tab that made the change.
 */
const tabs =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('llama-ui:conversations');

const notifyThisTab = (convId: string) => {
  event.dispatchEvent(
    new CustomEvent<string>('conversationChange', { detail: convId })
  );
};

// Announcing what another tab told us would bounce it back to them forever.
tabs?.addEventListener('message', (message: MessageEvent<string>) => {
  notifyThisTab(message.data);
});

/**
 * Dispatches a custom event indicating a conversation has changed.
 * @param convId The ID of the conversation that changed.
 */
const dispatchConversationChange = (convId: string) => {
  notifyThisTab(convId);
  tabs?.postMessage(convId);
};

// --- Dexie Database Setup ---

/**
 * Dexie database instance for the application.
 */
const db = new Dexie('LlamacppWebui') as Database;

// Define database schema
// https://dexie.org/docs/Version/Version.stores()
db.version(1).stores({
  // Index conversations by 'id' (unique) and 'lastModified'
  conversations: '&id, lastModified',
  // Index messages by 'id' (unique), 'convId', composite key '[convId+id]', and 'timestamp'
  messages: '&id, convId, [convId+id], timestamp',
  // Index userConfigurations by 'id' (unique) and 'name'
  userConfigurations: '&id, name',
});

// --- Main Storage Utility Functions ---

/**
 * Utility functions for interacting with application data (conversations, messages, config).
 */
export default class IndexedDB {
  /**
   * Retrieves all conversations, sorted by last modified date (descending).
   * @returns A promise resolving to an array of Conversation objects.
   */
  static async getAllConversations(): Promise<Conversation[]> {
    await migrationLStoIDB(db).catch(console.error); // noop if already migrated
    return (await db.conversations.toArray()).sort(
      (a, b) => b.lastModified - a.lastModified
    );
  }

  /**
   * Retrieves a single conversation by its ID.
   * @param convId The ID of the conversation to retrieve.
   * @returns A promise resolving to the Conversation object or null if not found.
   */
  static async getOneConversation(
    convId: string
  ): Promise<Conversation | null> {
    return (await db.conversations.get(convId)) ?? null;
  }

  /**
   * Retrieves all messages belonging to a specific conversation.
   * @param convId The ID of the conversation.
   * @returns A promise resolving to an array of Message objects.
   */
  static async getMessages(convId: string): Promise<Message[]> {
    return await db.messages.where('convId').equals(convId).toArray();
  }

  /**
   * Filters messages to represent the path from a given leaf node to the root.
   * @param msgs The array of messages to filter (typically from getMessages).
   * @param leafNodeId The ID of the leaf message node.
   * @param includeRoot Whether to include the root node in the result.
   * @returns A new array of messages representing the path from leaf to root (sorted by timestamp).
   *          If leafNodeId is not found, returns the path ending at the message with the latest timestamp.
   */
  static filterByLeafNodeId(
    msgs: Readonly<Message[]>,
    leafNodeId: Message['id'],
    includeRoot: boolean
  ): Readonly<Message[]> {
    const res: Message[] = [];
    const nodeMap = new Map<Message['id'], Message>();
    for (const msg of msgs) {
      nodeMap.set(msg.id, msg);
    }

    let startNode: Message | undefined = nodeMap.get(leafNodeId);
    if (!startNode) {
      // If leaf node not found, find the message with the latest timestamp
      let latestTime = -1;
      for (const msg of msgs) {
        if (msg.timestamp > latestTime) {
          startNode = msg;
          latestTime = msg.timestamp;
        }
      }
    }

    // Traverse the path from the start node (found leaf or latest) up to the root
    let currNode: Message | undefined = startNode;
    while (currNode) {
      // Add node to result if it's not the root, or if it is the root and we want to include it
      if (
        currNode.type !== 'root' ||
        (currNode.type === 'root' && includeRoot)
      ) {
        res.push(currNode);
      }
      // Move to the parent node
      currNode = nodeMap.get(currNode.parent ?? -1);
    }

    // Sort the result by timestamp to ensure chronological order
    res.sort((a, b) => a.timestamp - b.timestamp);
    return res;
  }

  /**
   * Creates a new conversation with an initial root message.
   * @param name The name/title for the new conversation.
   * @returns A promise resolving to the newly created Conversation object.
   */
  static async createConversation(name: string): Promise<Conversation> {
    const now = Date.now();
    const msgId = nextId();

    const conv: Conversation = {
      id: `conv-${msgId}`,
      lastModified: now,
      currNode: msgId,
      name,
    };

    await db.transaction('rw', db.conversations, db.messages, async () => {
      await db.conversations.add(conv);
      // Create the initial root node
      await db.messages.add({
        id: msgId,
        convId: conv.id,
        type: 'root',
        timestamp: now,
        role: 'system',
        content: '',
        parent: -1,
        children: [],
      });
    });

    dispatchConversationChange(conv.id);
    return conv;
  }

  /**
   * Creates a new conversation by branching from an existing message.
   * @param convId The ID of the conversation to branch.
   * @param msgId The ID of the message to branch from.
   * @param name What to call the branch. Passed in rather than built here:
   *   it is read by whoever opens the conversation, so it belongs in their
   *   language, and this layer knows nothing about languages.
   * @returns A promise resolving to the newly created Conversation object.
   */
  static async branchConversation(
    convId: Conversation['id'],
    msgId: Message['id'],
    name: string
  ): Promise<Conversation> {
    // Get the source conversation
    const conv = await this.getOneConversation(convId);
    if (!conv) {
      throw new Error(`Branch conversation is not found`);
    }

    // Get the path from root to the fork message
    const convMsgs = await this.getMessages(convId);
    if (!convMsgs.some((msg) => msg.id === msgId)) {
      throw new Error(`Branch message is not found in conversation`);
    }
    const currNodes = this.filterByLeafNodeId(convMsgs, msgId, true);

    // Create mapping from old message IDs to new message IDs
    const msgIdMap = new Map<Message['id'], Message['id']>();
    const now = Date.now();
    for (const msg of currNodes) {
      msgIdMap.set(msg.id, nextId());
    }

    // Create new conversation with fork source information
    const branchConvId = `conv-${nextId()}`;
    const branchConv: Conversation = {
      id: branchConvId,
      lastModified: now,
      currNode: msgIdMap.get(msgId)!,
      name,
    };

    await db.transaction('rw', db.conversations, db.messages, async () => {
      // Add the new conversation
      await db.conversations.add(branchConv);

      // Copy all messages from the path to the new conversation with new IDs
      for (const msg of currNodes) {
        const newParentId = msg.parent === -1 ? -1 : msgIdMap.get(msg.parent)!;
        const newChildren = msg.children
          .map((childId) => msgIdMap.get(childId))
          .filter((id): id is number => id !== undefined);

        await db.messages.add({
          ...msg,
          id: msgIdMap.get(msg.id)!,
          convId: branchConvId,
          parent: newParentId,
          children: newChildren,
        });
      }
    });

    dispatchConversationChange(branchConvId);
    return branchConv;
  }

  /**
   * Updates the name of an existing conversation.
   * @param convId The ID of the conversation to update.
   * @param name The new name for the conversation.
   * @returns A promise that resolves when the update is complete.
   */
  static async updateConversationName(
    convId: string,
    name: string
  ): Promise<void> {
    await db.conversations.update(convId, {
      name,
    });
    dispatchConversationChange(convId);
  }

  /**
   * Appends a new message to a conversation as a child of a specified parent node.
   * @param msg The message content to append (must have content).
   * @param parentNodeId The ID of the parent message node.
   * @returns A promise that resolves when the message is appended.
   * @throws Error if the conversation or parent message does not exist.
   */
  static async appendMsg(
    msg: Exclude<Message, 'parent' | 'children'>,
    parentNodeId: Message['id']
  ): Promise<void> {
    // Early return if message content is null
    if (msg.content === null) return;

    const { convId } = msg;

    await db.transaction('rw', db.conversations, db.messages, async () => {
      // Fetch conversation and parent message within the transaction
      const conv = await IndexedDB.getOneConversation(convId);
      const parentMsg = await db.messages.get({ convId, id: parentNodeId });

      if (!conv) {
        throw new Error(`Conversation ${convId} does not exist`);
      }
      if (!parentMsg) {
        throw new Error(
          `Parent message ID ${parentNodeId} does not exist in conversation ${convId}`
        );
      }

      // Update conversation's lastModified and currNode
      await db.conversations.update(convId, {
        lastModified: Date.now(),
        currNode: msg.id,
      });

      // Update parent's children array
      await db.messages.update(parentNodeId, {
        children: [...parentMsg.children, msg.id],
      });

      // Add the new message
      await db.messages.add({
        ...msg,
        parent: parentNodeId,
        children: [],
      });
    });

    // Dispatch event after successful transaction
    dispatchConversationChange(convId);
  }

  /**
   * Removes a message and all its siblings.
   * @param msg The message to remove.
   * @returns A promise that resolves when the message is removed.
   */
  static async deleteMessage(
    msg: Pick<Message, 'id' | 'convId' | 'parent' | 'children'>
  ) {
    const { convId, id: msgId, parent: parentId } = msg;

    // Check if conversation exists
    const conv = await this.getOneConversation(msg.convId);
    if (!conv) {
      throw new Error(`Conversation is not found`);
    }

    // Check if message exists
    const convMsgs = await this.getMessages(msg.convId);
    if (!convMsgs.some((msg) => msg.id === msgId)) {
      throw new Error(`Remove message is not found in conversation`);
    }

    // Create cache for quick lookup
    const searchCache = new Map<number, Message>();
    convMsgs.forEach((m) => searchCache.set(m.id, m));

    // Get the list of messages to delete
    const toDelete = new Set<number>();
    const queue = [msg.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (toDelete.has(id)) continue;

      toDelete.add(id);
      const msg = searchCache.get(id);
      if (msg && msg.children.length > 0) {
        queue.push(...msg.children);
      }
    }

    // Get the list of messages to update children
    const isValidChild = (id: number) =>
      !toDelete.has(id) && searchCache.has(id);
    const toUpdateChildren: { key: number; changes: { children: number[] } }[] =
      [];
    convMsgs.forEach((m) => {
      if (toDelete.has(m.id)) return;
      if (m.children.some((id) => !isValidChild(id))) {
        toUpdateChildren.push({
          key: m.id,
          changes: {
            children: m.children.filter(isValidChild),
          },
        });
      }
    });

    await db.transaction('rw', db.conversations, db.messages, async () => {
      // Update orphaned children array
      if (toUpdateChildren.length > 0) {
        await db.messages.bulkUpdate(toUpdateChildren);
      }

      // Delete messages
      await db.messages.bulkDelete(Array.from(toDelete));

      // Update conversation currNode
      if (toDelete.has(conv.currNode)) {
        await db.conversations.update(msg.convId, {
          lastModified: Date.now(),
          currNode: parentId,
        });
      }
    });
    dispatchConversationChange(convId);
  }

  /**
   * Removes a conversation and all its associated messages.
   * @param convId The ID of the conversation to remove.
   * @returns A promise that resolves when the conversation is removed.
   */
  static async deleteConversation(convId: string): Promise<void> {
    await db.transaction('rw', db.conversations, db.messages, async () => {
      await db.conversations.delete(convId);
      await db.messages.where('convId').equals(convId).delete();
    });
    dispatchConversationChange(convId);
  }

  /**
   * Finds conversations matching a search term.
   *
   * Matches the name or anything said inside, because a name is only the
   * opening message trimmed to length — so searching by name alone finds a
   * conversation solely by how it happened to start, and never by what it
   * turned out to be about.
   *
   * @param term The text to look for. Blank returns everything.
   * @returns The matches, most recently changed first, each carrying the text
   *   around it when the match came from inside rather than from the name.
   */
  static async searchConversations(term: string): Promise<ConversationMatch[]> {
    const all = await IndexedDB.getAllConversations();
    const needle = term.trim().toLowerCase();
    if (!needle) return all.map((conv) => ({ conv }));

    const named = new Set(
      all.filter((c) => c.name.toLowerCase().includes(needle)).map((c) => c.id)
    );

    // One pass over the messages rather than a query per conversation: the
    // content is not indexed, so either way every message is read, and this
    // reads them once.
    const spokenIn = new Map<string, { excerpt: string; messageId: number }>();
    await db.messages.each((message) => {
      if (
        spokenIn.has(message.convId) ||
        named.has(message.convId) ||
        // Import validates a message's id and convId and nothing else.
        typeof message.content !== 'string'
      ) {
        return;
      }
      const excerpt = excerptAround(message.content, needle);
      if (excerpt) {
        spokenIn.set(message.convId, { excerpt, messageId: message.id });
      }
    });

    return all
      .filter((c) => named.has(c.id) || spokenIn.has(c.id))
      .map((conv) => ({ conv, ...spokenIn.get(conv.id) }));
  }

  // --- Export / Import Functions ---

  /**
   * Exports all from the database.
   * @returns A promise resolving to a database records.
   */
  static async exportDB(convId?: string): Promise<ExportJsonStructure> {
    return await db.transaction('r', db.tables, async () => {
      const data: ExportJsonStructure = [];
      for (const table of db.tables) {
        const rows = [];
        if (!convId) {
          rows.push(...(await table.toArray()));
        } else {
          if (table.name === 'conversations') {
            rows.push(await table.where('id').equals(convId).first());
          } else if (table.name === 'messages') {
            rows.push(
              ...(await table.where('convId').equals(convId).toArray())
            );
          }
        }
        if (isDev)
          console.debug(
            `Export - Fetched ${rows.length} rows from table '${table.name}'.`
          );
        data.push({ table: table.name, rows: rows });
      }
      return data;
    });
  }

  /**
   * Import data into database.
   * @returns A promise that resolves when import is complete.
   */
  /**
   * Rejects anything that is not a llama.ui export before it reaches the
   * database. Rows are written with `bulkPut`, so an unchecked import can
   * overwrite existing conversations with malformed ones — a conversation
   * lacking `name` breaks sidebar search, and one lacking `lastModified`
   * cannot be grouped. A file that parses as JSON but carries no known table
   * would otherwise report a successful import while doing nothing.
   *
   * @param data The parsed contents of the file being imported.
   * @throws If the payload is not a recognisable export.
   */
  static assertValidExport(data: unknown): asserts data is ExportJsonStructure {
    if (!Array.isArray(data)) {
      throw new Error('Import file is not a llama.ui export.');
    }

    const records = data as Array<{ table?: unknown; rows?: unknown }>;
    for (const record of records) {
      if (
        !record ||
        typeof record !== 'object' ||
        typeof record.table !== 'string' ||
        !Array.isArray(record.rows)
      ) {
        throw new Error('Import file is not a llama.ui export.');
      }
    }

    const known = records.filter((r) =>
      db.tables.some((t) => t.name === r.table)
    );
    if (known.length === 0) {
      throw new Error('Import file contains no llama.ui tables.');
    }

    for (const record of known) {
      for (const row of record.rows as Array<Record<string, unknown>>) {
        if (!row || typeof row !== 'object') {
          throw new Error(
            `Import file has an invalid row in '${record.table}'.`
          );
        }
        if (
          record.table === db.conversations.name &&
          (typeof row.id !== 'string' ||
            typeof row.name !== 'string' ||
            typeof row.lastModified !== 'number')
        ) {
          throw new Error('Import file has a malformed conversation.');
        }
        if (
          record.table === db.messages.name &&
          (typeof row.id !== 'number' || typeof row.convId !== 'string')
        ) {
          throw new Error('Import file has a malformed message.');
        }
      }
    }
  }

  static async importDB(data: ExportJsonStructure) {
    IndexedDB.assertValidExport(data);
    return await db.transaction('rw', db.tables, async () => {
      for (const record of data) {
        console.debug(`Import - Processing table '${record.table}'...`);
        if (db.tables.some((t) => t.name === record.table)) {
          // Override existing rows if key exists.
          await db.table(record.table).bulkPut(record.rows);
          console.debug(
            `Import - Imported ${record.rows.length} rows into table '${record.table}'.`
          );
        } else {
          console.warn(`Import - Skipping unknown table '${record.table}'.`);
        }
      }

      // Dispatch change events for conversations that were imported/updated.
      const convRecords = data.filter((r) => r.table === db.conversations.name);
      for (const record of convRecords) {
        for (const row of record.rows) {
          const convRow = row as Partial<Conversation>;
          if (convRow.id !== undefined) {
            dispatchConversationChange(convRow.id);
          } else {
            console.warn("Imported conversation row missing 'id':", row);
          }
        }
      }
    });
  }

  // --- Event Listeners ---

  /**
   * Registers a callback to be invoked when a conversation changes.
   * @param callback The function to call when a conversation changes.
   */
  static onConversationChanged(callback: CallbackConversationChanged) {
    const wrappedListener: EventListener = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      callback(customEvent.detail); // Pass the convId from the event detail
    };
    onConversationChangedHandlers.push([callback, wrappedListener]);
    event.addEventListener('conversationChange', wrappedListener);
  }

  /**
   * Unregisters a previously registered conversation change callback.
   * @param callback The function to unregister.
   */
  static offConversationChanged(callback: CallbackConversationChanged) {
    const index = onConversationChangedHandlers.findIndex(
      ([cb]) => cb === callback
    );
    if (index !== -1) {
      const [, wrappedListener] = onConversationChangedHandlers[index];
      event.removeEventListener('conversationChange', wrappedListener);
      onConversationChangedHandlers.splice(index, 1); // Remove the specific listener entry
    }
  }

  /**
   * Retrieves the user's configuration presets.
   * @returns The array of configuration preset.
   */
  static async getPresets() {
    return db.transaction('r', db.userConfigurations, async () => {
      return db.userConfigurations.toArray();
    });
  }

  /**
   * Saves the user's configuration preset to localStorage, replacing the existing one.
   * @param name The preset name to save.
   * @param config The Configuration object to save.
   */
  static async savePreset(name: string, config: Configuration, id?: string) {
    const now = Date.now();
    const newPreset: ConfigurationPreset = {
      id: id || `config-${now}`,
      name,
      createdAt: now,
      config,
    };
    await db.transaction('rw', db.userConfigurations, async () => {
      await db.userConfigurations.where('name').equals(name).delete();
      await db.userConfigurations.add(newPreset);
    });
    return newPreset;
  }

  /**
   * Removes the user's configuration preset.
   * @param name The preset name to remove.
   */
  static async removePreset(name: string) {
    return db.transaction('rw', db.userConfigurations, async () => {
      return db.userConfigurations.where('name').equals(name).delete();
    });
  }
}
