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

    const getMeetingMinutesProviderLabel = (provider?: NonNullable<ChatMessage['meetingMinutes']>['provider']) => {
      switch (provider) {
        case 'azure':
          return 'Azure STT';
        case 'deepgram':
          return 'Deepgram STT';
        case 'browser':
          return 'Browser STT';
        default:
          return 'Live speech';
      }
    };

    const renderMeetingMinutesBadge = (message: ChatMessage) => {
      if (message.source !== 'meeting-minutes') return null;

      return (
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-emerald-200/20 bg-emerald-300/12 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
            Minutes
          </span>
          <span className="text-[10px] font-medium text-zinc-400">
            Final speech record
          </span>
        </div>
      );
    };

    const renderMeetingMinutesMeta = (message: ChatMessage) => {
      if (message.source !== 'meeting-minutes') return null;

      return (
        <div className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          {getMeetingMinutesProviderLabel(message.meetingMinutes?.provider)}
        </div>
      );
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
        className="group w-full px-3 py-1.5"
      >
        {/* 수신 메시지 */}
        {!isOwn && (
          <div className="flex gap-2 items-start">
            {/* 아바타 */}
            <div className="flex-shrink-0 w-9">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.06] text-sm font-bold text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                {group.messages[0].senderNickname[0].toUpperCase()}
              </div>
            </div>

            {/* 메시지 영역 */}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              {/* 닉네임 */}
              <div className="px-1 text-xs font-semibold tracking-[-0.01em] text-zinc-300">
                {group.messages[0].senderNickname}
              </div>

              {/* 메시지 리스트 */}
              {group.messages.map((message) => {
                const isMeetingMinutes = message.source === 'meeting-minutes';

                return (
                <div key={message.id} className="flex items-end gap-1.5">
                  {/* 메시지 버블 */}
                  <div className="max-w-[82%] min-w-0 flex-shrink sm:max-w-[76%]">
                    {/* 답장일 경우 원본 메시지 표시 */}
                    {message.replyTo && (
                      <div className="mb-1 rounded-2xl border-l-2 border-emerald-300/45 bg-white/[0.045] p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Reply className="w-3 h-3 text-emerald-200" />
                          <span className="text-xs font-medium text-zinc-200">
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
                      <div className="rounded-[22px] rounded-tl-md border border-white/[0.08] bg-white/[0.075] p-2 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
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
                          "rounded-[22px] rounded-tl-md border border-white/[0.08] bg-white/[0.07] px-4 py-2.5 text-zinc-100 shadow-sm transition-all duration-200 hover:bg-white/[0.09]",
                          "break-words overflow-hidden",
                          isMeetingMinutes && "border-emerald-200/20 bg-[#102018]/92 hover:bg-[#13261c]"
                        )}>
                          {renderMeetingMinutesBadge(message)}
                          <p className="whitespace-pre-wrap text-[14px] leading-[1.62] tracking-[-0.005em] [overflow-wrap:anywhere]">
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
                          {renderMeetingMinutesMeta(message)}

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
                );
              })}
            </div>
          </div>
        )}

        {/* 송신 메시지 */}
        {isOwn && (
          <div className="flex flex-col gap-1 items-end">
            {group.messages.map((message) => {
              const isMeetingMinutes = message.source === 'meeting-minutes';

              return (
              <div key={message.id} className="flex items-end gap-1.5 justify-end max-w-full">
                {/* 타임스탬프 */}
                <span className="flex-shrink-0 whitespace-nowrap pb-0.5 text-[10px] text-zinc-500">
                  {formatTime(message.timestamp)}
                </span>

                {/* 메시지 버블 */}
                <div className="max-w-[82%] min-w-0 flex-shrink sm:max-w-[74%]">
                  {/* 답장일 경우 원본 메시지 표시 */}
                  {message.replyTo && (
                      <div className="mb-1 rounded-2xl border-l-2 border-emerald-100/70 bg-white/10 p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Reply className="w-3 h-3 text-emerald-50" />
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
                    <div className="rounded-[22px] rounded-br-md border border-emerald-100/20 bg-emerald-300/90 p-2 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md">
                      <img
                        src={message.fileMeta.url}
                        alt="GIF"
                        className="max-w-xs max-h-48 rounded-lg object-contain"
                        loading="lazy"
                      />
                    </div>
                  ) : editingMessageId === message.id ? (
                    // 편집 모드
                    <div className="rounded-[22px] rounded-br-md border border-emerald-100/20 bg-emerald-300 px-4 py-2.5 text-[#07140e] shadow-sm">
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
                        "rounded-[22px] rounded-br-md border border-emerald-100/20 bg-emerald-300 px-4 py-2.5 text-[#07140e] shadow-sm transition-all duration-200 hover:bg-emerald-200",
                        "break-words overflow-hidden",
                        isMeetingMinutes && "border-emerald-200/25 bg-[#142018] text-emerald-50 hover:bg-[#18261d]"
                      )}>
                        {renderMeetingMinutesBadge(message)}
                        <p className="whitespace-pre-wrap text-[14px] leading-[1.62] tracking-[-0.005em] [overflow-wrap:anywhere]">
                          {searchQuery ? (
                            <HighlightedText text={message.text || ''} query={searchQuery} />
                          ) : (
                            message.text
                          )}
                        </p>

                        {/* Edited 표시 */}
                        {message.isEdited && (
                          <span className="ml-2 text-[10px] opacity-65">
                            <Edit className="w-3 h-3 inline mr-1" />
                            Edited
                          </span>
                        )}
                        {renderMeetingMinutesMeta(message)}

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
                        onEdit={isMeetingMinutes ? undefined : () => handleEditStart(message)}
                        onDelete={isMeetingMinutes ? undefined : () => onDeleteMessage?.(message.id)}
                        onReply={onReply}
                        onAddReaction={(emoji) => onAddReaction?.(message.id, emoji)}
                      />
                    </div>
                  )}
                </div>
                {/* 상태 아이콘 */}
                <div className="flex-shrink-0 pb-0.5">
                  {getStatusIcon(message.status)}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </motion.div>
    );
  }
);

ChatMessageGroup.displayName = 'ChatMessageGroup';
