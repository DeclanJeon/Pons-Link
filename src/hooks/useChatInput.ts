/**
 * 채팅 입력 관리 훅 (타임스탬프 전달)
 * @module useChatInput
 */

import { useState, useCallback, useRef, ChangeEvent } from 'react';
import { useTypingState } from './useTypingState';

interface UseChatInputProps {
  userId: string;
  onSendMessage: (message: string, timestamp?: number) => void;
  onSendGif: (gifUrl: string) => void;
  onFileSelect: (file: File) => void;
}

export const useChatInput = ({ userId, onSendMessage, onSendGif, onFileSelect }: UseChatInputProps) => {
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { handleTypingStart, handleTypingEnd } = useTypingState(userId);

  /**
   * 메시지 전송 처리
   * 🔧 FIX: 전송 시점의 정확한 타임스탬프 생성
   */
  const handleSend = useCallback(() => {
    const trimmedMessage = message.trim();
    
    if (trimmedMessage) {
      // 메시지 전송 시점의 타임스탬프 생성
      const timestamp = Date.now();
      
      onSendMessage(trimmedMessage, timestamp);
      
      // 메시지 내용 초기화
      setMessage('');
      handleTypingEnd();
      
      console.log('[useChatInput] Message sent at:', new Date(timestamp).toISOString());
    }
  }, [message, onSendMessage, handleTypingEnd]);

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
    setMessage,
    fileInputRef,
    handleSend,
    handleFileChange,
    handleAttachClick,
    handleSendGif
  };
};
