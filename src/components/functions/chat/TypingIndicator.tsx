/**
 * 타이핑 인디케이터 컴포넌트 (개선)
 * @module TypingIndicator
 */

import { motion, AnimatePresence } from 'framer-motion';
import { CHAT_MESSAGES } from '@/constants/chat.constants';

interface TypingIndicatorProps {
  typingUsers: string[];
}

export const TypingIndicator = ({ typingUsers }: TypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;

  const displayText = typingUsers.length === 1
    ? CHAT_MESSAGES.TYPING_SINGLE(typingUsers[0])
    : CHAT_MESSAGES.TYPING_MULTIPLE(typingUsers[0], typingUsers.length - 1);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="border-t border-white/[0.08] bg-[#0b0b10]/88 px-4 py-3 backdrop-blur-xl"
      >
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[0, 0.2, 0.4].map((delay) => (
              <motion.span
                key={delay}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.2,
                  delay,
                  ease: "easeInOut"
                }}
                className="h-2 w-2 rounded-full bg-indigo-300"
              />
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-200">
              {displayText}
            </span>
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
