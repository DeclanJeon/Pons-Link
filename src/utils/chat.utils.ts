/**
 * Chat 관련 유틸리티 함수
 * @module ChatUtils
 */

import { MessageGroup } from '../types/chat.types';
import { ChatMessage } from '@/stores/useChatStore';

/**
 * 메시지를 발신자별로 그룹화
 * @param messages - 그룹화할 메시지 배열
 * @returns 그룹화된 메시지 배열
 */
export const groupMessagesBySender = (messages: ChatMessage[]): MessageGroup[] => {
  const groups: MessageGroup[] = [];
  let currentGroup: ChatMessage[] = [];
  let currentSenderId: string | null = null;

  messages.forEach((msg, index) => {
    if (index === 0 || msg.senderId !== messages[index - 1].senderId) {
      if (currentGroup.length > 0 && currentSenderId) {
        groups.push({
          senderId: currentSenderId,
          senderNickname: currentGroup[0].senderNickname,
          messages: currentGroup
        });
      }
      currentGroup = [msg];
      currentSenderId = msg.senderId;
    } else {
      currentGroup.push(msg);
    }
  });

  if (currentGroup.length > 0 && currentSenderId) {
    groups.push({
      senderId: currentSenderId,
      senderNickname: currentGroup[0].senderNickname,
      messages: currentGroup
    });
  }

  return groups;
};

/**
 * 메시지 필터링
 * @param messages - 필터링할 메시지 배열
 * @param query - 검색 쿼리
 * @returns 필터링된 메시지 배열
 */
export const filterMessages = (messages: ChatMessage[], query: string): ChatMessage[] => {
  if (!query.trim()) return messages;
  
  const lowerQuery = query.toLowerCase();
  return messages.filter(msg => 
    msg.text?.toLowerCase().includes(lowerQuery) ||
    msg.senderNickname.toLowerCase().includes(lowerQuery)
  );
};

/**
 * 시간 포맷팅
 * @param timestamp - Unix 타임스탬프
 * @returns 포맷된 시간 문자열
 */
export const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

/**
 * 타이핑 중인 사용자 추출
 * @param typingState - 타이핑 상태 맵
 * @param currentUserId - 현재 사용자 ID
 * @returns 타이핑 중인 사용자 닉네임 배열
 */
export const getTypingUsers = (
  typingState: Map<string, string>, 
  currentUserId: string
): string[] => {
  return Array.from(typingState.entries())
    .filter(([id]) => id !== currentUserId)
    .map(([_, nickname]) => nickname);
};
