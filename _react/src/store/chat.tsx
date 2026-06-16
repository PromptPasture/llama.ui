import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useReducer,
} from 'react';
import { matchPath, useLocation } from 'react-router';
import IndexedDB from '../database/indexedDB';
import {
  ReplaceMessageProps,
  SendMessageProps,
  useInference,
} from '../hooks/useInference';
import {
  CanvasData,
  Conversation,
  Message,
  PendingMessage,
  ViewingChat,
} from '../types';

// Define action types enum
enum ChatActionType {
  SET_VIEWING_CHAT = 'SET_VIEWING_CHAT',
  SET_PENDING_MESSAGE = 'SET_PENDING_MESSAGE',
  REMOVE_PENDING_MESSAGE = 'REMOVE_PENDING_MESSAGE',
  SET_ABORT_CONTROLLER = 'SET_ABORT_CONTROLLER',
  REMOVE_ABORT_CONTROLLER = 'REMOVE_ABORT_CONTROLLER',
  SET_CANVAS_DATA = 'SET_CANVAS_DATA',
}

// Define action interfaces
interface SetViewingChatAction {
  type: ChatActionType.SET_VIEWING_CHAT;
  payload: { viewingChat: ViewingChat | null };
}

interface SetPendingMessageAction {
  type: ChatActionType.SET_PENDING_MESSAGE;
  payload: { convId: string; pendingMsg: PendingMessage };
}

interface RemovePendingMessageAction {
  type: ChatActionType.REMOVE_PENDING_MESSAGE;
  payload: { convId: string };
}

interface SetAbortControllerAction {
  type: ChatActionType.SET_ABORT_CONTROLLER;
  payload: { convId: string; controller: AbortController };
}

interface RemoveAbortControllerAction {
  type: ChatActionType.REMOVE_ABORT_CONTROLLER;
  payload: { convId: string };
}

interface SetCanvasDataAction {
  type: ChatActionType.SET_CANVAS_DATA;
  payload: { canvasData: CanvasData | null };
}

type ChatAction =
  | SetViewingChatAction
  | SetPendingMessageAction
  | RemovePendingMessageAction
  | SetAbortControllerAction
  | RemoveAbortControllerAction
  | SetCanvasDataAction;

interface ChatState {
  viewingChat: ViewingChat | null;
  pendingMessages: Record<Conversation['id'], PendingMessage>;
  aborts: Record<Conversation['id'], AbortController>;
  canvasData: CanvasData | null;
}

const initialState: ChatState = {
  viewingChat: null,
  pendingMessages: {},
  aborts: {},
  canvasData: null,
};

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case ChatActionType.SET_VIEWING_CHAT:
      return {
        ...state,
        viewingChat: action.payload.viewingChat,
      };
    case ChatActionType.SET_PENDING_MESSAGE:
      return {
        ...state,
        pendingMessages: {
          ...state.pendingMessages,
          [action.payload.convId]: action.payload.pendingMsg,
        },
      };
    case ChatActionType.REMOVE_PENDING_MESSAGE: {
      const newPendingMessages = { ...state.pendingMessages };
      delete newPendingMessages[action.payload.convId];
      return {
        ...state,
        pendingMessages: newPendingMessages,
      };
    }
    case ChatActionType.SET_ABORT_CONTROLLER:
      return {
        ...state,
        aborts: {
          ...state.aborts,
          [action.payload.convId]: action.payload.controller,
        },
      };
    case ChatActionType.REMOVE_ABORT_CONTROLLER: {
      const newAborts = { ...state.aborts };
      delete newAborts[action.payload.convId];
      return {
        ...state,
        aborts: newAborts,
      };
    }
    case ChatActionType.SET_CANVAS_DATA:
      return {
        ...state,
        canvasData: action.payload.canvasData,
      };
    default:
      return state;
  }
};

interface ChatContextValue {
  // canvas
  canvasData: CanvasData | null;
  setCanvasData: (data: CanvasData | null) => void;

  // conversations and messages
  viewingChat: ViewingChat | null;
  pendingMessages: Record<Conversation['id'], PendingMessage>;
  isGenerating: (convId: string) => boolean;
  sendMessage: (props: SendMessageProps) => Promise<boolean>;
  stopGenerating: (convId: string) => void;
  replaceMessage: (props: ReplaceMessageProps) => Promise<void>;
  branchMessage: (msg: Message) => Promise<void>;
}

const getViewingChat = async (convId: string): Promise<ViewingChat | null> => {
  const conv = await IndexedDB.getOneConversation(convId);
  if (!conv) return null;
  return {
    conv: conv,
    // all messages from all branches, not filtered by last node
    messages: await IndexedDB.getMessages(convId),
  };
};

const ChatContext = createContext<ChatContextValue | null>(null);

export const ChatContextProvider = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const params = matchPath('/chat/:convId', pathname);
  const convId = params?.params?.convId;

  const [state, dispatch] = useReducer(chatReducer, initialState);

  // handle change when the convId from URL is changed
  const handleConversationChange = useCallback(
    async (changedConvId: string) => {
      if (changedConvId !== convId) return;
      dispatch({
        type: ChatActionType.SET_VIEWING_CHAT,
        payload: { viewingChat: await getViewingChat(changedConvId) },
      });
    },
    [convId]
  );

  useEffect(() => {
    // also reset the canvas data
    dispatch({
      type: ChatActionType.SET_CANVAS_DATA,
      payload: { canvasData: null },
    });
    IndexedDB.onConversationChanged(handleConversationChange);
    getViewingChat(convId ?? '').then((viewingChat) =>
      dispatch({
        type: ChatActionType.SET_VIEWING_CHAT,
        payload: { viewingChat },
      })
    );
    return () => {
      IndexedDB.offConversationChanged(handleConversationChange);
    };
  }, [convId, handleConversationChange]);

  const setPending = useCallback(
    (convId: string, pendingMsg: PendingMessage | null) => {
      if (!pendingMsg) {
        dispatch({
          type: ChatActionType.REMOVE_PENDING_MESSAGE,
          payload: { convId },
        });
      } else {
        dispatch({
          type: ChatActionType.SET_PENDING_MESSAGE,
          payload: { convId, pendingMsg },
        });
      }
    },
    []
  );

  const setAbort = useCallback(
    (convId: string, controller: AbortController | null) => {
      if (!controller) {
        dispatch({
          type: ChatActionType.REMOVE_ABORT_CONTROLLER,
          payload: { convId },
        });
      } else {
        dispatch({
          type: ChatActionType.SET_ABORT_CONTROLLER,
          payload: { convId, controller },
        });
      }
    },
    []
  );

  const {
    isGenerating,
    sendMessage,
    stopGenerating,
    replaceMessage,
    branchMessage,
  } = useInference({
    pendingMessages: state.pendingMessages,
    aborts: state.aborts,
    setPending,
    setAbort,
  });

  const setCanvasData = useCallback((data: CanvasData | null) => {
    dispatch({
      type: ChatActionType.SET_CANVAS_DATA,
      payload: { canvasData: data },
    });
  }, []);

  return (
    <ChatContext.Provider
      value={{
        viewingChat: state.viewingChat,
        canvasData: state.canvasData,
        pendingMessages: state.pendingMessages,
        isGenerating,
        sendMessage,
        stopGenerating,
        replaceMessage,
        branchMessage,
        setCanvasData,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatContextProvider');
  }
  return context;
};
