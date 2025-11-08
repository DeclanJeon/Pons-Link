/**
 * 채팅 입력 관리 훅 (개선 버전)
 * @module useChatInput
 */

import { useState, useCallback, useRef, ChangeEvent, useEffect } from 'react';
import { useTypingState } from './useTypingState';
import { useLocalStorage } from '@/utils/chat.utils';
import { CHAT_CONSTANTS } from '@/constants/chat.constants';

interface UseChatInputProps {
  userId: string;
  onSendMessage: (message: string, timestamp?: number) => void;
  onSendGif: (gifUrl: string) => void;
  onFileSelect: (file: File) => void;
}

export const useChatInput = ({ userId, onSendMessage, onSendGif, onFileSelect }: UseChatInputProps) => {
  const [message, setMessage] = useState('');
  const [draftMessage, setDraftMessage] = useLocalStorage<string>('chat-draft', '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { handleTypingStart, handleTypingEnd } = useTypingState(userId);

  // 초기 로드 시 임시 저장된 메시지 복원
  useEffect(() => {
    if (draftMessage) {
      setMessage(draftMessage);
    }
  }, []);

  // 메시지 변경 시 임시 저장
  useEffect(() => {
    const timer = setTimeout(() => {
      setDraftMessage(message);
    }, CHAT_CONSTANTS.DRAFT_SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [message, setDraftMessage]);

  /**
   * 메시지 전송 처리
   */
  const handleSend = useCallback(() => {
    const trimmedMessage = message.trim();

    if (trimmedMessage) {
      const timestamp = Date.now();

      onSendMessage(trimmedMessage, timestamp);

      setMessage('');
      setDraftMessage(''); // 임시 저장 초기화
      handleTypingEnd();

      console.log('[useChatInput] Message sent at:', new Date(timestamp).toISOString());
    }
  }, [message, onSendMessage, handleTypingEnd, setDraftMessage]);

  /**
   * 메시지 입력 처리
   */
  const handleMessageChange = useCallback((value: string) => {
    setMessage(value);

    if (value.trim()) {
      handleTypingStart();
    } else {
      handleTypingEnd();
    }
  }, [handleTypingStart, handleTypingEnd]);

  /**
   * 파일 선택 처리
   */
  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFileSelect]);

  /**
   * 첨부 버튼 클릭 처리
   */
  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  
  /**
   * GIF 전송 처리
   */
  const handleSendGif = useCallback((gifUrl: string) => {
    onSendGif(gifUrl);
  }, [onSendGif]);

  return {
    message,
    setMessage: handleMessageChange,
    fileInputRef,
    handleSend,
    handleFileChange,
    handleAttachClick,
    handleSendGif
  };
};
