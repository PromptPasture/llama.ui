import { normalizeMsgsForAPI } from '$lib/api/message-normalization';
import { isDev } from '$lib/config';
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

async function loadViewingChat(convId: string): Promise<void> {
  const conv = await IndexedDB.getOneConversation(convId);
  if (!conv) {
    state.viewingChat = null;
    return;
  }
  state.viewingChat = {
    conv,
    messages: await IndexedDB.getMessages(convId),
  };
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

  async loadConversation(convId: string): Promise<void> {
    await loadViewingChat(convId);
    IndexedDB.onConversationChanged(async (changedConvId: string) => {
      if (changedConvId === convId) await loadViewingChat(changedConvId);
    });
  },

  unloadConversation(convId: string): void {
    state.viewingChat = null;
    IndexedDB.offConversationChanged(async (changedConvId: string) => {
      if (changedConvId === convId) await loadViewingChat(changedConvId);
    });
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

    let currMsgId: number;
    if (content === null) {
      currMsgId = parent as number;
    } else {
      currMsgId = Date.now();
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
    if (chat.isGenerating(convId) || !deps.provider) return;

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
    const pendingId = Date.now() + 1;
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
        return;
      }
      console.error('Error during message generation:', err);
      deps.toast(
        (err as Error)?.message ??
          t('state.chat.errors.unknownErrorDuringGeneration')
      );
      throw err;
    }

    if (pendingMsg.content !== null) {
      await IndexedDB.appendMsg(pendingMsg as Message, leafNodeId);
    }
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
    const now = Date.now();
    await IndexedDB.appendMsg(
      { ...msg, id: now, timestamp: now, content: newContent },
      msg.parent
    );
    onChunk(now);
    await chat._generate(
      { convId: msg.convId, leafNodeId: now, onChunk },
      deps
    );
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
      const conv = await IndexedDB.branchConversation(msg.convId, msg.id);
      deps.navigate(conv.id);
    } catch (error) {
      console.error('Conversation branch failed:', error);
      deps.toast(t('state.chat.errors.failedToBranchConversation'));
    }
  },
};
