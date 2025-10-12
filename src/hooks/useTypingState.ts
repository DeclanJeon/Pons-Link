/**
 * 타이핑 상태 관리 훅
 * @module useTypingState
 */

import { useRef, useCallback, useMemo } from 'react';
import { useChatStore } from '@/stores/useChatStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { CHAT_CONSTANTS } from '../constants/chat.constants';
import { getTypingUsers } from '../utils/chat.utils';

export const useTypingState = (userId: string) => {
  const { isTyping } = useChatStore();
  const sendToAllPeers = usePeerConnectionStore(state => state.sendToAllPeers);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 타이핑 상태 전송
   */
  const sendTypingState = useCallback((typing: boolean) => {
    const data = { type: 'typing-state', payload: { isTyping: typing } };
    sendToAllPeers(JSON.stringify(data));
  }, [sendToAllPeers]);

  /**
   * 타이핑 시작 처리
   */
  const handleTypingStart = useCallback(() => {
    if (!typingTimeoutRef.current) {
      sendTypingState(true);
    } else {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingState(false);
      typingTimeoutRef.current = null;
    }, CHAT_CONSTANTS.TYPING_TIMEOUT);
  }, [sendTypingState]);

  /**
   * 타이핑 종료 처리
   */
  const handleTypingEnd = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    sendTypingState(false);
  }, [sendTypingState]);

  /**
   * 타이핑 중인 사용자 목록
   */
  const typingUsers = useMemo(() => 
    getTypingUsers(isTyping, userId),
    [isTyping, userId]
  );

  return {
    typingUsers,
    handleTypingStart,
    handleTypingEnd
  };
};
