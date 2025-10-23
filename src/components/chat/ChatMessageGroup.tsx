/**
 * 채팅 메시지 그룹 (발신자별 연속 메시지) - 완전 수정
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
      className="flex flex-col gap-2 w-full px-2"
    >
      {group.messages.map((message) => (
        <div 
          key={message.id}
          className={cn(
            'flex items-start gap-2 w-full',
            isOwn && 'flex-row-reverse'
          )}
        >
          {/* 아바타 */}
          <div
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-1',
              isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}
          >
            {message.senderNickname[0].toUpperCase()}
          </div>

          {/* 메시지 컨텐츠 영역 */}
          <div 
            className={cn(
              'flex flex-col gap-1 min-w-0 flex-1',
              isOwn ? 'items-end' : 'items-start'
            )}
          >
            {/* 닉네임 */}
            <span className="text-[10px] font-medium text-foreground px-1 truncate max-w-full">
              {message.senderNickname}
            </span>

            {/* 메시지 버블과 타임스탬프 */}
            <div className={cn(
              'flex items-end gap-1.5 w-full max-w-full',
              isOwn ? 'flex-row-reverse' : 'flex-row'
            )}>
              {/* 메시지 본문 */}
              <div className="min-w-0 flex-1 max-w-full">
                {message.type === 'file' || message.type === 'image' ? (
                  <FileMessage message={message} />
                ) : message.type === 'gif' && message.fileMeta ? (
                  <div className="w-full max-w-md">
                    <div className="bg-secondary/50 backdrop-blur-sm border border-border/50 rounded-lg p-2">
                      <img
                        src={message.fileMeta.url}
                        alt="Shared GIF"
                        className="w-full max-h-48 rounded-md object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'chat-bubble max-w-md',
                      isOwn && 'own'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {message.text}
                    </p>
                  </div>
                )}
              </div>

              {/* 타임스탬프 */}
              <span
                className={cn(
                  'text-[9px] text-muted-foreground whitespace-nowrap flex-shrink-0 self-end mb-0.5'
                )}
              >
                {formatTime(message.timestamp)}
              </span>
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  );
};
