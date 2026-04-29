/**
 * 채팅 패널 헤더 컴포넌트 (전체화면 버튼 추가)
 * @module ChatHeader
 */

import { Button } from '@/components/ui/button';
import { X, Search, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHAT_MESSAGES } from '@/constants/chat.constants';

interface ChatHeaderProps {
  messageCount: number;
  searchMode: boolean;
  isFullscreen: boolean;
  onSearchToggle: () => void;
  onFullscreenToggle: () => void;
  onClose: () => void;
}

export const ChatHeader = ({
  messageCount,
  searchMode,
  isFullscreen,
  onSearchToggle,
  onFullscreenToggle,
  onClose
}: ChatHeaderProps) => {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0b0b10]/90 px-4 py-3 backdrop-blur-xl">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-200/70">PonsLink</p>
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-white">Chat</h3>
        </div>
        <span className="shrink-0 rounded-full border border-indigo-300/10 bg-indigo-300/10 px-2 py-0.5 text-[11px] font-medium text-indigo-100/80">
          {messageCount} messages
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSearchToggle}
          className={cn(
            "h-9 w-9 rounded-full p-0 text-zinc-300 transition-all duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300/50",
            searchMode && "bg-indigo-400/15 text-indigo-100"
          )}
          title="Search"
          aria-label="Search messages"
          aria-pressed={searchMode}
        >
          <Search className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onFullscreenToggle}
          className="h-9 w-9 rounded-full p-0 text-zinc-300 transition-all duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300/50"
          title={isFullscreen ? CHAT_MESSAGES.FULLSCREEN_EXIT : CHAT_MESSAGES.FULLSCREEN_ENTER}
          aria-label={isFullscreen ? CHAT_MESSAGES.FULLSCREEN_EXIT : CHAT_MESSAGES.FULLSCREEN_ENTER}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-9 w-9 rounded-full p-0 text-zinc-300 transition-all duration-200 hover:bg-red-500/10 hover:text-red-200 focus-visible:ring-2 focus-visible:ring-red-300/40"
          title="Close"
          aria-label="Close chat"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
