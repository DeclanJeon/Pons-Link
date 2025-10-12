/**
 * 채팅 입력 컴포넌트
 * @module ChatInput
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Paperclip, Smile } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHAT_MESSAGES } from '@/constants/chat.constants';
import { RefObject } from 'react';

interface ChatInputProps {
  message: string;
  inputRef: RefObject<HTMLInputElement>;
  fileInputRef: RefObject<HTMLInputElement>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachClick: () => void;
}

export const ChatInput = ({
  message,
  inputRef,
  fileInputRef,
  onInputChange,
  onKeyPress,
  onSend,
  onFileChange,
  onAttachClick
}: ChatInputProps) => {
  return (
    <div className="p-4 border-t border-border/30 bg-card/30">
      <div className="flex items-end gap-2">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={onFileChange} 
          className="hidden" 
        />
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onAttachClick}
          className="h-10 px-3 hover:bg-primary/10 hover:text-primary transition-colors"
          title={CHAT_MESSAGES.ATTACH_TITLE}
        >
          <Paperclip className="w-4 h-4" />
        </Button>

        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={message}
            onChange={onInputChange}
            onKeyPress={onKeyPress}
            placeholder={CHAT_MESSAGES.INPUT_PLACEHOLDER}
            className="h-10 pr-10 bg-input/50 border-border/50 focus:border-primary/50 transition-colors"
          />
          
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
            onClick={() => {/* TODO: 이모지 피커 */}}
          >
            <Smile className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
          </Button>
        </div>

        <Button 
          onClick={onSend} 
          disabled={!message.trim()}
          size="sm"
          className={cn(
            "h-10 px-4 transition-all duration-200",
            message.trim() 
              ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25" 
              : "bg-muted"
          )}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        {CHAT_MESSAGES.KEYBOARD_HINT}
      </p>
    </div>
  );
};
