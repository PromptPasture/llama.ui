import { useState, useEffect } from 'react';
import IndexedDB from '../database/indexedDB';
import { Conversation } from '../types';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const handleConversationChange = async () => {
      setConversations(await IndexedDB.getAllConversations());
    };
    IndexedDB.onConversationChanged(handleConversationChange);
    handleConversationChange();
    return () => {
      IndexedDB.offConversationChanged(handleConversationChange);
    };
  }, []);

  return conversations;
}
