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
            className="absolute -top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover/message:opacity-100 transition-opacity bg-card shadow-md hover:bg-accent"
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