/**
 * 이모지 피커 컴포넌트 - Emojis World API 사용
 * 실시간 채팅 이모지 선택 UI
 * @module EmojiPicker
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  fetchEmojiCategories,
  fetchRandomEmoji,
  EmojiData,
  EmojiCategory
} from '@/lib/chat/emojiUtils';
import { Heart, HeartOff } from 'lucide-react';
import { getFavoriteEmojis, addFavoriteEmoji, removeFavoriteEmoji } from '@/lib/chat/emojiFavorites';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  position: { bottom: number; right: number };
}

export const EmojiPicker = ({
  onEmojiSelect,
  onClose,
  position
}: EmojiPickerProps) => {
  const [emojis, setEmojis] = useState<EmojiData[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<EmojiCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'categories' | 'emojis' | 'favorites'>('categories');
  const [favoriteEmojis, setFavoriteEmojis] = useState<string[]>([]);

  const pickerRef = useRef<HTMLDivElement>(null);

  // Favorites 로드
  useEffect(() => {
    setFavoriteEmojis(getFavoriteEmojis());
  }, []);
  
  // Favorites 토글 함수
  const toggleFavorite = (emoji: string) => {
    if (favoriteEmojis.includes(emoji)) {
      removeFavoriteEmoji(emoji);
      setFavoriteEmojis(prev => prev.filter(e => e !== emoji));
    } else {
      addFavoriteEmoji(emoji);
      setFavoriteEmojis(prev => [...prev, emoji]);
    }
  };
  
  // Categories 로드
  useEffect(() => {
    const loadCategories = async () => {
      const loadedCategories = await fetchEmojiCategories();
      setCategories(loadedCategories);
    };
    loadCategories();
  }, []);

  // 이모지 로드
  useEffect(() => {
    if (viewMode === 'emojis' && activeCategory > 0) {
      const loadEmojis = async () => {
        setLoading(true);
        try {
          const newEmojis = await fetchRandomEmoji(50, [activeCategory]);
          setEmojis(newEmojis);
        } catch (error) {
          console.error('Emoji load error:', error);
        } finally {
          setLoading(false);
        }
      };
      loadEmojis();
    }
  }, [activeCategory, viewMode]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Categories 클릭 처리
  const handleCategoryClick = (categoryId: number) => {
    setActiveCategory(categoryId);
    setViewMode('emojis');
  };

  const isCompactPicker = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div
      ref={pickerRef}
      role="dialog"
      aria-label="Emoji picker"
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden border border-white/[0.10] bg-[#101017]/95 text-zinc-100 shadow-[0_24px_90px_-45px_rgba(0,0,0,0.98)] backdrop-blur-2xl",
        "bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-3 right-3 h-[min(70dvh,460px)] rounded-2xl",
        "sm:left-auto sm:right-auto sm:h-[450px] sm:max-h-[60vh] sm:w-80 sm:max-w-[95vw] sm:rounded-xl"
      )}
      style={isCompactPicker ? undefined : {
        bottom: `${position.bottom}px`,
        right: `${position.right}px`,
      }}
    >
      <div className="flex flex-col gap-2 border-b border-white/[0.08] p-2">
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'categories' ? "default" : "outline"}
            size="sm"
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => setViewMode('categories')}
          >
            Categories
          </Button>
          <Button
            variant={viewMode === 'favorites' ? "default" : "outline"}
            size="sm"
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => setViewMode('favorites')}
          >
            Favorites
          </Button>
        </div>
      </div>
      
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {viewMode === 'categories' && (
          <div className="p-3 grid grid-cols-2 gap-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant="outline"
                size="sm"
                className="h-auto justify-start rounded-xl border-white/[0.10] bg-white/[0.035] p-2 text-xs text-zinc-200 hover:bg-white/[0.08]"
                onClick={() => handleCategoryClick(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        )}
        
        {viewMode === 'emojis' && (
          <div className="p-3 grid grid-cols-8 gap-1">
            {loading ? (
              <div className="col-span-full flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : emojis.length === 0 ? (
              <div className="col-span-full flex h-full items-center justify-center text-zinc-500">
                Loading emojis...
              </div>
            ) : (
              emojis.map((emojiData) => (
                <Button
                  key={emojiData.id}
                  variant="ghost"
                  size="sm"
                  className="group relative h-10 w-10 rounded-lg p-0 text-2xl transition-all duration-200 hover:scale-110 hover:bg-white/[0.08]"
                  onClick={() => onEmojiSelect(emojiData.emoji)}
                  title={emojiData.name}
                >
                  {emojiData.emoji}
                  <span
                    className="absolute -right-1 -top-1 cursor-pointer rounded-full border border-white/[0.12] bg-[#101017] p-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(emojiData.emoji);
                    }}
                  >
                    {favoriteEmojis.includes(emojiData.emoji) ? (
                      <Heart className="w-3 h-3 text-red-500 fill-current" />
                    ) : (
                      <HeartOff className="w-3 h-3 text-zinc-500" />
                    )}
                  </span>
                </Button>
              ))
            )}
          </div>
        )}
        
        {viewMode === 'favorites' && (
          <div className="p-3 grid grid-cols-8 gap-1">
            {favoriteEmojis.length === 0 ? (
              <div className="col-span-full flex h-full items-center justify-center text-zinc-500">
                Favorites한 이모지가 없습니다
              </div>
            ) : (
              favoriteEmojis.map((emoji, index) => (
                <Button
                  key={`favorite-${index}`}
                  variant="ghost"
                  size="sm"
                  className="group relative h-10 w-10 rounded-lg p-0 text-2xl transition-all duration-200 hover:scale-110 hover:bg-white/[0.08]"
                  onClick={() => onEmojiSelect(emoji)}
                >
                  {emoji}
                  <span
                    className="absolute -right-1 -top-1 cursor-pointer rounded-full border border-white/[0.12] bg-[#101017] p-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(emoji);
                    }}
                  >
                    <Heart className="w-3 h-3 text-red-500 fill-current" />
                  </span>
                </Button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
