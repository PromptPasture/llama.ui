import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { normalizeMsgsForAPI } from '../api/message-normalization';
import { isDev } from '../config';
import IndexedDB from '../database/indexedDB';
import { generateChatStream } from '../services/inference-service';
import { useAppContext } from '../store/app';
import { useInferenceContext } from '../store/inference';
import { InferenceApiMessage, Message, PendingMessage } from '../types';

export type CallbackGeneratedChunk = (currLeafNodeId?: Message['id']) => void;

export interface SendMessageProps {
  convId: Message['convId'];
  type: Message['type'];
  role: Message['role'];
  parent: Message['parent'];
  content: string | null;
  extra: Message['extra'];
  system?: string;
  onChunk: CallbackGeneratedChunk;
}

export interface ReplaceMessageProps {
  msg: Message;
  newContent: string;
  onChunk: CallbackGeneratedChunk;
}

export function useInference({
  pendingMessages,
  aborts,
  setPending,
  setAbort,
}: {
  pendingMessages: Record<string, PendingMessage>;
  aborts: Record<string, AbortController>;
  setPending: (convId: string, pendingMsg: PendingMessage | null) => void;
  setAbort: (convId: string, controller: AbortController | null) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { config } = useAppContext();
  const { provider, selectedModel } = useInferenceContext();

  const isGenerating = useCallback(
    (convId: string) => convId in pendingMessages,
    [pendingMessages]
  );

  const generateMessage = useCallback(
    async ({
      convId,
      leafNodeId,
      systemMessage,
      onChunk,
    }: {
      convId: string;
      leafNodeId: Message['id'];
      systemMessage?: string;
      onChunk: CallbackGeneratedChunk;
    }) => {
      if (isGenerating(convId) || !provider) return;

      const currConversation = await IndexedDB.getOneConversation(convId);
      if (!currConversation) {
        throw new Error(t('state.chat.errors.conversationNotFound'));
      }

      const rawMessages = await IndexedDB.getMessages(convId);
      const currMessages = IndexedDB.filterByLeafNodeId(
        rawMessages,
        leafNodeId,
        false
      ).filter((m) => m.role !== 'system');

      const abortController = new AbortController();
      setAbort(convId, abortController);

      if (!currMessages) {
        throw new Error(t('state.chat.errors.messagesNotFound'));
      }

      const messages: InferenceApiMessage[] = normalizeMsgsForAPI(currMessages);
      if (systemMessage) {
        messages.unshift({ role: 'system', content: systemMessage });
      }

      const { model } = config;

      const pendingId = Date.now() + 1;
      let pendingMsg: PendingMessage = {
        id: pendingId,
        convId,
        type: 'text',
        timestamp: pendingId,
        model: selectedModel ? selectedModel.name : model,
        role: 'assistant',
        content: null,
        reasoning_content: null,
        parent: leafNodeId,
        children: [],
      };
      setPending(convId, pendingMsg);

      try {
        await generateChatStream({
          provider,
          config,
          model,
          messages,
          signal: abortController.signal,
          onUpdate: (update) => {
            pendingMsg = { ...pendingMsg, ...update };
            setPending(convId, pendingMsg);
          },
        });
      } catch (err) {
        setPending(convId, null);
        if ((err as Error).name === 'AbortError') {
          if (isDev) console.debug('Generation aborted by user.');
        } else {
          console.error('Error during message generation:', err);
          toast.error(
            (err as Error)?.message ??
              t('state.chat.errors.unknownErrorDuringGeneration')
          );
          throw err;
        }
      }

      if (pendingMsg.content !== null) {
        await IndexedDB.appendMsg(pendingMsg as Message, leafNodeId);
      }
      setPending(convId, null);
      onChunk(pendingId);
    },
    [config, isGenerating, provider, selectedModel, setAbort, setPending, t]
  );

  const sendMessage = useCallback(
    async ({
      convId,
      type,
      role,
      parent,
      content,
      extra,
      system,
      onChunk,
    }: SendMessageProps): Promise<boolean> => {
      if (isGenerating(convId ?? '') || !convId || !type || !role || !parent)
        return false;

      let currMsgId;
      if (content === null) {
        currMsgId = parent;
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
        } catch (err) {
          toast.error(t('state.chat.errors.cannotSaveMessage'));
          return false;
        }
      }

      onChunk(currMsgId);

      try {
        await generateMessage({
          convId,
          leafNodeId: currMsgId,
          systemMessage: system,
          onChunk,
        });
        return true;
      } catch (error) {
        console.error('Message sending failed, consider rollback:', error);
        toast.error(t('state.chat.errors.failedToGetResponse'));
      }
      return false;
    },
    [generateMessage, isGenerating, t]
  );

  const stopGenerating = useCallback(
    (convId: string) => {
      setPending(convId, null);
      aborts[convId]?.abort();
    },
    [aborts, setPending]
  );

  const replaceMessage = useCallback(
    async ({ msg, newContent, onChunk }: ReplaceMessageProps) => {
      if (isGenerating(msg.convId)) return;

      const now = Date.now();
      const currMsgId = now;
      await IndexedDB.appendMsg(
        {
          ...msg,
          id: currMsgId,
          timestamp: now,
          content: newContent,
        },
        msg.parent
      );
      onChunk(currMsgId);
    },
    [isGenerating]
  );

  const branchMessage = useCallback(
    async (msg: Message) => {
      if (isGenerating(msg.convId)) return;

      try {
        const conv = await IndexedDB.branchConversation(msg.convId, msg.id);
        navigate(`/chat/${conv.id}`);
      } catch (error) {
        console.error('Conversation branch failed:', error);
        toast.error(t('state.chat.errors.failedToBranchConversation'));
      }
    },
    [isGenerating, navigate, t]
  );

  return {
    isGenerating,
    generateMessage,
    sendMessage,
    stopGenerating,
    replaceMessage,
    branchMessage,
  };
}
