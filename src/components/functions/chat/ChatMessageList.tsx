/**
 * 메시지 리스트 컴포넌트 (날짜 구분선 및 개선된 렌더링)
 * @module ChatMessageList
 */

import { useRef, useEffect, forwardRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnimatePresence } from 'framer-motion';
import { ChatMessageGroup } from './ChatMessageGroup';
import { DateSeparator } from './DateSeparator';
import { MessageGroup } from '@/types/chat.types';
import { cn } from '@/lib/utils';

interface ChatMessageListProps {
  groups: MessageGroup[];
  currentUserId: string;
  searchQuery?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
}

export const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ groups, currentUserId, searchQuery, onScroll, onDeleteMessage, onEditMessage, onAddReaction, onReply }, ref) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // 새 메시지 도착 시 자동 스크롤
    useEffect(() => {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end"
        });
      }, 100);

      return () => clearTimeout(timer);
    }, [groups]);

    // 날짜별로 그룹 재구성
    const groupsByDate = groups.reduce((acc, group) => {
      const date = group.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(group);
      return acc;
    }, {} as Record<string, MessageGroup[]>);

    return (
      <ScrollArea
        ref={ref}
        className="flex-1 px-2"
        onScroll={onScroll}
      >
        <div className="py-4 space-y-2">
          <AnimatePresence initial={false} mode="popLayout">
            {Object.entries(groupsByDate).map(([date, dateGroups]) => (
              <div key={date}>
                <DateSeparator date={date} />
                {dateGroups.map((group) => (
                  <ChatMessageGroup
                    key={`${group.senderId}-${group.messages[0].id}`}
                    group={group}
                    isOwn={group.senderId === currentUserId}
                    searchQuery={searchQuery}
                    onDeleteMessage={onDeleteMessage}
                    onEditMessage={onEditMessage}
                    onAddReaction={onAddReaction}
                    onReply={onReply}
                  />
                ))}
              </div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </ScrollArea>
    );
  }
);

ChatMessageList.displayName = 'ChatMessageList';