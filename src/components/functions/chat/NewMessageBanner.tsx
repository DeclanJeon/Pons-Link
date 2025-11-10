/**
 * 새 메시지 알림 배너
 * @module NewMessageBanner
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import { CHAT_MESSAGES } from '@/constants/chat.constants';
import { useEffect, useRef } from 'react';

interface NewMessageBannerProps {
  isVisible: boolean;
  unreadCount: number;
  onScrollToBottom: () => void;
  onHideBanner: () => void;
}

export const NewMessageBanner = ({
  isVisible,
  unreadCount,
  onScrollToBottom,
  onHideBanner
}: NewMessageBannerProps) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isVisible) {
      // 2초 후에 알림 자동 제거
      timeoutRef.current = setTimeout(() => {
        onScrollToBottom();
        onHideBanner(); // 배너 숨기기
      }, 2000);

      // cleanup 함수에서 타이머 정리
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }
  }, [isVisible, onScrollToBottom, onHideBanner]);

  const handleClick = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onScrollToBottom();
    onHideBanner(); // 배너 숨기기
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20"
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClick}
            className="shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 hover:scale-105"
          >
            <ArrowDown className="w-4 h-4 mr-2 animate-bounce" />
            {CHAT_MESSAGES.NEW_MESSAGES(unreadCount)}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};