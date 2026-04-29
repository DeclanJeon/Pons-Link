/**
 * 메시지 액션 메뉴 컴포넌트
 * @module MessageActions
 */

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Reply, Edit, Trash, SmilePlus } from 'lucide-react';
import { ChatMessage } from '@/types/chat.types';
import { useState } from 'react';
import { EmojiPicker } from './EmojiPicker';
import { cn } from '@/lib/utils';

interface MessageActionsProps {
  message: ChatMessage;
  isOwn: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onReply?: (messageId: string) => void;
  onAddReaction: (emoji: string) => void;
}

export const MessageActions = ({
  message,
  isOwn,
  onEdit,
  onDelete,
  onReply,
  onAddReaction
}: MessageActionsProps) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border border-white/[0.08] bg-[#121218]/95 p-0 text-zinc-300 opacity-100 shadow-lg transition-all hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-indigo-300/50 sm:opacity-0 sm:group-hover/message:opacity-100 sm:group-focus-within/message:opacity-100",
              isOwn ? "-left-12" : "-right-12"
            )}
            aria-label="Open message actions"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setShowEmojiPicker(true)}>
            <SmilePlus className="w-4 h-4 mr-2" />
            Add reaction
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onReply?.(message.id)}>
            <Reply className="w-4 h-4 mr-2" />
            Reply
          </DropdownMenuItem>
          {isOwn && onEdit && (
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {isOwn && onDelete && (
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={(emoji) => {
            onAddReaction(emoji);
            setShowEmojiPicker(false);
          }}
          onClose={() => setShowEmojiPicker(false)}
          position={{ bottom: 30, right: 0 }}
        />
      )}
    </>
  );
};
