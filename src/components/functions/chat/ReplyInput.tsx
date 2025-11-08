/**
 * 답장 입력 컴포넌트
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
    <div className="border-t border-border/30 bg-card/50 backdrop-blur-sm p-3">
      {/* 답장 대상 메시지 표시 */}
      <div className="flex items-center gap-2 mb-2 p-2 bg-secondary/30 rounded-lg">
        <Reply className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              {parentMessage.senderNickname}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(parentMessage.timestamp)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {parentMessage.text || '미디어 메시지'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-6 w-6 p-0"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>

      {/* 답장 입력창 */}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="답장을 입력하세요..."
          className="flex-1 resize-none bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent"
          rows={2}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim()}
          size="sm"
          className="px-4"
        >
          답장
        </Button>
      </div>
    </div>
  );
};