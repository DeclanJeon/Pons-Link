/**
 * 채팅 메시지 그룹 컴포넌트 - 카카오톡 스타일
 * @module ChatMessageGroup
 * 
 * UI 구조:
 * - 수신 메시지: [아바타] 닉네임 [버블] 시간
 * - 송신 메시지:              시간 [버블]
 * - 연속 메시지: 아바타는 첫 메시지에만
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileMessage } from '@/components/functions/chat/FileMessage';
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
      className="w-full px-3 py-2"
    >
      {/* 수신 메시지 (왼쪽) */}
      {!isOwn && (
        <div className="flex gap-2 items-start">
          {/* 아바타 (첫 메시지에만) */}
          <div className="flex-shrink-0 w-10">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
              {group.messages[0].senderNickname[0].toUpperCase()}
            </div>
          </div>

          {/* 메시지 영역 */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {/* 닉네임 (첫 메시지 위에만) */}
            <div className="text-xs font-semibold text-foreground/90 px-1">
              {group.messages[0].senderNickname}
            </div>

            {/* 메시지 리스트 */}
            {group.messages.map((message) => (
              <div key={message.id} className="flex items-end gap-1.5">
                {/* 메시지 버블 */}
                <div className="max-w-[70%]">
                  {message.type === 'file' || message.type === 'image' ? (
                    <FileMessage message={message} />
                  ) : message.type === 'gif' && message.fileMeta ? (
                    <div className="bg-secondary/50 backdrop-blur-sm border border-border/50 rounded-2xl rounded-tl-sm p-2 shadow-sm">
                      <img
                        src={message.fileMeta.url}
                        alt="GIF"
                        className="max-w-xs max-h-48 rounded-lg object-contain"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="bg-secondary/80 text-foreground px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm hover:shadow-md transition-shadow">
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {message.text}
                      </p>
                    </div>
                  )}
                </div>

                {/* 타임스탬프 */}
                <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap pb-0.5">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 송신 메시지 (오른쪽) */}
      {isOwn && (
        <div className="flex flex-col gap-1 items-end">
          {group.messages.map((message) => (
            <div key={message.id} className="flex items-end gap-1.5 justify-end">
              {/* 타임스탬프 (왼쪽) */}
              <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap pb-0.5">
                {formatTime(message.timestamp)}
              </span>

              {/* 메시지 버블 */}
              <div className="max-w-[70%]">
                {message.type === 'file' || message.type === 'image' ? (
                  <FileMessage message={message} />
                ) : message.type === 'gif' && message.fileMeta ? (
                  <div className="bg-primary/90 backdrop-blur-sm border border-primary/30 rounded-2xl rounded-br-sm p-2 shadow-sm">
                    <img
                      src={message.fileMeta.url}
                      alt="GIF"
                      className="max-w-xs max-h-48 rounded-lg object-contain"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-sm shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {message.text}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};
