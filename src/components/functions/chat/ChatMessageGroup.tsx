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
          return <Clock className="w-3 h-3 text-zinc-500" />;
        case 'sent':
          return <CheckCheck className="w-3 h-3 text-indigo-300" />;
        case 'failed':
          return <AlertCircle className="w-3 h-3 text-destructive" />;
        default:
          return <Check className="w-3 h-3 text-zinc-500" />;
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
        className="group w-full px-3 py-2"
      >
        {/* 수신 메시지 */}
        {!isOwn && (
          <div className="flex gap-2 items-start">
            {/* 아바타 */}
            <div className="flex-shrink-0 w-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-200/15 bg-gradient-to-br from-indigo-300/20 to-teal-300/10 text-sm font-bold text-indigo-100">
                {group.messages[0].senderNickname[0].toUpperCase()}
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              {/* 닉네임 */}
              <div className="px-1 text-xs font-semibold text-zinc-200/90">
                {group.messages[0].senderNickname}
              </div>

              {/* 메시지 리스트 */}
              {group.messages.map((message) => (
                <div key={message.id} className="flex items-end gap-1.5">
                  {/* 메시지 버블 */}
                  <div className="max-w-[78%] min-w-0 flex-shrink sm:max-w-[72%]">
                    {/* 답장일 경우 원본 메시지 표시 */}
                    {message.replyTo && (
                      <div className="mb-1 rounded-lg border-l-2 border-indigo-300/50 bg-indigo-300/10 p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Reply className="w-3 h-3 text-indigo-200" />
                          <span className="text-xs font-medium text-indigo-100">
                            Replying to {message.replyTo.senderNickname}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {formatTime(message.replyTo.timestamp)}
                          </span>
                        </div>
                        <p className="truncate text-xs text-zinc-400">
                          {message.replyTo.text || 'Media message'}
                        </p>
                      </div>
                    )}

                    {message.type === 'file' || message.type === 'image' ? (
                      <FileMessage message={message} />
                    ) : message.type === 'gif' && message.fileMeta ? (
                      <div className="rounded-2xl rounded-tl-sm border border-white/[0.08] bg-white/[0.075] p-2 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
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
                          "rounded-2xl rounded-tl-sm border border-white/[0.08] bg-white/[0.075] px-4 py-2.5 text-zinc-100 shadow-sm transition-all duration-200 hover:bg-white/[0.095] hover:shadow-md",
                          "break-words overflow-hidden"
                        )}>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                            {searchQuery ? (
                              <HighlightedText text={message.text || ''} query={searchQuery} />
                            ) : (
                              message.text
                            )}
                          </p>

                          {/* Edited 표시 */}
                          {message.isEdited && (
                            <span className="ml-2 text-[10px] text-zinc-500">
                              <Edit className="w-3 h-3 inline mr-1" />
                              Edited
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
                  <span className="flex-shrink-0 whitespace-nowrap pb-0.5 text-[10px] text-zinc-500">
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
                <span className="flex-shrink-0 whitespace-nowrap pb-0.5 text-[10px] text-zinc-500">
                  {formatTime(message.timestamp)}
                </span>

                {/* 메시지 버블 */}
                <div className="max-w-[82%] min-w-0 flex-shrink sm:max-w-[74%]">
                  {/* 답장일 경우 원본 메시지 표시 */}
                  {message.replyTo && (
                    <div className="mb-1 rounded-lg border-l-2 border-indigo-100/70 bg-white/10 p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Reply className="w-3 h-3 text-white" />
                        <span className="text-xs font-medium text-white">
                          Replying to {message.replyTo.senderNickname}
                        </span>
                        <span className="text-xs text-indigo-100/70">
                          {formatTime(message.replyTo.timestamp)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-indigo-100/75">
                        {message.replyTo.text || 'Media message'}
                      </p>
                    </div>
                  )}

                  {message.type === 'file' || message.type === 'image' ? (
                    <FileMessage message={message} />
                  ) : message.type === 'gif' && message.fileMeta ? (
                    <div className="rounded-2xl rounded-br-sm border border-indigo-200/20 bg-indigo-500/90 p-2 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
                      <img
                        src={message.fileMeta.url}
                        alt="GIF"
                        className="max-w-xs max-h-48 rounded-lg object-contain"
                        loading="lazy"
                      />
                    </div>
                  ) : editingMessageId === message.id ? (
                    // 편집 모드
                    <div className="rounded-2xl rounded-br-sm border border-indigo-200/20 bg-indigo-500 px-4 py-2.5 text-white shadow-sm">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full resize-none border-none bg-transparent text-sm outline-none"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleEditSave(message.id)}
                          className="rounded bg-white/20 px-2 py-1 text-xs hover:bg-white/30"
                        >
                          저장
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="rounded bg-white/20 px-2 py-1 text-xs hover:bg-white/30"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group/message">
                      <div className={cn(
                        "rounded-2xl rounded-br-sm border border-indigo-200/20 bg-indigo-500 px-4 py-2.5 text-white shadow-sm transition-all duration-200 hover:bg-indigo-400 hover:shadow-md",
                        "break-words overflow-hidden"
                      )}>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">
                          {searchQuery ? (
                            <HighlightedText text={message.text || ''} query={searchQuery} />
                          ) : (
                            message.text
                          )}
                        </p>

                        {/* Edited 표시 */}
                        {message.isEdited && (
                          <span className="ml-2 text-[10px] text-indigo-100/70">
                            <Edit className="w-3 h-3 inline mr-1" />
                            Edited
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
