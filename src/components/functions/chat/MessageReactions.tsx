/**
 * 메시지 반응 컴포넌트
 * @module MessageReactions
 */

import { Button } from '@/components/ui/button';
import { SmilePlus } from 'lucide-react';
import { MessageReaction } from '@/types/chat.types';
import { useState } from 'react';
import { EmojiPicker } from './EmojiPicker';

interface MessageReactionsProps {
  reactions: MessageReaction[];
  onAddReaction: (emoji: string) => void;
}

export const MessageReactions = ({ reactions, onAddReaction }: MessageReactionsProps) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs hover:bg-primary/10 transition-colors"
          onClick={() => onAddReaction(reaction.emoji)}
        >
          <span className="mr-1">{reaction.emoji}</span>
          <span className="text-muted-foreground">{reaction.count}</span>
        </Button>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-primary/10 transition-colors"
        onClick={() => setShowEmojiPicker(true)}
      >
        <SmilePlus className="w-3 h-3" />
      </Button>

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
    </div>
  );
};