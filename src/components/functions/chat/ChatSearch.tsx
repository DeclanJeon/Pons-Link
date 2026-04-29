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
          className="overflow-hidden border-b border-white/[0.08] bg-[#0b0b10]/80"
        >
          <div className="p-3">
            <Input
              placeholder={CHAT_MESSAGES.SEARCH_PLACEHOLDER}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 rounded-xl border-white/[0.10] bg-white/[0.055] text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-indigo-300/50"
              autoFocus
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
