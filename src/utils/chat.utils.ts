/**
 * 타임스탬프 포맷팅 유틸리티
 * @module chat.utils
 */

import { ChatMessage, MessageGroup } from "@/types/chat.types";

/**
 * 타임스탬프를 "오전/오후 HH:MM" 형식으로 변환
 */
export const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  const period = hours < 12 ? '오전' : '오후';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  
  return `${period} ${displayHours}:${displayMinutes}`;
};

/**
 * 상대 시간 표시 (예: "방금", "5분 전", "1시간 전")
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  
  // 7일 이상이면 날짜 표시
  return formatTime(timestamp);
};

/**
 * 날짜별로 메시지 그룹화
 */
export const groupMessagesByDate = (messages: ChatMessage[]): Record<string, ChatMessage[]> => {
  return messages.reduce((groups, message) => {
    const date = new Date(message.timestamp);
    const dateKey = date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    
    return groups;
  }, {} as Record<string, ChatMessage[]>);
};

/**
 * 발신자별로 메시지 그룹화 (연속된 메시지만)
 */
export const groupMessagesBySender = (messages: ChatMessage[]): MessageGroup[] => {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;
  
  messages.forEach((message) => {
    // 같은 발신자의 연속된 메시지인지 확인
    if (
      currentGroup &&
      currentGroup.senderId === message.senderId &&
      // 5분 이내의 메시지만 같은 그룹으로 처리
      (message.timestamp - currentGroup.messages[currentGroup.messages.length - 1].timestamp) < 5 * 60 * 1000
    ) {
      currentGroup.messages.push(message);
    } else {
      // 새로운 그룹 생성
      currentGroup = {
        senderId: message.senderId,
        senderNickname: message.senderNickname,
        messages: [message]
      };
      groups.push(currentGroup);
    }
  });
  
  return groups;
};

/**
 * 검색어로 메시지 필터링
 */
export const filterMessages = (
  messages: ChatMessage[],
  searchQuery: string
): ChatMessage[] => {
  if (!searchQuery.trim()) return messages;
  
  const query = searchQuery.toLowerCase();
  return messages.filter(message =>
    message.text?.toLowerCase().includes(query) ||
    message.senderNickname.toLowerCase().includes(query)
  );
};

/**
 * 타이핑 중인 사용자 추출
 * @param typingState - 타이핑 상태 맵
 * @param currentUserId - 현재 사용자 ID
 * @returns 타이핑 중인 사용자 닉네임 배열
 */
export const getTypingUsers = (
  typingState: Map<string, string> | undefined,
  currentUserId: string
): string[] => {
  if (!typingState) {
    return [];
  }
  
  return Array.from(typingState.entries())
    .filter(([id]) => id !== currentUserId)
    .map(([_, nickname]) => nickname);
};
