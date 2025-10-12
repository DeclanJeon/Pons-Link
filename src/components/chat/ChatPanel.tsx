/**
 * 채팅 패널 메인 컴포넌트 - UI 조합만 담당
 * @module ChatPanel
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatHeader } from './ChatHeader';
import { ChatSearch } from './ChatSearch';
import { ChatMessageList } from './ChatMessageList';
import { TypingIndicator } from './TypingIndicator';
import { ChatInput } from './ChatInput';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatInput } from '@/hooks/useChatInput';
import { useTypingState } from '@/hooks/useTypingState';
import { ChatPanelProps } from '@/types/chat.types';
import { CHAT_CONSTANTS } from '@/constants/chat.constants';

export const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
  const [showOptions, setShowOptions] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [panelWidth, setPanelWidth] = useState(320); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and on resize
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  // Custom hooks로 로직 분리

  // Custom hooks로 로직 분리
  const {
    messages,
    groupedMessages,
    sendMessage: sendMessageWithTimestamp,
    sendFileMessage,
    sendGifMessage,
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

  // Resize handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!isMobile) {
      setIsResizing(true);
    }
  }, [isMobile]);

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || isMobile) return;
      
      // Calculate new width based on mouse position relative to the left edge of the panel
      const newWidth = window.innerWidth - e.clientX;
      
      // Set width constraints (min: 300px, max: 80% of screen width)
      const minWidth = 300;
      const maxWidth = Math.min(window.innerWidth * 0.8, 500);
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
  }, [isResizing, isMobile]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: isMobile ? '100%' : '100%' }}
        animate={{ x: isMobile ? 0 : 0 }}
        exit={{ x: isMobile ? '100%' : '100%' }}
        transition={CHAT_CONSTANTS.SPRING_CONFIG}
        className={`fixed top-0 h-full bg-card/95 backdrop-blur-xl border-l border-border/50 shadow-[var(--shadow-elegant)] z-50 flex flex-col ${
          isMobile ? 'right-0 w-full' : 'right-0'
        }`}
        style={{ width: isMobile ? '100vw' : panelWidth }}
      >
        <ChatHeader
          messageCount={messages.length}
          searchMode={searchMode}
          showOptions={showOptions}
          onSearchToggle={() => setSearchMode(!searchMode)}
          onOptionsToggle={() => setShowOptions(!showOptions)}
          onClose={onClose}
        />

        <ChatSearch
          isVisible={searchMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <ChatMessageList
          groups={groupedMessages}
          currentUserId={userId}
        />

        <TypingIndicator typingUsers={typingUsers} />

        <ChatInput
          message={message}
          setMessage={setMessage}
          fileInputRef={fileInputRef}
          onSend={handleSend}
          onSendGif={handleSendGif}
          onFileChange={handleFileChange}
          onAttachClick={handleAttachClick}
        />

        {/* Resize handle - hidden on mobile */}
        {!isMobile && (
          <div
            ref={resizeRef}
            className="resize-handle absolute left-0 top-0 w-1 h-full cursor-col-resize transition-colors z-50"
            onMouseDown={startResizing}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
