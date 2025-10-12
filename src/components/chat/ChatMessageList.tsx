/**
 * 메시지 리스트 컴포넌트
 * @module ChatMessageList
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

export const ChatMessageList = ({ groups, currentUserId }: ChatMessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groups]);

  return (
    <ScrollArea className="flex-1 px-4">
      <div className="py-4 space-y-6">
        <AnimatePresence initial={false}>
          {groups.map((group) => (
            <ChatMessageGroup
              key={group.messages[0].id}
              group={group}
              isOwn={group.senderId === currentUserId}
            />
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
};
