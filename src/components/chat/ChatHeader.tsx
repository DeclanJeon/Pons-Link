/**
 * 채팅 패널 헤더 컴포넌트
 * @module ChatHeader
 */

import { Button } from '@/components/ui/button';
import { X, Search, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatHeaderProps {
  messageCount: number;
  searchMode: boolean;
  showOptions: boolean;
  onSearchToggle: () => void;
  onOptionsToggle: () => void;
  onClose: () => void;
}

export const ChatHeader = ({
  messageCount,
  searchMode,
  showOptions,
  onSearchToggle,
  onOptionsToggle,
  onClose
}: ChatHeaderProps) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-card/50">
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
            "transition-colors",
            searchMode && "bg-primary/10 text-primary"
          )}
        >
          <Search className="w-4 h-4" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onOptionsToggle}
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
        
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
