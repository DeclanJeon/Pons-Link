/**
 * Reply 입력 컴포넌트
 * @module ReplyInput
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Reply } from 'lucide-react';
import { ChatMessage } from '@/types/chat.types';
import { formatTime } from '@/utils/chat.utils';

interface ReplyInputProps {
  isVisible: boolean;
  parentMessage: ChatMessage | null;
  onCancel: () => void;
  onSend: (text: string) => void;
}

export const ReplyInput = ({ isVisible, parentMessage, onCancel, onSend }: ReplyInputProps) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isVisible && textareaRef.current) {
      textareaRef.current.focus();
      setMessage(''); // 초기화
    }
  }, [isVisible]);

  const handleSend = () => {
    if (message.trim() && parentMessage) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isVisible || !parentMessage) return null;

  return (
    <div className="border-t border-white/[0.08] bg-[#0b0b10]/92 p-3 backdrop-blur-xl">
      {/* Reply 대상 메시지 표시 */}
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-indigo-300/10 bg-indigo-300/10 p-2">
        <Reply className="w-4 h-4 text-indigo-200" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-100">
              {parentMessage.senderNickname}
            </span>
            <span className="text-xs text-zinc-500">
              {formatTime(parentMessage.timestamp)}
            </span>
          </div>
          <p className="truncate text-sm text-zinc-400">
            {parentMessage.text || 'Media message'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 w-7 rounded-full p-0 text-zinc-400 hover:bg-white/[0.08] hover:text-white"
          aria-label="Cancel reply"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* Reply 입력창 */}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your reply..."
          className="flex-1 resize-none rounded-xl border border-white/[0.10] bg-white/[0.055] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-300/45 focus:outline-none focus:ring-2 focus:ring-indigo-300/15"
          rows={2}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim()}
          size="sm"
          className="rounded-xl bg-indigo-500 px-4 text-white hover:bg-indigo-400 disabled:bg-white/[0.055] disabled:text-zinc-600"
        >
          Reply
        </Button>
      </div>
    </div>
  );
};
