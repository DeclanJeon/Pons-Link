/**
 * 채팅 패널 메인 컴포넌트 (전체화면 기능 포함)
 * @module ChatPanel
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2 } from 'lucide-react';
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

export const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
  const { isMobile, isTablet } = useDeviceType();
  const [showOptions, setShowOptions] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previousWidth, setPreviousWidth] = useState(0);
  const [panelWidth, setPanelWidth] = useState(() =>
    isMobile ? window.innerWidth : (isTablet ? 400 : 320)
  );
  const [isResizing, setIsResizing] = useState(false);
  const [showNewMessageBanner, setShowNewMessageBanner] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null);

  const resizeRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const setChatPanelOpen = useChatStore(state => state.setChatPanelOpen);

  useEffect(() => {
    setChatPanelOpen(isOpen);
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
    getReplies,
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
    if (!isMobile && !isFullscreen) {
      setIsResizing(true);
    }
  }, [isMobile, isFullscreen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || isMobile || isFullscreen) return;

      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 300;
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
  }, [isResizing, isMobile, isFullscreen]);

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
    if (!isAtBottom && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.senderId !== userId) {
        setUnreadCount(prev => prev + 1);
        setShowNewMessageBanner(true);
      }
    }
  }, [messages, isAtBottom, userId]);

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
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={CHAT_CONSTANTS.SPRING_CONFIG}
        className={cn(
          "fixed top-0 h-full bg-card/95 backdrop-blur-xl border-l border-border/50 shadow-[var(--shadow-elegant)] z-50 flex flex-col right-0",
          isMobile && "w-full",
          isFullscreen && "w-full left-0 border-l-0"
        )}
        style={{ width: isMobile || isFullscreen ? '100vw' : panelWidth }}
      >
        <ChatHeader
          messageCount={messages.length}
          searchMode={searchMode}
          showOptions={showOptions}
          isFullscreen={isFullscreen}
          onSearchToggle={() => setSearchMode(!searchMode)}
          onOptionsToggle={() => setShowOptions(!showOptions)}
          onFullscreenToggle={toggleFullscreen}
          onClose={onClose}
        />

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
        {!isMobile && !isFullscreen && (
          <div
            ref={resizeRef}
            className="resize-handle absolute left-0 top-0 w-1 h-full cursor-col-resize transition-colors z-50 hover:bg-primary/50"
            onMouseDown={startResizing}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
