import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileMessage } from '@/components/functions/chat/FileMessage';
import { MessageReactions } from './MessageReactions';
import { MessageActions } from './MessageActions';
import { HighlightedText } from './HighlightedText';
import { LinkPreviewCard } from './LinkPreviewCard';
import { MessageGroup, ChatMessage } from '@/types/chat.types';
import { formatTime } from '@/utils/chat.utils';
import { CHAT_CONSTANTS } from '@/constants/chat.constants';
import React, { useState } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, Edit, Reply } from 'lucide-react';

interface ChatMessageGroupProps {
  group: MessageGroup;
  isOwn: boolean;
  searchQuery?: string;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  onAddReaction?: (messageId: string, emoji: string) => void;
  onReply?: (messageId: string) => void;
}

export const ChatMessageGroup = React.forwardRef<HTMLDivElement, ChatMessageGroupProps>(
  ({ group, isOwn, searchQuery, onDeleteMessage, onEditMessage, onAddReaction, onReply }, ref) => {
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');

    const handleEditStart = (message: ChatMessage) => {
      setEditingMessageId(message.id);
      setEditText(message.text || '');
    };

    const handleEditSave = (messageId: string) => {
      if (onEditMessage && editText.trim()) {
        onEditMessage(messageId, editText.trim());
        setEditingMessageId(null);
        setEditText('');
      }
    };

    const handleEditCancel = () => {
      setEditingMessageId(null);
      setEditText('');
    };

    const getStatusIcon = (status?: 'sending' | 'sent' | 'failed') => {
      switch (status) {
        case 'sending':
          return <Clock className="w-3 h-3 text-muted-foreground" />;
        case 'sent':
          return <CheckCheck className="w-3 h-3 text-primary" />;
        case 'failed':
          return <AlertCircle className="w-3 h-3 text-destructive" />;
        default:
          return <Check className="w-3 h-3 text-muted-foreground" />;
      }
    };

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25,
          duration: CHAT_CONSTANTS.ANIMATION_DURATION / 1000
        }}
        className="w-full px-3 py-2 group"
      >
        {/* 수신 메시지 */}
        {!isOwn && (
          <div className="flex gap-2 items-start">
            {/* 아바타 */}
            <div className="flex-shrink-0 w-10">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-bold text-primary border-2 border-primary/20">
                {group.messages[0].senderNickname[0].toUpperCase()}
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              {/* 닉네임 */}
              <div className="text-xs font-semibold text-foreground/90 px-1">
                {group.messages[0].senderNickname}
              </div>

              {/* 메시지 리스트 */}
              {group.messages.map((message) => (
                <div key={message.id} className="flex items-end gap-1.5">
                  {/* 메시지 버블 */}
                  <div className="max-w-[70%] min-w-0 flex-shrink">
                    {/* 답장일 경우 원본 메시지 표시 */}
                    {message.replyTo && (
                      <div className="mb-1 p-2 bg-primary/10 border-l-2 border-primary/50 rounded-md">
                        <div className="flex items-center gap-2 mb-1">
                          <Reply className="w-3 h-3 text-primary" />
                          <span className="text-xs font-medium text-primary">
                            {message.replyTo.senderNickname}에게 답장
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.replyTo.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {message.replyTo.text || '미디어 메시지'}
                        </p>
                      </div>
                    )}

                    {message.type === 'file' || message.type === 'image' ? (
                      <FileMessage message={message} />
                    ) : message.type === 'gif' && message.fileMeta ? (
                      <div className="bg-secondary/50 backdrop-blur-sm border border-border/50 rounded-2xl rounded-tl-sm p-2 shadow-sm hover:shadow-md transition-shadow">
                        <img
                          src={message.fileMeta.url}
                          alt="GIF"
                          className="max-w-xs max-h-48 rounded-lg object-contain"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="relative group/message">
                        <div className={cn(
                          "bg-secondary/80 text-foreground px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm hover:shadow-md transition-all duration-200",
                          "break-words overflow-hidden" // 오버플로우 수정
                        )}>
                          <p className="text-sm whitespace-pre-wrap break-all leading-relaxed">
                            {searchQuery ? (
                              <HighlightedText text={message.text || ''} query={searchQuery} />
                            ) : (
                              message.text
                            )}
                          </p>

                          {/* 수정됨 표시 */}
                          {message.isEdited && (
                            <span className="text-[10px] text-muted-foreground ml-2">
                              <Edit className="w-3 h-3 inline mr-1" />
                              수정됨
                            </span>
                          )}

                          {/* 링크 미리보기 */}
                          {message.linkPreviews && message.linkPreviews.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {message.linkPreviews.map((preview, idx) => (
                                <LinkPreviewCard key={idx} preview={preview} />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 메시지 반응 */}
                        {message.reactions && message.reactions.length > 0 && (
                          <MessageReactions
                            reactions={message.reactions}
                            onAddReaction={(emoji) => onAddReaction?.(message.id, emoji)}
                          />
                        )}

                        {/* 액션 메뉴 */}
                        <MessageActions
                          message={message}
                          isOwn={false}
                          onReply={onReply}
                          onAddReaction={(emoji) => onAddReaction?.(message.id, emoji)}
                        />
                      </div>
                    )}
                  </div>

                  {/* 타임스탬프 */}
                  <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap pb-0.5 flex-shrink-0">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 송신 메시지 */}
        {isOwn && (
          <div className="flex flex-col gap-1 items-end">
            {group.messages.map((message) => (
              <div key={message.id} className="flex items-end gap-1.5 justify-end max-w-full">
                {/* 상태 아이콘 */}
                <div className="flex-shrink-0">
                  {getStatusIcon(message.status)}
                </div>

                {/* 타임스탬프 */}
                <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap pb-0.5 flex-shrink-0">
                  {formatTime(message.timestamp)}
                </span>

                {/* 메시지 버블 */}
                <div className="max-w-[70%] min-w-0 flex-shrink">
                  {/* 답장일 경우 원본 메시지 표시 */}
                  {message.replyTo && (
                    <div className="mb-1 p-2 bg-primary/20 border-l-2 border-primary/70 rounded-md">
                      <div className="flex items-center gap-2 mb-1">
                        <Reply className="w-3 h-3 text-primary-foreground" />
                        <span className="text-xs font-medium text-primary-foreground">
                          {message.replyTo.senderNickname}에게 답장
                        </span>
                        <span className="text-xs text-primary-foreground/70">
                          {formatTime(message.replyTo.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-primary-foreground/70 truncate">
                        {message.replyTo.text || '미디어 메시지'}
                      </p>
                    </div>
                  )}

                  {message.type === 'file' || message.type === 'image' ? (
                    <FileMessage message={message} />
                  ) : message.type === 'gif' && message.fileMeta ? (
                    <div className="bg-primary/90 backdrop-blur-sm border border-primary/30 rounded-2xl rounded-br-sm p-2 shadow-sm hover:shadow-md transition-shadow">
                      <img
                        src={message.fileMeta.url}
                        alt="GIF"
                        className="max-w-xs max-h-48 rounded-lg object-contain"
                        loading="lazy"
                      />
                    </div>
                  ) : editingMessageId === message.id ? (
                    // 편집 모드
                    <div className="bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-sm shadow-sm">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-transparent border-none outline-none resize-none text-sm"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleEditSave(message.id)}
                          className="text-xs px-2 py-1 bg-primary-foreground/20 rounded hover:bg-primary-foreground/30"
                        >
                          저장
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="text-xs px-2 py-1 bg-primary-foreground/20 rounded hover:bg-primary-foreground/30"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group/message">
                      <div className={cn(
                        "bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-sm shadow-sm hover:shadow-md transition-all duration-200",
                        "break-words overflow-hidden" // 오버플로우 수정
                      )}>
                        <p className="text-sm whitespace-pre-wrap break-all leading-relaxed">
                          {searchQuery ? (
                            <HighlightedText text={message.text || ''} query={searchQuery} />
                          ) : (
                            message.text
                          )}
                        </p>

                        {/* 수정됨 표시 */}
                        {message.isEdited && (
                          <span className="text-[10px] text-primary-foreground/70 ml-2">
                            <Edit className="w-3 h-3 inline mr-1" />
                            수정됨
                          </span>
                        )}

                        {/* 링크 미리보기 */}
                        {message.linkPreviews && message.linkPreviews.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.linkPreviews.map((preview, idx) => (
                              <LinkPreviewCard key={idx} preview={preview} />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 메시지 반응 */}
                      {message.reactions && message.reactions.length > 0 && (
                        <MessageReactions
                          reactions={message.reactions}
                          onAddReaction={(emoji) => onAddReaction?.(message.id, emoji)}
                        />
                      )}

                      {/* 액션 메뉴 */}
                      <MessageActions
                        message={message}
                        isOwn={true}
                        onEdit={() => handleEditStart(message)}
                        onDelete={() => onDeleteMessage?.(message.id)}
                        onReply={onReply}
                        onAddReaction={(emoji) => onAddReaction?.(message.id, emoji)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    );
  }
);

ChatMessageGroup.displayName = 'ChatMessageGroup';
