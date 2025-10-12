/**
 * 메시지 그룹 컴포넌트 (개별 타임스탬프 표시)
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

/**
 * 채팅 메시지 그룹 컴포넌트
 * 같은 발신자의 연속된 메시지를 그룹화하여 표시
 * 각 메시지마다 타임스탬프 표시
 */
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

      {/* 메시지들 - 각 메시지마다 타임스탬프 표시 */}
      <div className="flex flex-col gap-2 w-full">
        {group.messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-2 items-end w-full",
              isOwn ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* 메시지 버블 */}
            <div
              className={cn(
                "max-w-[75%] w-full",
                isOwn ? "items-end" : "items-start"
              )}
            >
              {message.type === 'file' && message.fileMeta ? (
                <FileMessage message={message} />
              ) : (message.type === 'image' || message.type === 'gif') && message.fileMeta ? (
                <div className="max-w-[300px]">
                  <div className="bg-secondary/50 backdrop-blur-sm border border-border/50 rounded-lg p-2">
                    <img
                      src={message.fileMeta.url}
                      alt={message.type === 'gif' ? "Shared GIF" : "Shared image"}
                      className="max-w-full max-h-60 rounded-md object-contain"
                    />
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "chat-bubble",
                  isOwn && "own",
                  "min-w-0" // 텍스트 오버플로우 방지를 위한 최소 너비 설정
                )}>
                  <p className="text-sm whitespace-pre-wrap break-words break-all leading-relaxed">
                    {message.text}
                  </p>
                </div>
              )}
            </div>

            {/* 🔧 FIX: 각 메시지마다 타임스탬프 표시 */}
            <span className={cn(
              "text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0",
              "self-end mb-1" // 메시지 하단에 정렬
            )}>
              {formatTime(message.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
