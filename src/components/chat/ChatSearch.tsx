/**
 * 채팅 검색 컴포넌트
 * @module ChatSearch
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { CHAT_MESSAGES } from '@/constants/chat.constants';

interface ChatSearchProps {
  isVisible: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const ChatSearch = ({ isVisible, searchQuery, onSearchChange }: ChatSearchProps) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-b border-border/30 overflow-hidden"
        >
          <div className="p-3">
            <Input
              placeholder={CHAT_MESSAGES.SEARCH_PLACEHOLDER}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 bg-input/50 border-border/50"
              autoFocus
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
