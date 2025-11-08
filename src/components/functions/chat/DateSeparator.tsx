/**
 * 날짜 구분선 컴포넌트
 * @module DateSeparator
 */

import { motion } from 'framer-motion';

interface DateSeparatorProps {
  date: string;
}

export const DateSeparator = ({ date }: DateSeparatorProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 my-4 px-4"
    >
      <div className="flex-1 h-px bg-border/30" />
      <span className="text-xs font-medium text-muted-foreground bg-card/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/30 shadow-sm">
        {date}
      </span>
      <div className="flex-1 h-px bg-border/30" />
    </motion.div>
  );
};