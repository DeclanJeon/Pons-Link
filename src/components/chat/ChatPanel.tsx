/**
 * 채팅 패널 메인 컴포넌트 - UI 조합만 담당
 * @module ChatPanel
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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

  // Custom hooks로 로직 분리
  const { 
    messages, 
    groupedMessages, 
    sendMessage, 
    sendFileMessage, 
    userId 
  } = useChatMessages(searchQuery);

  const {
    message,
    inputRef,
    fileInputRef,
    handleInputChange,
    handleKeyPress,
    handleSend,
    handleFileChange,
    handleAttachClick
  } = useChatInput({
    userId,
    onSendMessage: sendMessage,
    onFileSelect: sendFileMessage
  });

  const { typingUsers } = useTypingState(userId);

  // 패널 열릴 때 포커스
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), CHAT_CONSTANTS.FOCUS_DELAY);
    }
  }, [isOpen, inputRef]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: 320 }}
      animate={{ x: 0 }}
      exit={{ x: 320 }}
      transition={CHAT_CONSTANTS.SPRING_CONFIG}
      className={`fixed right-0 top-0 h-full ${CHAT_CONSTANTS.PANEL_WIDTH} bg-card/95 backdrop-blur-xl border-l border-border/50 shadow-[var(--shadow-elegant)] z-40 flex flex-col`}
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
        inputRef={inputRef}
        fileInputRef={fileInputRef}
        onInputChange={handleInputChange}
        onKeyPress={handleKeyPress}
        onSend={handleSend}
        onFileChange={handleFileChange}
        onAttachClick={handleAttachClick}
      />
    </motion.div>
  );
};
