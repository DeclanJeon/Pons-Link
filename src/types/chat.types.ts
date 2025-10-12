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
}

export interface ChatMessage {
  id: string;
  type: 'text' | 'file';
  text?: string;
  fileMeta?: FileMetadata;
  senderId: string;
  senderNickname: string;
  timestamp: number;
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
