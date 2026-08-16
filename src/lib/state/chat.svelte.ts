import { normalizeMsgsForAPI } from '$lib/api/message-normalization';
import { isDev } from '$lib/config';
import { nextId } from '$lib/database/id';
import IndexedDB from '$lib/database/indexedDB';
import { t } from '$lib/i18n/translate';
import { generateChatStream } from '$lib/services/inference-service';
import type {
  Conversation,
  InferenceApiMessage,
  Message,
  PendingMessage,
  ViewingChat,
} from '$lib/types';

type ToastFn = (message: string) => void;

interface ChatState {
  viewingChat: ViewingChat | null;
  pendingMessages: Record<Conversation['id'], PendingMessage>;
  aborts: Record<Conversation['id'], AbortController>;
}

const state = $state<ChatState>({
  viewingChat: null,
  pendingMessages: {},
  aborts: {},
});

/** The change listener for the conversation currently on screen, if any. */
let viewingListener: ((convId: string) => void) | null = null;

/**
 * Listeners are removed by identity, so the reference has to be kept. Passing
 * an equivalent-looking closure to off() removes nothing, and one listener
 * then leaks per visit, each reloading the whole message list on every change.
 */
function detachViewingListener(): void {
  if (viewingListener) {
    IndexedDB.offConversationChanged(viewingListener);
    viewingListener = null;
  }
}

/**
 * The message to store for a reply, or null if nothing arrived.
 *
 * Keyed on anything having arrived rather than on there being an answer: a
 * model that thinks and then answers nothing has still said something, and the
 * reasoning is the only record of it. Requiring content dropped the whole
 * message, so the thinking streamed in and then vanished, leaving the question
 * looking unanswered.
 *
 * @param pending The reply as streamed
 * @returns The message to append, or null when it said nothing at all
 */
function replyWorthKeeping(pending: PendingMessage): Message | null {
  if (pending.content === null && pending.reasoning_content == null) {
    return null;
  }
  // Content stays a string: null reaches the markdown renderer otherwise.
  return { ...pending, content: pending.content ?? '' } as Message;
}

/**
 * Stores a finished reply, unless the conversation has gone meanwhile.
 *
 * A tab refuses to delete a conversation it is generating in, but it cannot
 * see that another tab is: the guard reads in-memory state, and only the
 * database is shared. Appending regardless leaves messages behind pointing at
 * a conversation that no longer exists, which nothing reads and nothing
 * deletes.
 *
 * @param pending The reply as streamed
 * @param leafNodeId The message it answers
 * @param toast How to report that the conversation has gone
 * @returns The stored message, or null if there was nothing to store
 */
async function storeReply(
  pending: PendingMessage,
  leafNodeId: Message['id'],
  toast: ToastFn
): Promise<Message | null> {
  const reply = replyWorthKeeping(pending);
  if (!reply) return null;

  if (!(await IndexedDB.getOneConversation(pending.convId))) {
    toast(t('state.chat.errors.conversationNotFound'));
    return null;
  }

  await IndexedDB.appendMsg(reply, leafNodeId);
  return reply;
}

/** @returns whether the conversation exists. */
async function loadViewingChat(convId: string): Promise<boolean> {
  const conv = await IndexedDB.getOneConversation(convId);
  if (!conv) {
    state.viewingChat = null;
    return false;
  }
  state.viewingChat = {
    conv,
    messages: await IndexedDB.getMessages(convId),
  };
  return true;
}

export const chat = {
  get viewingChat() {
    return state.viewingChat;
  },
  get pendingMessages() {
    return state.pendingMessages;
  },

  isGenerating(convId: string): boolean {
    return convId in state.pendingMessages;
  },

  /** @returns whether the conversation exists. */
  /** @returns whether the conversation exists. */
  async loadConversation(convId: string): Promise<boolean> {
    detachViewingListener();
    const found = await loadViewingChat(convId);

    viewingListener = async (changedConvId: string) => {
      if (changedConvId === convId) await loadViewingChat(changedConvId);
    };
    IndexedDB.onConversationChanged(viewingListener);
    return found;
  },

  unloadConversation(): void {
    state.viewingChat = null;
    detachViewingListener();
  },

  stopGenerating(convId: string): void {
    delete state.pendingMessages[convId];
    state.aborts[convId]?.abort();
    delete state.aborts[convId];
  },

  async sendMessage(
    {
      convId,
      type,
      role,
      parent,
      content,
      extra,
      system,
      onChunk,
    }: {
      convId: Message['convId'];
      type: Message['type'];
      role: Message['role'];
      parent: Message['parent'];
      content: string | null;
      extra: Message['extra'];
      system?: string;
      onChunk: (leafNodeId?: Message['id']) => void;
    },
    deps: {
      config: import('$lib/types').Configuration;
      provider: import('$lib/types').InferenceProvider | null;
      selectedModel: import('$lib/types').InferenceApiModel | null;
      navigate: (convId: import('$lib/types').Conversation['id']) => void;
      toast: ToastFn;
    }
  ): Promise<boolean> {
    if (chat.isGenerating(convId) || !convId || !type || !role || !parent)
      return false;

    // Checked before the message is stored, unlike a request that fails: that
    // one was sent and belongs in the conversation, where it can be tried
    // again. This one was never attempted, so storing it would leave a message
    // sitting unanswered with nothing to ask again.
    if (!deps.provider) {
      deps.toast(t('toast.noModelsPopup.description'));
      return false;
    }

    let currMsgId: number;
    if (content === null) {
      currMsgId = parent as number;
    } else {
      currMsgId = nextId();
      try {
        await IndexedDB.appendMsg(
          {
            id: currMsgId,
            convId,
            type,
            role,
            content,
            extra,
            parent,
            children: [],
            timestamp: currMsgId,
          },
          parent
        );
      } catch {
        deps.toast(t('state.chat.errors.cannotSaveMessage'));
        return false;
      }
    }

    onChunk(currMsgId);

    try {
      await chat._generate(
        { convId, leafNodeId: currMsgId, system, onChunk },
        deps
      );
      return true;
    } catch (error) {
      console.error('Message sending failed:', error);
      deps.toast(t('state.chat.errors.failedToGetResponse'));
    }
    return false;
  },

  async _generate(
    {
      convId,
      leafNodeId,
      system,
      onChunk,
    }: {
      convId: string;
      leafNodeId: Message['id'];
      system?: string;
      onChunk: (leafNodeId?: Message['id']) => void;
    },
    deps: {
      config: import('$lib/types').Configuration;
      provider: import('$lib/types').InferenceProvider | null;
      selectedModel: import('$lib/types').InferenceApiModel | null;
      navigate: (convId: import('$lib/types').Conversation['id']) => void;
      toast: ToastFn;
    }
  ): Promise<void> {
    if (chat.isGenerating(convId)) return;
    if (!deps.provider) {
      // Nothing is configured yet. Without this the send simply does nothing:
      // the message is stored and no reply ever arrives, with no explanation.
      deps.toast(t('toast.noModelsPopup.description'));
      return;
    }

    const rawMessages = await IndexedDB.getMessages(convId);
    const currMessages = IndexedDB.filterByLeafNodeId(
      rawMessages,
      leafNodeId,
      false
    ).filter((m) => m.role !== 'system');

    const abortController = new AbortController();
    state.aborts[convId] = abortController;

    const messages: InferenceApiMessage[] = normalizeMsgsForAPI(currMessages);
    if (system) messages.unshift({ role: 'system', content: system });

    const { model } = deps.config;
    const pendingId = nextId();
    let pendingMsg: PendingMessage = {
      id: pendingId,
      convId,
      type: 'text',
      timestamp: pendingId,
      model: deps.selectedModel ? deps.selectedModel.name : model,
      role: 'assistant',
      content: null,
      reasoning_content: null,
      parent: leafNodeId,
      children: [],
    };
    state.pendingMessages[convId] = pendingMsg;

    try {
      await generateChatStream({
        provider: deps.provider,
        config: deps.config,
        model,
        messages,
        signal: abortController.signal,
        onUpdate: (update) => {
          pendingMsg = { ...pendingMsg, ...update };
          state.pendingMessages[convId] = pendingMsg;
        },
      });
    } catch (err) {
      delete state.pendingMessages[convId];
      if ((err as Error).name === 'AbortError') {
        if (isDev) console.debug('Generation aborted by user.');
        // Stopping is not discarding. Keep what was streamed before the user
        // pressed stop, the same way a completed reply is kept.
        const stopped = await storeReply(pendingMsg, leafNodeId, deps.toast);
        if (stopped) onChunk(stopped.id);
        delete state.aborts[convId];
        return;
      }
      console.error('Error during message generation:', err);
      deps.toast(
        (err as Error)?.message ??
          t('state.chat.errors.unknownErrorDuringGeneration')
      );
      throw err;
    }

    await storeReply(pendingMsg, leafNodeId, deps.toast);
    delete state.pendingMessages[convId];
    delete state.aborts[convId];
    onChunk(pendingId);
  },

  async replaceMessage(
    {
      msg,
      newContent,
      onChunk,
    }: {
      msg: Message;
      newContent: string;
      onChunk: (leafNodeId?: Message['id']) => void;
    },
    deps: {
      config: import('$lib/types').Configuration;
      provider: import('$lib/types').InferenceProvider | null;
      selectedModel: import('$lib/types').InferenceApiModel | null;
      navigate: (convId: import('$lib/types').Conversation['id']) => void;
      toast: ToastFn;
    }
  ): Promise<void> {
    if (chat.isGenerating(msg.convId)) return;
    const now = nextId();
    try {
      await IndexedDB.appendMsg(
        { ...msg, id: now, timestamp: now, content: newContent },
        msg.parent
      );
    } catch {
      // Unreported, a failed save looked exactly like a successful one: the
      // editor closed and the old text came back.
      deps.toast(t('state.chat.errors.cannotSaveMessage'));
      return;
    }
    onChunk(now);
    // Saving an edit is not a request for another answer. Asking for one here
    // appended a second reply under the one just corrected, at the cost of a
    // whole generation, every time the Save button was pressed.
  },

  async branchMessage(
    msg: Message,
    deps: {
      navigate: (convId: import('$lib/types').Conversation['id']) => void;
      toast: ToastFn;
    }
  ): Promise<void> {
    if (chat.isGenerating(msg.convId)) return;
    try {
      const source = await IndexedDB.getOneConversation(msg.convId);
      const conv = await IndexedDB.branchConversation(
        msg.convId,
        msg.id,
        t('state.chat.branchedName', {
          values: { name: source?.name ?? '' },
        })
      );
      deps.navigate(conv.id);
    } catch (error) {
      console.error('Conversation branch failed:', error);
      deps.toast(t('state.chat.errors.failedToBranchConversation'));
    }
  },
};
