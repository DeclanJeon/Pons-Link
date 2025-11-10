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
  senderId?: string;
  checksum?: string;
  // 폴더 전송 관련 필드
  isFolder?: boolean;
  filesCount?: number;
  relativePaths?: string[]; // 폴더 내 파일들의 상대 경로
}

/**
 * 메시지 반응 타입
 */
export interface MessageReaction {
  emoji: string;
  userIds: string[];
  count: number;
}

/**
 * 링크 미리보기 타입
 */
export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image?: string;
  siteName?: string;
}

/**
 * 채팅 메시지 구조 (확장)
 */
export interface ChatMessage {
  id: string;
  type: 'text' | 'file' | 'image' | 'gif';
  text?: string;
  senderId: string;
  senderNickname: string;
  timestamp: number;
  fileMeta?: FileMetadata;
  previewUrl?: string;
  reactions?: MessageReaction[];
  parentId?: string; // 스레드 지원 - 부모 메시지 ID
  replies?: string[]; // 답장 메시지 ID 목록
  replyTo?: ChatMessage; // 답장한 원본 메시지
  linkPreviews?: LinkPreview[];
  isEdited?: boolean;
  editedAt?: number;
  readBy?: string[]; // 읽음 확인
  status?: 'sending' | 'sent' | 'failed'; // 전송 상태
}

export interface ChatSession {
  userId: string;
  nickname: string;
}

export interface MessageGroup {
  senderId: string;
  senderNickname: string;
  messages: ChatMessage[];
  date: string; // 날짜 구분용
}

export type TypingState = Map<string, string>;

/**
 * 채팅 설정 타입
 */
export interface ChatSettings {
  enableLinkPreviews: boolean;
  enableReadReceipts: boolean;
  enableReactions: boolean;
  enableMentions: boolean;
  fontSize: 'sm' | 'md' | 'lg';
  theme: 'auto' | 'light' | 'dark';
}
