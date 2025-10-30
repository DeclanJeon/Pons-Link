/**
 * GIF 선택 컴포넌트 (Rate Limit 대응 및 트렌딩 기능 추가)
 * @module GifPicker
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, AlertCircle, TrendingUp } from 'lucide-react';
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
 * - Rate Limit 대응, 디바운스 최적화
 * - 초기 로드 시 트렌딩 GIF 표시 기능
 */
export const GifPicker = ({ onGifSelect, onClose, position }: GifPickerProps) => {
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const [isTrending, setIsTrending] = useState(true);

  const limit = 25;
  const DEBOUNCE_DELAY = 500;
  const RATE_LIMIT_COOLDOWN = 60000;

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestTimeRef = useRef<number>(0);
  const rateLimitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 🔧 최적화: API 요청을 위한 공통 로직
   * useCallback의 의존성 배열에서 'loading' 상태를 제거하여 불필요한 함수 재생성을 방지합니다.
   */
  const fetchFromGiphy = useCallback(async (endpoint: 'search' | 'trending', query: string, newOffset: number) => {
    if (rateLimited) {
      setError('너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    const now = Date.now();
    if (now - lastRequestTimeRef.current < 300) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    
    // 로딩 상태는 함수 내부에서 직접 관리합니다.
    setLoading(true);
    setError(null);
    lastRequestTimeRef.current = now;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const apiKey = import.meta.env.VITE_GIPHY_API_KEY
      const params = new URLSearchParams({
        api_key: apiKey,
        limit: String(limit),
        offset: String(newOffset),
        rating: 'g',
        lang: 'en',
      });

      if (endpoint === 'search') {
        params.append('q', query);
      }

      const response = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params}`, { signal: abortController.signal });

      if (response.status === 429) {
        setRateLimited(true);
        setError('API 요청 한도를 초과했습니다. 1분 후 다시 시도해주세요.');
        rateLimitTimeoutRef.current = setTimeout(() => {
          setRateLimited(false);
          setError(null);
        }, RATE_LIMIT_COOLDOWN);
        return;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}: GIF 로드에 실패했습니다.`);

      const data = await response.json();
      if (!abortController.signal.aborted) {
        setGifs(prev => newOffset === 0 ? data.data : [...prev, ...data.data]);
        setError(null);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('[GifPicker] Request aborted');
        return;
      }
      if (!abortController.signal.aborted) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(errorMessage);
        console.error('[GifPicker] API Error:', err);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [rateLimited]); // 의존성 배열에서 loading 제거

  /**
   * 컴포넌트 마운트 시 트렌딩 GIF 로드
   */
  useEffect(() => {
    fetchFromGiphy('trending', '', 0);
  }, [fetchFromGiphy]);

  /**
   * 검색어 변경에 따른 디바운스 로직
   */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        setIsTrending(false);
        setOffset(0);
        fetchFromGiphy('search', searchQuery, 0);
      } else {
        // 검색어가 비워지면 트렌딩 목록으로 복귀
        setIsTrending(true);
        setOffset(0);
        fetchFromGiphy('trending', '', 0);
      }
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, fetchFromGiphy]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (rateLimitTimeoutRef.current) clearTimeout(rateLimitTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim()) {
      setIsTrending(false);
      setOffset(0);
      fetchFromGiphy('search', searchQuery, 0);
    } else {
      setIsTrending(true);
      setOffset(0);
      fetchFromGiphy('trending', '', 0);
    }
  }, [searchQuery, fetchFromGiphy]);

  /**
   * '더 보기' 핸들러
   */
  const loadMore = useCallback(() => {
    // 로딩 중일 때 중복 호출 방지
    if (loading || rateLimited) return;

    const newOffset = offset + limit;
    setOffset(newOffset);
    
    // 로딩 상태를 여기서 직접 관리
    setLoading(true);
    
    if (isTrending) {
      fetchFromGiphy('trending', '', newOffset).finally(() => setLoading(false));
    } else {
      fetchFromGiphy('search', searchQuery, newOffset).finally(() => setLoading(false));
    }
  }, [loading, rateLimited, offset, isTrending, searchQuery, fetchFromGiphy]);

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
        style={{ bottom: `${position.bottom}px`, right: `${position.right}px` }}
      >
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
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 hover:bg-accent">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive px-4 text-center">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm">{error}</p>
              {rateLimited && <Button size="sm" variant="outline" onClick={() => { setRateLimited(false); setError(null); }} className="mt-2">다시 시도</Button>}
            </div>
          ) : loading && offset === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : gifs.length === 0 && !isTrending ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">No search results.</div>
          ) : (
            <>
              {isTrending && offset === 0 && (
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3 px-1">
                  <TrendingUp className="w-4 h-4" />
                  Trending GIFs
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {gifs.map((gif) => (
                  <div key={gif.id} className="relative group cursor-pointer rounded-md overflow-hidden hover:opacity-90 transition-opacity" onClick={() => handleGifClick(gif.images.fixed_width.url)}>
                    <img src={gif.images.fixed_width.url} alt="GIF" className="w-full h-auto object-cover aspect-square" loading="lazy" />
                  </div>
                ))}
              </div>
              {loading && offset > 0 && <div className="flex items-center justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div></div>}
              {/* '더 보기' 버튼 로직 수정: gifs.length % limit === 0 조건으로 더 정확하게 다음 페이지 존재 여부 판단 */}
              {!loading && gifs.length > 0 && gifs.length % limit === 0 && (
                <div className="flex justify-center mt-4">
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={rateLimited || loading} className="w-full">더 보기</Button>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
