import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPreview } from './VideoPreview';

interface DraggableVideoProps {
  stream: MediaStream | null;
  nickname: string;
  isVideoEnabled: boolean;
  isLocalVideo: boolean;
  onHide?: () => void;
  onFocus?: () => void; // 클릭 시 이 참가자를 메인으로 포커스
  canFocus?: boolean; // 포커스 가능 여부 (원격 유저가 있을 때만 true)
  isFocused?: boolean; // 현재 포커스된 상태인지
}

/**
 * 디바이스 타입 감지 훅
 */
const useDeviceType = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(hasTouch && isSmallScreen);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return isMobile;
};

/**
 * PIP 비디오 크기 계산 훅
 */
const usePIPSize = (isMobile: boolean) => {
  return isMobile
    ? { width: 160, height: 120 }
    : { width: 240, height: 180 };
};

/**
 * 초기 위치 계산 훅
 */
const useInitialPosition = (isMobile: boolean, pipSize: { width: number; height: number }) => {
  const [position, setPosition] = useState(() => {
    // 초기 상태를 함수로 계산 (마운트 시 1회만)
    if (isMobile) {
      return { x: 20, y: 20 };
    } else {
      const x = window.innerWidth - pipSize.width - 20;
      const y = window.innerHeight - pipSize.height - 80 - 20;
      return { x, y };
    }
  });

  // 창 크기 변경 시에만 위치 재조정
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        if (isMobile) {
          // 모바일: 좌측 상단 유지
          return { x: 20, y: 20 };
        } else {
          // 데스크톱: 현재 위치가 화면 밖이면 조정
          const maxX = window.innerWidth - pipSize.width - 20;
          const maxY = window.innerHeight - pipSize.height - 80 - 20;

          return {
            x: Math.min(prev.x, maxX),
            y: Math.min(prev.y, maxY)
          };
        }
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, pipSize.width, pipSize.height]);

  return [position, setPosition] as const;
};


/**
 * 더블클릭/더블탭 감지 훅
 */
const useDoubleClickTap = (callback: () => void) => {
  const lastTapRef = useRef<number>(0);
  const tapCountRef = useRef<number>(0);
  const tapTimerRef = useRef<NodeJS.Timeout>();

  const handleInteraction = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 300) {
      tapCountRef.current += 1;

      if (tapCountRef.current === 2) {
        callback();
        tapCountRef.current = 0;
        if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      }
    } else {
      tapCountRef.current = 1;

      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 300);
    }

    lastTapRef.current = now;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  return handleInteraction;
};

export const DraggableVideo = ({
  stream,
  nickname,
  isVideoEnabled,
  isLocalVideo,
  onHide,
  onFocus,
  canFocus = false,
  isFocused = false
}: DraggableVideoProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useDeviceType();
  const pipSize = usePIPSize(isMobile);
  const [position, setPosition] = useInitialPosition(isMobile, pipSize);

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  // 모바일 전용: 롱프레스 및 스와이프
  const [isDragReady, setIsDragReady] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const [swipeStart, setSwipeStart] = useState({ x: 0, y: 0, time: 0 });
  const [isSwipingToHide, setIsSwipingToHide] = useState(false);

  // 힌트 표시
  const [showHint, setShowHint] = useState(false);
  const [hasShownHint, setHasShownHint] = useState(false);
  const hintTimerRef = useRef<NodeJS.Timeout>();

  /**
   * 전체화면 전환 핸들러
   */
  const handleFullscreen = useCallback(() => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  }, []);

  /**
   * 더블클릭/더블탭 핸들러
   */
  const handleDoubleInteraction = useDoubleClickTap(handleFullscreen);

  /**
   * 싱글 클릭/탭 핸들러 (포커스 전환)
   */
  const handleSingleClick = useCallback(() => {
    // 드래그하지 않았고, 포커스 가능하며, 이미 포커스되지 않은 경우만 포커스
    if (!hasMoved && canFocus && !isFocused && onFocus) {
      onFocus();
    }
  }, [hasMoved, canFocus, isFocused, onFocus]);

  /**
   * 데스크톱: 마우스 호버 시 힌트 표시
   */
  const handleMouseEnter = () => {
    if (!isMobile && !hasShownHint) {
      hintTimerRef.current = setTimeout(() => {
        setShowHint(true);
        setHasShownHint(true);
        setTimeout(() => setShowHint(false), 3000);
      }, 1000);
    }
  };

  const handleMouseLeave = () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  };

  /**
   * 스와이프로 숨기기 (모바일 전용)
   */
  const handleSwipeHide = useCallback((clientX: number, clientY: number) => {
    const deltaX = clientX - swipeStart.x;
    const deltaY = clientY - swipeStart.y;
    const swipeTime = Date.now() - swipeStart.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = swipeTime > 0 ? distance / swipeTime : 0;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const edgeThreshold = 60;

    const isNearEdge =
      position.x < edgeThreshold ||
      position.x > screenWidth - pipSize.width - edgeThreshold ||
      position.y < edgeThreshold ||
      position.y > screenHeight - pipSize.height - edgeThreshold;

    const isStrongSwipe = distance > 80 && velocity > 0.4;

    if (isNearEdge && isStrongSwipe) {
      const hideDirection = {
        x: deltaX < 0 ? -400 : deltaX > 0 ? 400 : 0,
        y: deltaY < 0 ? -400 : deltaY > 0 ? 400 : 0
      };

      setPosition(prev => ({
        x: prev.x + hideDirection.x,
        y: prev.y + hideDirection.y
      }));

      setTimeout(() => onHide?.(), 300);
    }

    setIsSwipingToHide(false);
  }, [swipeStart, position, pipSize, onHide]);

  /**
   * 데스크톱: 마우스 다운
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  /**
   * 데스크톱: 마우스 업
   */
  const handleMouseUp = () => {
    if (isMobile) return;

    if (isDragging) {
      setIsDragging(false);

      if (!hasMoved) {
        handleSingleClick();
      }
    }
  };

  /**
   * 데스크톱: 마우스 이동
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile || !isDragging) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
      setHasMoved(true);
    }

    const maxX = window.innerWidth - pipSize.width;
    const maxY = window.innerHeight - pipSize.height - 80;

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  /**
   * 모바일: 터치 시작
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;

    const touch = e.touches[0];
    setSwipeStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });
    setHasMoved(false);

    longPressTimerRef.current = setTimeout(() => {
      setIsDragReady(true);
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      });
      if ('vibrate' in navigator) navigator.vibrate(50);
    }, 2000);
  };

  /**
   * 모바일: 터치 종료
   */
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    if (isDragging) {
      setIsDragging(false);
      setIsDragReady(false);

      if (!hasMoved) {
        handleSingleClick();
      }
    } else {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance < 10) {
        handleDoubleInteraction();
      } else {
        handleSwipeHide(touch.clientX, touch.clientY);
      }
    }
  };

  /**
   * 모바일: 터치 이동
   */
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 10 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }

    if (isDragging) {
      const newX = touch.clientX - dragStart.x;
      const newY = touch.clientY - dragStart.y;

      if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
        setHasMoved(true);
      }

      const maxX = window.innerWidth - pipSize.width;
      const maxY = window.innerHeight - pipSize.height - 80;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    } else if (distance > 30) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const edgeThreshold = 60;

      const isNearEdge =
        position.x < edgeThreshold ||
        position.x > screenWidth - pipSize.width - edgeThreshold ||
        position.y < edgeThreshold ||
        position.y > screenHeight - pipSize.height - edgeThreshold;

      setIsSwipingToHide(isNearEdge);
    }
  };

  /**
   * 데스크톱: 더블클릭 핸들러
   */
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    handleDoubleInteraction();
  };

  // 전역 마우스 이벤트 리스너
  useEffect(() => {
    if (!isMobile && isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;

        if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
          setHasMoved(true);
        }

        const maxX = window.innerWidth - pipSize.width;
        const maxY = window.innerHeight - pipSize.height - 80;

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      };

      const handleGlobalMouseUp = () => {
        setIsDragging(false);

        if (!hasMoved) {
          handleSingleClick();
        }
      };

      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isMobile, isDragging, dragStart, pipSize, hasMoved, handleSingleClick, position.x, position.y]);

  // 타이머 정리
  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed rounded-lg overflow-hidden shadow-2xl border-2 z-40 transition-all duration-200",
        canFocus && !isFocused
          ? "border-primary/50 hover:border-primary cursor-pointer hover:scale-105"
          : "border-primary/30 hover:border-primary/60",
        isDragging ? "cursor-grabbing scale-95 opacity-90 shadow-3xl" : canFocus && !isFocused ? "cursor-pointer" : "cursor-grab",
        isMobile && isDragReady && !isDragging && "ring-4 ring-primary/60 animate-pulse",
        isFocused && "ring-2 ring-green-500/60"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${pipSize.width}px`,
        height: `${pipSize.height}px`,
        transform: 'translateZ(0)',
        transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onDoubleClick={handleDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      <VideoPreview
        stream={stream}
        nickname={nickname}
        isVideoEnabled={isVideoEnabled}
        isLocalVideo={isLocalVideo}
      />

      {/* 포커스 가능 표시 (호버 시) */}
      {canFocus && !isFocused && !isDragging && (
        <div className="absolute inset-0 bg-primary/10 opacity-0 hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
          <div className="bg-primary/90 text-white px-3 py-1.5 rounded-full text-xs font-medium">
            Click to focus
          </div>
        </div>
      )}

      {/* 현재 포커스됨 표시 */}
      {isFocused && (
        <div className="absolute top-2 right-2 bg-green-500/90 text-white px-2 py-1 rounded-full text-xs font-bold pointer-events-none">
          Focused
        </div>
      )}

      {/* 데스크톱: 사용법 힌트 */}
      {!isMobile && showHint && !isDragging && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300 pointer-events-none">
          <div className="text-center px-4 space-y-2">
            <p className="text-white text-sm font-medium">
              💡 <strong>Drag</strong> to move
            </p>
            {canFocus && !isFocused && (
              <p className="text-white text-sm font-medium">
                💡 <strong>Click</strong> to focus
              </p>
            )}
            <p className="text-white text-sm font-medium">
              💡 <strong>Double-click</strong> for fullscreen
            </p>
          </div>
        </div>
      )}

      {/* 모바일: 사용법 힌트 */}
      {isMobile && !isDragReady && !isDragging && (
        <div className="absolute top-2 left-2 text-white text-xs bg-black/60 backdrop-blur-sm px-2 py-1 rounded pointer-events-none">
          <p>Hold 2s to drag</p>
          {canFocus && !isFocused && <p>Tap to focus</p>}
          <p>Double-tap fullscreen</p>
        </div>
      )}

      {/* 모바일: 스와이프 숨김 피드백 */}
      {isMobile && !isDragging && isSwipingToHide && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{
            background: 'linear-gradient(to bottom, rgba(239, 68, 68, 0.4), transparent)'
          }}
        >
          <div className="text-white text-sm font-bold bg-red-500/90 px-4 py-2 rounded-full shadow-lg">
            Swipe to hide
          </div>
        </div>
      )}

      {/* 드래그 중 시각적 피드백 */}
      {isDragging && (
        <div className="absolute inset-0 border-2 border-primary/60 rounded-lg pointer-events-none" />
      )}
    </div>
  );
};
