/**
 * 채팅 패널 메인 컴포넌트 (전체화면 기능 포함)
 * @module ChatPanel
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatHeader } from './ChatHeader';
import { ChatSearch } from './ChatSearch';
import { ChatMessageList } from './ChatMessageList';
import { TypingIndicator } from './TypingIndicator';
import { ChatInput } from './ChatInput';
import { NewMessageBanner } from './NewMessageBanner';
import { ReplyInput } from './ReplyInput';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatInput } from '@/hooks/useChatInput';
import { useTypingState } from '@/hooks/useTypingState';
import { ChatPanelProps } from '@/types/chat.types';
import { CHAT_CONSTANTS } from '@/constants/chat.constants';
import { useDeviceType } from '@/hooks/useDeviceType';
import { cn } from '@/lib/utils';
import { ChatMessage, useChatStore } from '@/stores/useChatStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { downloadMeetingMinutesMarkdown } from '@/lib/meetingMinutes';

export const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
  const deviceInfo = useDeviceType();
  const { isMobile, isTablet, width } = deviceInfo;
  const isCompact = isMobile || width < 768;
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previousWidth, setPreviousWidth] = useState(0);
  const [panelWidth, setPanelWidth] = useState(() =>
    isMobile ? window.innerWidth : (isTablet ? 460 : 440)
  );
  const [isResizing, setIsResizing] = useState(false);
  const [showNewMessageBanner, setShowNewMessageBanner] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);

  const resizeRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastSeenMessageIdRef = useRef<string | null>(null);

  const setChatPanelOpen = useChatStore(state => state.setChatPanelOpen);
  const {
    meetingMinutesEnabled,
    meetingMinutesConsent,
    meetingMinutesOwnerNickname,
    setMeetingMinutesEnabled,
    acceptMeetingMinutesConsent,
    declineMeetingMinutesConsent,
  } = useTranscriptionStore();

  useEffect(() => {
    setChatPanelOpen(isOpen);

    return () => {
      setChatPanelOpen(false);
    };
  }, [isOpen, setChatPanelOpen]);

  // Custom hooks
  const {
    messages,
    groupedMessages,
    sendMessage: sendMessageWithTimestamp,
    sendFileMessage,
    sendGifMessage,
    deleteMessage,
    editMessage,
    addReaction,
    replyToMessage,
    userId
  } = useChatMessages(searchQuery);

  const {
    message,
    setMessage,
    fileInputRef,
    handleSend,
    handleFileChange,
    handleAttachClick,
    handleSendGif
  } = useChatInput({
    userId,
    onSendMessage: sendMessageWithTimestamp,
    onSendGif: sendGifMessage,
    onFileSelect: sendFileMessage
  });

  const { typingUsers } = useTypingState(userId);
  const latestMessage = messages[messages.length - 1];
  const shouldAutoScroll = isAtBottom || latestMessage?.senderId === userId;
  const meetingMinutesMessages = messages.filter(message => message.source === 'meeting-minutes');
  const meetingMinutesConsentLabel = meetingMinutesConsent === 'pending'
    ? 'Action needed'
    : meetingMinutesConsent === 'declined'
      ? 'You are not recorded'
      : meetingMinutesConsent === 'granted'
        ? 'Your speech can be recorded'
        : 'Room recording active';

  const handleDownloadMeetingMinutes = useCallback(() => {
    downloadMeetingMinutesMarkdown(meetingMinutesMessages, 'PonsLink meeting');
  }, [meetingMinutesMessages]);

  const handleToggleMeetingMinutes = useCallback(() => {
    if (!meetingMinutesEnabled) {
      const confirmed = window.confirm(
        'Start meeting minutes?\n\nFinal speech from consenting participants will be saved into Chat. Participants should be notified that transcription records are active.'
      );
      if (!confirmed) return;
    }

    setMeetingMinutesEnabled(!meetingMinutesEnabled);
  }, [meetingMinutesEnabled, setMeetingMinutesEnabled]);

  useEffect(() => {
    if (!isCompact || isFullscreen) return;
    setPanelWidth(window.innerWidth);
  }, [isCompact, isFullscreen, width]);

  /**
   * 전체화면 토글
   */
  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      setPanelWidth(previousWidth);
      setIsFullscreen(false);
    } else {
      setPreviousWidth(panelWidth);
      setPanelWidth(window.innerWidth);
      setIsFullscreen(true);
    }
  }, [isFullscreen, panelWidth, previousWidth]);

  /**
   * 키보드 단축키
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11 또는 Ctrl+Shift+F로 전체화면 토글
      if (e.key === 'F11' || (e.ctrlKey && e.shiftKey && e.key === 'F')) {
        e.preventDefault();
        toggleFullscreen();
      }

      // ESC로 전체화면 종료
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, toggleFullscreen]);

  /**
   * 리사이즈 핸들러
   */
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!isCompact && !isFullscreen) {
      setIsResizing(true);
    }
  }, [isCompact, isFullscreen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || isCompact || isFullscreen) return;

      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 380;
      const maxWidth = Math.min(window.innerWidth * 0.8, 800);
      const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      setPanelWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isCompact, isFullscreen]);

  /**
   * 스크롤 감지
   */
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isBottom = target.scrollHeight - target.scrollTop - target.clientHeight < CHAT_CONSTANTS.SCROLL_THRESHOLD;
    setIsAtBottom(isBottom);

    if (isBottom) {
      setShowNewMessageBanner(false);
      setUnreadCount(0);
    }
  }, []);

  /**
   * 새 메시지 감지
   */
  useEffect(() => {
    if (!latestMessage) return;
    if (lastSeenMessageIdRef.current === latestMessage.id) return;

    const isFirstMessageSeen = lastSeenMessageIdRef.current === null;
    lastSeenMessageIdRef.current = latestMessage.id;

    if (isFirstMessageSeen) return;

    if (!isAtBottom && latestMessage.senderId !== userId) {
      setUnreadCount(prev => prev + 1);
      setShowNewMessageBanner(true);
    }
  }, [latestMessage, isAtBottom, userId]);

  /**
   * 최하단으로 스크롤
   */
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, []);

  /**
   * 새 메시지 배너 숨기기
   */
 const hideNewMessageBanner = useCallback(() => {
    setShowNewMessageBanner(false);
    setUnreadCount(0);
  }, [setShowNewMessageBanner, setUnreadCount]);

  /**
   * 답장 시작
   */
  const handleReply = useCallback((messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (message) {
      setReplyingToMessage(message);
      setShowReplyInput(true);
    }
  }, [messages]);

  /**
   * 답장 전송
   */
  const handleSendReply = useCallback((text: string) => {
    if (replyingToMessage) {
      replyToMessage(replyingToMessage.id, text);
      setShowReplyInput(false);
      setReplyingToMessage(null);
    }
  }, [replyingToMessage, replyToMessage]);

  /**
   * 답장 취소
   */
  const handleCancelReply = useCallback(() => {
    setShowReplyInput(false);
    setReplyingToMessage(null);
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="false"
        aria-label="Room chat panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={CHAT_CONSTANTS.SPRING_CONFIG}
        className={cn(
          "room-noir-panel room-soft-edge fixed right-0 top-0 z-50 flex h-[100dvh] max-h-[100dvh] flex-col border-l text-foreground",
          isCompact && "left-0 w-full border-l-0",
          isFullscreen && "w-full left-0 border-l-0"
        )}
        style={{ width: isCompact || isFullscreen ? '100vw' : panelWidth }}
      >
        <ChatHeader
          messageCount={messages.length}
          searchMode={searchMode}
          isFullscreen={isFullscreen}
          meetingMinutesCount={meetingMinutesMessages.length}
          meetingMinutesEnabled={meetingMinutesEnabled}
          onSearchToggle={() => setSearchMode(!searchMode)}
          onFullscreenToggle={toggleFullscreen}
          onToggleMeetingMinutes={handleToggleMeetingMinutes}
          onDownloadMeetingMinutes={handleDownloadMeetingMinutes}
          onClose={onClose}
        />

        {meetingMinutesEnabled && (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "border-b px-4 py-3 text-xs backdrop-blur-2xl",
              meetingMinutesConsent === 'pending'
                ? "border-amber-200/15 bg-[#1b1408]/95 text-amber-50"
                : meetingMinutesConsent === 'declined'
                  ? "border-zinc-200/10 bg-[#111116]/95 text-zinc-100"
                  : "border-rose-200/10 bg-[#170d11]/95 text-rose-50"
            )}
          >
            <div className="flex flex-col gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className={cn(
                  "relative mt-1 flex h-2.5 w-2.5 shrink-0",
                  meetingMinutesConsent === 'declined' && "opacity-50"
                )}>
                  {meetingMinutesConsent !== 'declined' && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" />
                  )}
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold tracking-[-0.01em]">Meeting minutes</span>
                    <span className="rounded-full border border-current/15 bg-current/[0.08] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em]">
                      {meetingMinutesConsentLabel}
                    </span>
                  </div>
                  {meetingMinutesOwnerNickname && (
                    <p className="mt-1 truncate opacity-65">Started by {meetingMinutesOwnerNickname}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pl-5">
                {meetingMinutesConsent === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={acceptMeetingMinutesConsent}
                      className="rounded-full border border-emerald-200/20 bg-emerald-300/15 px-3 py-1.5 text-[11px] font-bold text-emerald-50 transition-colors hover:bg-emerald-300/22 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/50"
                    >
                      Consent
                    </button>
                    <button
                      type="button"
                      onClick={declineMeetingMinutesConsent}
                      className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
                    >
                      Do not record me
                    </button>
                  </>
                )}
                {meetingMinutesConsent === 'granted' && (
                  <button
                    type="button"
                    onClick={declineMeetingMinutesConsent}
                    className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
                  >
                    Stop recording me
                  </button>
                )}
                {meetingMinutesConsent === 'declined' && (
                  <button
                    type="button"
                    onClick={acceptMeetingMinutesConsent}
                    className="rounded-full border border-emerald-200/20 bg-emerald-300/12 px-3 py-1.5 text-[11px] font-bold text-emerald-50 transition-colors hover:bg-emerald-300/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/50"
                  >
                    Join record
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMeetingMinutesEnabled(false)}
                  className="rounded-full border border-current/15 bg-transparent px-3 py-1.5 text-[11px] font-bold opacity-80 transition-colors hover:bg-current/[0.08] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/40"
                >
                  Stop all
                </button>
              </div>

              <p className="pl-5 leading-relaxed opacity-68">
                {meetingMinutesConsent === 'pending'
                  ? 'Choose whether your speech can be saved. Live Caption remains independent.'
                  : meetingMinutesConsent === 'declined'
                    ? 'Your speech is not saved. Other consenting participants may still be recorded.'
                    : 'Final speech from consenting participants is saved into Chat. Live Caption remains independent.'}
              </p>
            </div>
          </div>
        )}

        <ChatSearch
          isVisible={searchMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="relative flex-1 flex flex-col min-h-0">
          <ChatMessageList
            ref={scrollAreaRef}
            groups={groupedMessages}
            currentUserId={userId}
            searchQuery={searchQuery}
            shouldAutoScroll={shouldAutoScroll}
            onScroll={handleScroll}
            onDeleteMessage={deleteMessage}
            onEditMessage={editMessage}
            onAddReaction={addReaction}
            onReply={handleReply}
          />

          <NewMessageBanner
            isVisible={showNewMessageBanner && !isAtBottom}
            unreadCount={unreadCount}
            onScrollToBottom={scrollToBottom}
            onHideBanner={hideNewMessageBanner}
          />
        </div>

        <TypingIndicator typingUsers={typingUsers} />

        <ReplyInput
          isVisible={showReplyInput}
          parentMessage={replyingToMessage}
          onCancel={handleCancelReply}
          onSend={handleSendReply}
        />

        {!showReplyInput && (
          <ChatInput
            message={message}
            setMessage={setMessage}
            fileInputRef={fileInputRef}
            onSend={handleSend}
            onSendGif={handleSendGif}
            onFileChange={handleFileChange}
            onAttachClick={handleAttachClick}
          />
        )}

        {/* Resize handle */}
        {!isCompact && !isFullscreen && (
          <div
            ref={resizeRef}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat panel"
            className="resize-handle absolute left-0 top-0 w-1 h-full cursor-col-resize transition-colors z-50 hover:bg-primary/50 focus-visible:bg-primary/60"
            onMouseDown={startResizing}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
