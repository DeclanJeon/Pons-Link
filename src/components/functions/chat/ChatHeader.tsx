/**
 * 채팅 패널 헤더 컴포넌트 (전체화면 버튼 추가)
 * @module ChatHeader
 */

import { Button } from '@/components/ui/button';
import { X, Search, MoreVertical, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHAT_MESSAGES } from '@/constants/chat.constants';

interface ChatHeaderProps {
  messageCount: number;
  searchMode: boolean;
  showOptions: boolean;
  isFullscreen: boolean;
  onSearchToggle: () => void;
  onOptionsToggle: () => void;
  onFullscreenToggle: () => void;
  onClose: () => void;
}

export const ChatHeader = ({
  messageCount,
  searchMode,
  showOptions,
  isFullscreen,
  onSearchToggle,
  onOptionsToggle,
  onFullscreenToggle,
  onClose
}: ChatHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3 flex-1">
        <h3 className="font-semibold text-foreground">Chat</h3>
        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-primary/10">
          {messageCount} messages
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSearchToggle}
          className={cn(
            "h-8 w-8 p-0 transition-all duration-200",
            searchMode && "bg-primary/10 text-primary"
          )}
          title="Search"
        >
          <Search className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onFullscreenToggle}
          className="h-8 w-8 p-0 transition-all duration-200 hover:bg-primary/10"
          title={isFullscreen ? CHAT_MESSAGES.FULLSCREEN_EXIT : CHAT_MESSAGES.FULLSCREEN_ENTER}
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
          onClick={onOptionsToggle}
          className="h-8 w-8 p-0 transition-all duration-200 hover:bg-primary/10"
          title="Options"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
          title="Close"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
