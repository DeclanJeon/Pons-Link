/**
 * Chat 기능에서 사용되는 모든 타입 정의
 * @module ChatTypes
 */

export interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface FileMetadata {
  transferId: string;
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  chunkSize: number;
  url?: string;
}

/**
 * 채팅 메시지 구조
 */
export interface ChatMessage {
  id: string;
  type: 'text' | 'file' | 'image' | 'gif';
  text?: string;
  senderId: string;
  senderNickname: string;
  timestamp: number;
  fileMeta?: FileMetadata;
  previewUrl?: string; // ✅ 추가: 전송 전 로컬 미리보기용
}

export interface ChatSession {
  userId: string;
  nickname: string;
}

export interface MessageGroup {
  senderId: string;
  senderNickname: string;
  messages: ChatMessage[];
}

export type TypingState = Map<string, string>;
