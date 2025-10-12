/**
 *    (  )
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
 *    
 *      
 *    
 */
export const ChatMessageGroup = ({ group, isOwn }: ChatMessageGroupProps) => {
  // 그룹의 첫 메시지 정보를 대표로 사용합니다.
  const representativeMessage = group.messages[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: CHAT_CONSTANTS.ANIMATION_DURATION / 1000 }}
      className={cn(
        "flex flex-col gap-4", // 메시지 간 간격을 조금 더 줍니다.
      )}
    >
      {group.messages.map((message) => (
        <div 
          key={message.id}
          className={cn(
            "flex items-start gap-3",
            isOwn && "flex-row-reverse"
          )}
        >
          {/* 아바타 */}
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1",
            isOwn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            {message.senderNickname[0].toUpperCase()}
          </div>

          {/* 닉네임과 메시지 버블 컨테이너 */}
          <div className={cn(
            "flex flex-col gap-1.5",
            isOwn ? "items-end" : "items-start"
          )}>
            {/* 닉네임 */}
            <span className="text-xs font-medium text-foreground px-1">
              {message.senderNickname}
            </span>

            {/* 메시지 버블과 타임스탬프 */}
            <div className={cn(
              "flex items-end gap-2",
              isOwn ? "flex-row-reverse" : "flex-row"
            )}>
              {/* 메시지 컨텐츠 */}
              <div
                className={cn(
                  "max-w-full", // 너비 제한을 chat-bubble이 하도록 변경
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
                    "chat-bubble max-w-[280px] md:max-w-md", // 반응형 너비 추가
                    isOwn && "own",
                    "min-w-0"
                  )}>
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {message.text}
                    </p>
                  </div>
                )}
              </div>

              {/* 타임스탬프 */}
              <span className={cn(
                "text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0",
                "self-end mb-1"
              )}>
                {formatTime(message.timestamp)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
};
