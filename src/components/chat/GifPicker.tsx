/**
 * GIF 선택 컴포넌트 (Rate Limit 대응)
 * @module GifPicker
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Gif {
  id: string;
  url: string;
  images: {
    fixed_width: {
      url: string;
      width: string;
      height: string;
    };
  };
}

interface GifPickerProps {
  onGifSelect: (gifUrl: string) => void;
  onClose: () => void;
  position: { bottom: number; right: number };
}

/**
 * GIF 검색 및 선택 컴포넌트
 * Rate Limit 대응 및 디바운스 최적화
 */
export const GifPicker = ({ onGifSelect, onClose, position }: GifPickerProps) => {
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  
  const limit = 25;
  const DEBOUNCE_DELAY = 500; // 디바운스 지연 증가
  const RATE_LIMIT_COOLDOWN = 60000; // 1분 쿨다운

  // Refs
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestTimeRef = useRef<number>(0);
  const rateLimitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 🔧 FIX: API 요청 함수 - Rate Limit 대응
   */
  const fetchGifs = useCallback(async (query: string, offset: number) => {
    // Rate Limit 체크
    if (rateLimited) {
      setError('너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // 최소 요청 간격 체크 (300ms)
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTimeRef.current;
    if (timeSinceLastRequest < 300) {
      console.log('[GifPicker] Request throttled');
      return;
    }

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 로딩 중이면 중단
    if (loading) {
      console.log('[GifPicker] Already loading, skipping request');
      return;
    }

    setLoading(true);
    setError(null);
    lastRequestTimeRef.current = now;

    // 새로운 AbortController 생성
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?` +
        `api_key=${import.meta.env.VITE_GIPHY_API_KEY || '1WMNMEJRQHRIPzyIFKHGLeF8EmWsxmWY'}&` +
        `q=${encodeURIComponent(query)}&` +
        `limit=${limit}&` +
        `offset=${offset}&` +
        `rating=g&` +
        `lang=en`,
        { signal: abortController.signal }
      );

      if (response.status === 429) {
        // Rate Limit 처리
        setRateLimited(true);
        setError('API 요청 한도를 초과했습니다. 1분 후 다시 시도해주세요.');
        
        // 1분 후 자동 해제
        rateLimitTimeoutRef.current = setTimeout(() => {
          setRateLimited(false);
          setError(null);
        }, RATE_LIMIT_COOLDOWN);
        
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: GIF 검색에 실패했습니다.`);
      }

      const data = await response.json();
      
      // 요청이 취소되지 않았을 때만 상태 업데이트
      if (!abortController.signal.aborted) {
        setGifs(prev => offset === 0 ? data.data : [...prev, ...data.data]);
        setError(null);
      }
    } catch (err) {
      // AbortError는 무시
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[GifPicker] Request aborted');
        return;
      }

      if (!abortController.signal.aborted) {
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setError(errorMessage);
        console.error('[GifPicker] API Error:', err);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [loading, rateLimited]);

  /**
   * 🔧 FIX: 디바운스 검색 - 의존성 최적화
   */
  useEffect(() => {
    // 빈 검색어면 초기화
    if (!searchQuery.trim()) {
      setGifs([]);
      setError(null);
      return;
    }

    // 이전 타이머 취소
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // 새로운 타이머 설정
    debounceRef.current = setTimeout(() => {
      console.log('[GifPicker] Debounced search:', searchQuery);
      fetchGifs(searchQuery, 0);
      setOffset(0);
    }, DEBOUNCE_DELAY);

    // 클린업
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]); // fetchGifs는 useCallback으로 안정화됨

  /**
   * 컴포넌트 언마운트 시 정리
   */
  useEffect(() => {
    return () => {
      // 모든 타이머 정리
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (rateLimitTimeoutRef.current) {
        clearTimeout(rateLimitTimeoutRef.current);
      }
      // 진행 중인 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * 폼 제출 핸들러 (Enter 키)
   */
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    // 디바운스 타이머 즉시 실행
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (searchQuery.trim()) {
      fetchGifs(searchQuery, 0);
      setOffset(0);
    }
  }, [searchQuery, fetchGifs]);

  /**
   * 더 보기 핸들러
   */
  const loadMore = useCallback(() => {
    if (searchQuery.trim() && !loading && !rateLimited) {
      const newOffset = offset + limit;
      setOffset(newOffset);
      fetchGifs(searchQuery, newOffset);
    }
  }, [searchQuery, loading, rateLimited, offset, fetchGifs]);

  /**
   * GIF 선택 핸들러
   */
  const handleGifClick = useCallback((gifUrl: string) => {
    onGifSelect(gifUrl);
    onClose();
  }, [onGifSelect, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        className={cn(
          "fixed bg-popover/95 backdrop-blur-xl border border-border/50 rounded-lg shadow-lg z-50",
          "w-[350px] h-[400px] flex flex-col"
        )}
        style={{
          bottom: `${position.bottom}px`,
          right: `${position.right}px`,
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="GIF 검색..."
              className="h-8 text-sm border-0 focus-visible:ring-1 focus-visible:ring-border"
              disabled={rateLimited}
            />
          </form>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* GIF 목록 */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive px-4 text-center">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm">{error}</p>
              {rateLimited && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRateLimited(false);
                    setError(null);
                  }}
                  className="mt-2"
                >
                  다시 시도
                </Button>
              )}
            </div>
          ) : loading && offset === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : gifs.length === 0 && searchQuery.trim() ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              검색 결과가 없습니다.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {gifs.map((gif) => (
                  <div
                    key={gif.id}
                    className="relative group cursor-pointer rounded-md overflow-hidden hover:opacity-90 transition-opacity"
                    onClick={() => handleGifClick(gif.images.fixed_width.url)}
                  >
                    <img
                      src={gif.images.fixed_width.url}
                      alt="GIF"
                      className="w-full h-auto object-cover aspect-square"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>

              {loading && offset > 0 && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              )}

              {!loading && gifs.length > 0 && gifs.length >= limit && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={rateLimited}
                    className="w-full"
                  >
                    더 보기
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
