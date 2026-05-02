/**
 * 채팅 입력 컴포넌트 - 시각적 피드백 강화 및 UI 개선
 * @module ChatInput
 * 
 * 개선 사항:
 * - 전송 버튼 시각적 피드백 강화 (호버/활성 상태)
 * - 입력창 라운드 디자인 적용 (rounded-xl)
 * - 이모지/GIF 버튼 호버 효과 개선
 * - 플레이스홀더 위치 최적화
 * - 파일 첨부 버튼 애니메이션 추가
 */

import { Button } from '@/components/ui/button';
import { Send, Paperclip, Smile, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHAT_MESSAGES } from '@/constants/chat.constants';
import { RefObject, useState, useRef, useCallback, KeyboardEvent, useEffect } from 'react';
import { EmojiPicker } from './EmojiPicker';
import { GifPicker } from './GifPicker';

interface ChatInputProps {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  fileInputRef: RefObject<HTMLInputElement>;
  onSend: () => void;
  onSendGif: (gifUrl: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAttachClick: () => void;
}

/**
 * 채팅 메시지 입력 컴포넌트
 * - 스크롤 기능은 유지하되 스크롤바 UI는 숨김 처리
 * - 인지 과학 기반 UI/UX 원칙 적용
 */
export const ChatInput = ({
  message,
  setMessage,
  fileInputRef,
  onSend,
  onSendGif,
  onFileChange,
  onAttachClick,
}: ChatInputProps) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ bottom: 0, right: 0 });
  const [gifPickerPosition, setGifPickerPosition] = useState({ bottom: 0, right: 0 });
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const gifButtonRef = useRef<HTMLButtonElement>(null);
  const fileButtonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 파일 input
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  
  /**
   * 메시지 내용이 실제로 비어있는지 검증
   */
  const isMessageEmpty = useCallback((text: string): boolean => {
    return text.trim().length === 0;
  }, []);
  
  /**
   * 메시지 전송 핸들러
   */
  const handleSend = useCallback(() => {
    if (!isMessageEmpty(message)) {
      onSend();
      // 전송 후 포커스 복원
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }, [message, onSend, isMessageEmpty]);
  
  /**
   * Textarea 입력 핸들러
   */
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  }, [setMessage]);
  
  /**
   * 키보드 이벤트 핸들러
   * Enter: 전송, Shift+Enter: 줄바꿈
   */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);
  
  /**
   * 🔧 AUTO-RESIZE: Textarea 높이 자동 조절
   * 내용에 따라 높이를 동적으로 조정하되 최대 높이 제한
   */
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // 높이 초기화 후 재계산
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 200; // max-h-[200px]와 동일
      
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [message]);
  
  /**
   * 이모지 삽입 핸들러
   * 커서 위치에 정확히 삽입
   */
  const handleEmojiSelect = useCallback((emoji: string) => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = message;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      
      setMessage(newText);
      
      // 커서를 이모지 뒤로 이동
      setTimeout(() => {
        if (textareaRef.current) {
          const newPosition = start + emoji.length;
          textareaRef.current.selectionStart = newPosition;
          textareaRef.current.selectionEnd = newPosition;
          textareaRef.current.focus();
        }
      }, 0);
    }
    setShowEmojiPicker(false);
  }, [message, setMessage]);
  
  /**
   * GIF 선택 핸들러
   */
  const handleGifSelect = useCallback((gifUrl: string) => {
    // GIF는 메시지로 바로 전송
    onSendGif(gifUrl);
    setShowGifPicker(false);
  }, [onSendGif]);

  /**
   * 파일 선택 핸들러 - 바로 파일 선택창 열기
   */
  const handleFileClick = useCallback(() => {
    internalFileInputRef.current?.click();
  }, []);

  
  
  /**
   * 이모지 피커 토글
   */
  const handleEmojiClick = useCallback(() => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
    } else {
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        setEmojiPickerPosition({
          bottom: window.innerHeight - rect.top + 10,
          right: window.innerWidth - rect.right,
        });
        setShowEmojiPicker(true);
      }
    }
  }, [showEmojiPicker]);
  
  /**
   * GIF 피커 토글
   */
  const handleGifClick = useCallback(() => {
    if (showGifPicker) {
      setShowGifPicker(false);
    } else {
      if (textareaRef.current) {
        const rect = textareaRef.current.getBoundingClientRect();
        setGifPickerPosition({
          bottom: window.innerHeight - rect.top + 10,
          right: window.innerWidth - rect.right,
        });
        setShowGifPicker(true);
      }
    }
  }, [showGifPicker]);

  const hasContent = !isMessageEmpty(message);

  return (
    <>
      <div className="border-t border-white/[0.08] bg-[#08080c]/96 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-22px_70px_-52px_rgba(0,0,0,0.95)] backdrop-blur-2xl sm:p-4 sm:pb-4">
        <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors focus-within:border-zinc-200/20 focus-within:bg-white/[0.05]">
          <div className="flex items-end gap-2">
          {/* 파일 입력 (숨김) - 기본적으로 다중 선택 지원 */}
          <input
            type="file"
            ref={internalFileInputRef}
            onChange={onFileChange}
            className="hidden"
            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar,.7z,.tar,.gz"
            multiple
          />
          
          {/* 파일 첨부 버튼 - 호버 애니메이션 강화 */}
          <Button
            ref={fileButtonRef}
            variant="ghost"
            size="sm"
            onClick={handleFileClick}
            className={cn(
              "h-10 flex-shrink-0 rounded-full px-3 text-zinc-400",
              "transition-all duration-200",
              "hover:bg-white/[0.08] hover:text-white",
              "active:scale-95 focus-visible:ring-2 focus-visible:ring-zinc-200/45"
            )}
            title={CHAT_MESSAGES.ATTACH_TITLE}
            aria-label={CHAT_MESSAGES.ATTACH_TITLE}
            type="button"
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          {/* 메시지 입력 영역 - 라운드 디자인 적용 */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              className={cn(
                "min-h-[44px] max-h-[200px] w-full resize-none",
                "overflow-y-auto",
                "px-1.5 pr-20 py-3",
                "border-0 bg-transparent",
                "focus:outline-none focus:ring-0",
                "text-sm leading-relaxed text-zinc-100 caret-emerald-200",
                "whitespace-pre-wrap break-words",
                "transition-all duration-200",
                "scrollbar-hide",
                "[&::-webkit-scrollbar]:hidden",
                "scrollbar-width-none"
              )}
              style={{
                // 추가 인라인 스타일로 스크롤바 완전히 숨김
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
              placeholder="" // 플레이스홀더 비우기 (커스텀 플레이스홀더 사용)
            />
            
            {/* 수직 중앙 정렬 플레이스홀더 */}
            {!message && (
              <div
                className={cn(
                  "absolute inset-0",
                  "flex items-center", // 수직 중앙 정렬
                  "px-1.5 pr-20", // textarea와 동일한 패딩
                  "pointer-events-none",
                  "text-sm text-zinc-500"
                )}
              >
                {CHAT_MESSAGES.INPUT_PLACEHOLDER}
              </div>
            )}
            
            {/* 이모지 + GIF 버튼 컨테이너 */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {/* 이모지 버튼 - 호버 효과 강화 */}
              <Button
                ref={emojiButtonRef}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  "rounded-full text-zinc-400",
                  "transition-all duration-200",
                  "hover:bg-white/[0.08] hover:text-white",
                  "active:scale-95 focus-visible:ring-2 focus-visible:ring-zinc-200/45"
                )}
                onClick={handleEmojiClick}
                type="button"
                title="Select Emoji"
              >
                <Smile className={cn(
                  "w-4 h-4 transition-colors duration-200",
                  showEmojiPicker ? 'text-emerald-200' : 'text-current'
                )} />
              </Button>
              
              {/* GIF 버튼 - 호버 효과 강화 */}
              <Button
                ref={gifButtonRef}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0",
                  "rounded-full text-zinc-400",
                  "transition-all duration-200",
                  "hover:bg-white/[0.08] hover:text-white",
                  "active:scale-95 focus-visible:ring-2 focus-visible:ring-zinc-200/45"
                )}
                onClick={handleGifClick}
                type="button"
                title="Select GIF"
              >
                <ImageIcon className={cn(
                  "w-4 h-4 transition-colors duration-200",
                  showGifPicker ? 'text-emerald-200' : 'text-current'
                )} />
              </Button>
            </div>
          </div>

          {/* 전송 버튼 - 시각적 피드백 대폭 강화 */}
          <Button
            onClick={handleSend}
            disabled={!hasContent}
            size="sm"
            type="button"
            className={cn(
              "h-10 flex-shrink-0 rounded-full px-4",
              "transition-all duration-200",
              hasContent
                ? cn(
                    "bg-emerald-300 text-[#06130d] hover:bg-emerald-200",
                    "shadow-[0_18px_44px_-24px_rgba(110,231,183,0.95)]",
                    "hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
                    "focus-visible:ring-2 focus-visible:ring-emerald-200/55"
                  )
                : "cursor-not-allowed bg-white/[0.055] text-zinc-600 opacity-80"
            )}
            title={hasContent ? "Send message (Enter)" : "Type a message"}
            aria-label={hasContent ? "Send message" : "Type a message before sending"}
          >
            <Send className={cn(
              "w-4 h-4 transition-transform duration-200",
              hasContent && "scale-110"
            )} />
          </Button>
          </div>
        </div>

        {/* 키보드 단축키 안내 - 투명도 조정 */}
        <p className="mt-2 flex items-center justify-center gap-2 text-center text-[10px] text-zinc-500">
          <span>{CHAT_MESSAGES.KEYBOARD_HINT}</span>
          {message && <span className="text-zinc-600">Draft autosaved</span>}
        </p>
      </div>
      
      {/* 이모지 피커 */}
      {showEmojiPicker && (
        <EmojiPicker
          onEmojiSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
          position={emojiPickerPosition}
        />
      )}
      
      {/* GIF 피커 */}
      {showGifPicker && (
        <GifPicker
          onGifSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
          position={gifPickerPosition}
        />
      )}

          </>
  );
};
