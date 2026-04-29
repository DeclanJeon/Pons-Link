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
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => (
        <Button
          key={reaction.emoji}
          variant="ghost"
          size="sm"
          className="h-6 rounded-full border border-white/[0.08] bg-white/[0.045] px-2 text-xs text-zinc-200 transition-colors hover:bg-white/[0.08]"
          onClick={() => onAddReaction(reaction.emoji)}
        >
          <span className="mr-1">{reaction.emoji}</span>
          <span className="text-zinc-500">{reaction.count}</span>
        </Button>
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 rounded-full p-0 text-zinc-400 transition-colors hover:bg-white/[0.08] hover:text-white"
        aria-label="Add reaction"
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
