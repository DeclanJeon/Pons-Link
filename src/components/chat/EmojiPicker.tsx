/**
 * 이모지 피커 컴포넌트 - Emojis World API 사용
 * 실시간 채팅 이모지 선택 UI
 * @module EmojiPicker
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  fetchEmojiCategories,
  fetchRandomEmoji,
 EmojiData,
  EmojiCategory
} from '@/lib/emojiUtils';
import { Heart, HeartOff } from 'lucide-react';
import { getFavoriteEmojis, addFavoriteEmoji, removeFavoriteEmoji } from '@/lib/emojiFavorites';

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

  // 즐겨찾기 로드
  useEffect(() => {
    setFavoriteEmojis(getFavoriteEmojis());
  }, []);
  
  // 즐겨찾기 토글 함수
  const toggleFavorite = (emoji: string) => {
    if (favoriteEmojis.includes(emoji)) {
      removeFavoriteEmoji(emoji);
      setFavoriteEmojis(prev => prev.filter(e => e !== emoji));
    } else {
      addFavoriteEmoji(emoji);
      setFavoriteEmojis(prev => [...prev, emoji]);
    }
 };
  
  // 카테고리 로드
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
          console.error('이모지 로드 오류:', error);
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

  // 카테고리 클릭 처리
  const handleCategoryClick = (categoryId: number) => {
    setActiveCategory(categoryId);
    setViewMode('emojis');
  };

  return (
    <div
      ref={pickerRef}
      className="fixed z-50 w-80 max-w-[95vw] h-[450px] max-h-[60vh] bg-popover border border-border rounded-lg shadow-lg flex flex-col overflow-hidden"
      style={{
        bottom: `${position.bottom}px`,
        right: `${position.right}px`,
      }}
    >
      <div className="p-2 border-b border-border flex flex-col gap-2">
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'categories' ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setViewMode('categories')}
          >
            카테고리
          </Button>
          <Button
            variant={viewMode === 'favorites' ? "default" : "outline"}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setViewMode('favorites')}
          >
            즐겨찾기
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {viewMode === 'categories' && (
          <div className="p-3 grid grid-cols-2 gap-2">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant="outline"
                size="sm"
                className="h-auto p-2 text-xs justify-start"
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
              <div className="col-span-full flex items-center justify-center h-full text-muted-foreground">
                이모지를 불러오는 중...
              </div>
            ) : (
              emojis.map((emojiData) => (
                <Button
                  key={emojiData.id}
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 text-2xl hover:bg-accent rounded-md relative group transition-all duration-200 hover:scale-110"
                  onClick={() => onEmojiSelect(emojiData.emoji)}
                  title={emojiData.name}
                >
                  {emojiData.emoji}
                  <span
                    className="absolute -top-1 -right-1 bg-background border border-border rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(emojiData.emoji);
                    }}
                  >
                    {favoriteEmojis.includes(emojiData.emoji) ? (
                      <Heart className="w-3 h-3 text-red-500 fill-current" />
                    ) : (
                      <HeartOff className="w-3 h-3 text-muted-foreground" />
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
              <div className="col-span-full flex items-center justify-center h-full text-muted-foreground">
                즐겨찾기한 이모지가 없습니다
              </div>
            ) : (
              favoriteEmojis.map((emoji, index) => (
                <Button
                  key={`favorite-${index}`}
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 text-2xl hover:bg-accent rounded-md relative group transition-all duration-200 hover:scale-110"
                  onClick={() => onEmojiSelect(emoji)}
                >
                  {emoji}
                  <span
                    className="absolute -top-1 -right-1 bg-background border border-border rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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