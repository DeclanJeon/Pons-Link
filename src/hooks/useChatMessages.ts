/**
 * 채팅 메시지 관리 훅 (타임스탬프 보장)
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
  const { userId: storeUserId, nickname: storeNickname, getSessionInfo } = useSessionStore();

  const sessionInfo = getSessionInfo();
  const userId = sessionInfo?.userId || storeUserId || 'unknown-user';
  const nickname = sessionInfo?.nickname || storeNickname || 'Unknown';

  /**
   * 텍스트 메시지 전송
   * 🔧 FIX: 타임스탬프 명시적으로 생성 및 전달
   */
  const sendMessage = useCallback((text: string, timestamp?: number) => {
    if (!sessionInfo) {
      console.warn('[useChatMessages] No session info available, using default values');
    }

    // 타임스탬프가 없으면 현재 시간 사용
    const messageTimestamp = timestamp || Date.now();

    const message: ChatMessage = {
      id: nanoid(),
      type: 'text',
      text,
      senderId: userId,
      senderNickname: nickname,
      timestamp: messageTimestamp
    };

    addMessage(message);
    
    // P2P로 메시지 전송 시에도 타임스탬프 포함
    const data = { 
      type: 'chat', 
      payload: message 
    };
    sendToAllPeers(JSON.stringify(data));
    
    console.log('[useChatMessages] Message sent:', {
      id: message.id,
      text: message.text,
      timestamp: messageTimestamp,
      formattedTime: new Date(messageTimestamp).toLocaleTimeString('ko-KR')
    });
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
   * 타임스탬프 기준으로 정렬 후 그룹화
   */
  const groupedMessages = useMemo(() => {
    // 타임스탬프 기준 오름차순 정렬
    const sortedMessages = [...filteredMessages].sort((a, b) => 
      a.timestamp - b.timestamp
    );
    
    return groupMessagesBySender(sortedMessages);
  }, [filteredMessages]);

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
