/**
 * 채팅 유틸리티 함수 (확장)
 * @module chat.utils
 */

import React from 'react';
import { ChatMessage, MessageGroup, LinkPreview } from "@/types/chat.types";
import { CHAT_CONSTANTS } from "@/constants/chat.constants";

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
    const dateKey = formatDate(date);

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);

    return groups;
  }, {} as Record<string, ChatMessage[]>);
};

/**
 * 발신자별로 메시지 그룹화 (날짜 포함)
 */
export const groupMessagesBySender = (messages: ChatMessage[]): MessageGroup[] => {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  messages.forEach((message) => {
    const messageDate = formatDate(new Date(message.timestamp));

    if (
      currentGroup &&
      currentGroup.senderId === message.senderId &&
      currentGroup.date === messageDate &&
      (message.timestamp - currentGroup.messages[currentGroup.messages.length - 1].timestamp) < CHAT_CONSTANTS.MESSAGE_GROUP_TIME_THRESHOLD
    ) {
      currentGroup.messages.push(message);
    } else {
      currentGroup = {
        senderId: message.senderId,
        senderNickname: message.senderNickname,
        messages: [message],
        date: messageDate
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

/**
 * 날짜 포맷팅
 */
export const formatDate = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === today.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return '오늘';
  if (isYesterday) return '어제';

  const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${days[date.getDay()]}요일`;
  }

  return date.toLocaleDateString('ko-KR', {
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric'
  });
};

/**
 * URL 추출
 */
export const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

/**
 * 멘션 추출
 */
export const extractMentions = (text: string): string[] => {
  const mentionRegex = /@(\w+)/g;
  const matches = text.matchAll(mentionRegex);
  return Array.from(matches, m => m[1]);
};

/**
 * 텍스트 하이라이트
 */
export const highlightText = (text: string, query: string): React.ReactNode[] => {
  if (!query) return [text];

  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts;
};

/**
 * 파일 크기 포맷팅
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * 링크 미리보기 가져오기 (Mock)
 */
export const fetchLinkPreview = async (url: string): Promise<LinkPreview | null> => {
  try {
    // 실제 구현에서는 서버 API를 호출
    // 여기서는 Mock 데이터 반환
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      url,
      title: 'Example Title',
      description: 'This is an example description of the linked content.',
      image: 'https://via.placeholder.com/400x200',
      siteName: 'Example Site'
    };
  } catch (error) {
    console.error('Failed to fetch link preview:', error);
    return null;
  }
};

/**
 * 메시지 상태 아이콘 가져오기
 */
export const getMessageStatusIcon = (status?: 'sending' | 'sent' | 'failed') => {
  switch (status) {
    case 'sending':
      return { icon: 'Clock', color: 'text-muted-foreground' };
    case 'sent':
      return { icon: 'Check', color: 'text-primary' };
    case 'failed':
      return { icon: 'AlertCircle', color: 'text-destructive' };
    default:
      return { icon: 'Check', color: 'text-muted-foreground' };
  }
};

/**
 * 로컬 스토리지 훅
 */
export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  };

  return [storedValue, setValue] as const;
};
