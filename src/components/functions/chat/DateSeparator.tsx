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
      className="my-4 flex items-center gap-3 px-4"
    >
      <div className="h-px flex-1 bg-white/[0.08]" />
      <span className="rounded-full border border-white/[0.08] bg-white/[0.055] px-3 py-1 text-xs font-medium text-zinc-400 shadow-sm backdrop-blur-sm">
        {date}
      </span>
      <div className="h-px flex-1 bg-white/[0.08]" />
    </motion.div>
  );
};
