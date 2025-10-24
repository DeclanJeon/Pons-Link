/**
 * 메시지 리스트 컴포넌트 - 스크롤 동작 최적화
 * @module ChatMessageList
 * 
 * 개선 사항:
 * - 메시지 그룹 간 간격 조정
 * - 자동 스크롤 성능 최적화
 * - 날짜 구분선 추가 (선택사항)
 */

import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnimatePresence } from 'framer-motion';
import { ChatMessageGroup } from './ChatMessageGroup';
import { MessageGroup } from '@/types/chat.types';

interface ChatMessageListProps {
  groups: MessageGroup[];
  currentUserId: string;
}

/**
 * 메시지 리스트 컨테이너
 * - 메시지 그룹을 시간순으로 표시
 * - 새 메시지 도착 시 자동 스크롤
 */
export const ChatMessageList = ({ groups, currentUserId }: ChatMessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 새 메시지 도착 시 부드럽게 스크롤
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: "smooth",
        block: "end"
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [groups]);

  return (
    <ScrollArea 
      ref={scrollAreaRef}
      className="flex-1 px-2"
    >
      <div className="py-4 space-y-4">
        <AnimatePresence initial={false} mode="popLayout">
          {groups.map((group) => (
            <ChatMessageGroup
              key={`${group.senderId}-${group.messages[0].id}`}
              group={group}
              isOwn={group.senderId === currentUserId}
            />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} className="h-1" />
      </div>
    </ScrollArea>
  );
};