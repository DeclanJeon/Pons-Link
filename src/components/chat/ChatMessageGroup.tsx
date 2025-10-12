/**
 * 메시지 그룹 컴포넌트
 * @module ChatMessageGroup
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileMessage } from '@/components/functions/FileMessage';
import { MessageGroup } from '@/types/chat.types';
import { formatTime } from '@/utils/chat.utils';
import { CHAT_CONSTANTS } from '@/constants/chat.constants';

interface ChatMessageGroupProps {
  group: MessageGroup;
  isOwn: boolean;
}

export const ChatMessageGroup = ({ group, isOwn }: ChatMessageGroupProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: CHAT_CONSTANTS.ANIMATION_DURATION / 1000 }}
      className={cn(
        "flex flex-col gap-1",
        isOwn ? "items-end" : "items-start"
      )}
    >
      {/* 발신자 정보 */}
      <div className={cn(
        "flex items-center gap-2 px-1 mb-1",
        isOwn && "flex-row-reverse"
      )}>
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
          isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {group.senderNickname[0].toUpperCase()}
        </div>
        <span className="text-xs font-medium text-foreground">
          {group.senderNickname}
        </span>
      </div>

      {/* 메시지들 */}
      {group.messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "max-w-[85%]",
            isOwn ? "items-end" : "items-start"
          )}
        >
          {message.type === 'file' && message.fileMeta ? (
            <FileMessage message={message} />
          ) : (
            <div className={cn(
              "chat-bubble group relative",
              isOwn && "own"
            )}>
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {message.text}
              </p>
              
              <span className={cn(
                "absolute -bottom-5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity",
                isOwn ? "right-0" : "left-0"
              )}>
                {formatTime(message.timestamp)}
              </span>
            </div>
          )}
        </div>
      ))}
    </motion.div>
  );
};
