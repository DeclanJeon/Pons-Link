/**
 * 채팅 메시지 관리 훅
 * @module useChatMessages
 */

import { useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useChatStore, ChatMessage } from '@/stores/useChatStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { filterMessages, groupMessagesBySender } from '@/utils/chat.utils';

export const useChatMessages = (searchQuery: string) => {
  const { chatMessages, addMessage } = useChatStore();
  const sendToAllPeers = usePeerConnectionStore(state => state.sendToAllPeers);
  const sendFile = usePeerConnectionStore(state => state.sendFile);
  const { getSessionInfo } = useSessionStore();

  const sessionInfo = getSessionInfo();
  const userId = sessionInfo?.userId || 'unknown-user';
  const nickname = sessionInfo?.nickname || 'Unknown';

  /**
   * 텍스트 메시지 전송
   */
  const sendMessage = useCallback((text: string) => {
    if (!sessionInfo) {
      console.error('[useChatMessages] No session info available');
      return;
    }

    const message: ChatMessage = {
      id: nanoid(),
      type: 'text',
      text,
      senderId: userId,
      senderNickname: nickname,
      timestamp: Date.now()
    };

    addMessage(message);
    const data = { type: 'chat', payload: message };
    sendToAllPeers(JSON.stringify(data));
  }, [sessionInfo, userId, nickname, addMessage, sendToAllPeers]);

  /**
   * 파일 전송
   */
  const sendFileMessage = useCallback((file: File) => {
    sendFile(file);
  }, [sendFile]);

  /**
   * 필터링된 메시지
   */
  const filteredMessages = useMemo(() => 
    filterMessages(chatMessages, searchQuery),
    [chatMessages, searchQuery]
  );

  /**
   * 그룹화된 메시지
   */
  const groupedMessages = useMemo(() => 
    groupMessagesBySender(filteredMessages),
    [filteredMessages]
  );

  return {
    messages: chatMessages,
    filteredMessages,
    groupedMessages,
    sendMessage,
    sendFileMessage,
    userId,
    nickname
  };
};
