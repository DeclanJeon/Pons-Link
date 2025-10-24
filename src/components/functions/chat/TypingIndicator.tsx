/**
 * 타이핑 인디케이터 컴포넌트
 * @module TypingIndicator
 */

import { motion, AnimatePresence } from 'framer-motion';

interface TypingIndicatorProps {
  typingUsers: string[];
}

export const TypingIndicator = ({ typingUsers }: TypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="px-4 py-2 border-t border-border/20"
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[0, 0.2, 0.4].map((delay) => (
              <motion.span
                key={delay}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1, delay }}
                className="w-1.5 h-1.5 rounded-full bg-primary"
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {typingUsers.join(', ')}
            </span>
            {' '}{typingUsers.length > 1 ? 'are' : 'is'} typing...
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
