/**
 * 채팅 입력 관리 훅
 * @module useChatInput
 */

import { useState, useCallback, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { useTypingState } from './useTypingState';

interface UseChatInputProps {
  userId: string;
  onSendMessage: (message: string) => void;
  onFileSelect: (file: File) => void;
}

export const useChatInput = ({ userId, onSendMessage, onFileSelect }: UseChatInputProps) => {
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { handleTypingStart, handleTypingEnd } = useTypingState(userId);

  /**
   * 메시지 전송 처리
   */
  const handleSend = useCallback(() => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
      handleTypingEnd();
    }
  }, [message, onSendMessage, handleTypingEnd]);

  /**
   * 입력 변경 처리
   */
  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    handleTypingStart();
  }, [handleTypingStart]);

  /**
   * 키 입력 처리
   */
  const handleKeyPress = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

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

  return {
    message,
    inputRef,
    fileInputRef,
    handleInputChange,
    handleKeyPress,
    handleSend,
    handleFileChange,
    handleAttachClick
  };
};
