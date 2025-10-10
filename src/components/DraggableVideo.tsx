import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPreview } from './VideoPreview';

interface DraggableVideoProps {
  stream: MediaStream | null;
  nickname: string;
  isVideoEnabled: boolean;
  isLocalVideo: boolean;
  onHide?: () => void;
}

/**
 * 디바이스 타입 감지 훅
 * 터치 지원 여부로 모바일/데스크톱을 구분합니다.
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
 * 데스크톱: 240x180 (1.5배), 모바일: 160x120
 */
const usePIPSize = (isMobile: boolean) => {
  return isMobile
    ? { width: 160, height: 120 }
    : { width: 240, height: 180 };
};

/**
 * 초기 위치 계산 훅
 * 데스크톱: 우측 하단, 모바일: 좌측 상단
 */
const useInitialPosition = (isMobile: boolean, pipSize: { width: number; height: number }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const calculatePosition = () => {
      if (isMobile) {
        // 모바일: 좌측 상단 (여백 20px)
        setPosition({ x: 20, y: 20 });
      } else {
        // 데스크톱: 우측 하단 (여백 20px, 하단 컨트롤 바 80px 고려)
        const x = window.innerWidth - pipSize.width - 20;
        const y = window.innerHeight - pipSize.height - 80 - 20;
        setPosition({ x, y });
      }
    };

    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  }, [isMobile, pipSize.width, pipSize.height]);

  return [position, setPosition] as const;
};

export const DraggableVideo = ({
  stream,
  nickname,
  isVideoEnabled,
  isLocalVideo,
  onHide
}: DraggableVideoProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useDeviceType();
  const pipSize = usePIPSize(isMobile);
  const [position, setPosition] = useInitialPosition(isMobile, pipSize);

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 모바일 전용: 롱프레스 및 스와이프
  const [isDragReady, setIsDragReady] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const [swipeStart, setSwipeStart] = useState({ x: 0, y: 0, time: 0 });
  const [isSwipingToHide, setIsSwipingToHide] = useState(false);

  // 힌트 표시 (데스크톱만, 최초 1회)
  const [showHint, setShowHint] = useState(false);
  const [hasShownHint, setHasShownHint] = useState(false);
  const hintTimerRef = useRef<NodeJS.Timeout>();

  /**
   * 데스크톱: 마우스 호버 시 힌트 표시 (최초 1회만)
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
   * 더블클릭: 전체화면 전환
   */
  const handleDoubleClick = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    setIsDragReady(false);

    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
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
   * 데스크톱: 마우스 다운 - 즉시 드래그 시작
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  /**
   * 데스크톱: 마우스 업 - 드래그 종료
   */
  const handleMouseUp = () => {
    if (isMobile) return;
    setIsDragging(false);
  };

  /**
   * 데스크톱: 마우스 이동 - 드래그 중 위치 업데이트
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile || !isDragging) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    const maxX = window.innerWidth - pipSize.width;
    const maxY = window.innerHeight - pipSize.height - 80;

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  };

  /**
   * 모바일: 터치 시작 - 2초 롱프레스 시작 & 스와이프 준비
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;

    const touch = e.touches[0];
    setSwipeStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });

    // 2초 롱프레스 타이머
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
   * 모바일: 터치 종료 - 드래그 종료 또는 스와이프 처리
   */
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    if (isDragging) {
      setIsDragging(false);
      setIsDragReady(false);
    } else {
      // 스와이프 시도
      const touch = e.changedTouches[0];
      handleSwipeHide(touch.clientX, touch.clientY);
    }
  };

  /**
   * 모바일: 터치 이동 - 드래그 또는 스와이프 감지
   */
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 이동 시작 시 롱프레스 취소
    if (distance > 10 && longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }

    if (isDragging) {
      // 드래그 중
      const newX = touch.clientX - dragStart.x;
      const newY = touch.clientY - dragStart.y;
      const maxX = window.innerWidth - pipSize.width;
      const maxY = window.innerHeight - pipSize.height - 80;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    } else if (distance > 30) {
      // 스와이프 중 (화면 가장자리 근처에서만 힌트 표시)
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

  // 전역 마우스 이벤트 리스너 (드래그 중 화면 밖으로 나가도 추적)
  useEffect(() => {
    if (!isMobile && isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        const maxX = window.innerWidth - pipSize.width;
        const maxY = window.innerHeight - pipSize.height - 80;

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      };

      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };

      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isMobile, isDragging, dragStart, pipSize]);

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
        "border-primary/30 hover:border-primary/60",
        isDragging ? "cursor-grabbing scale-95 opacity-90 shadow-3xl" : "cursor-grab hover:scale-105",
        isMobile && isDragReady && !isDragging && "ring-4 ring-primary/60 animate-pulse"
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

      {/* 데스크톱: 드래그 힌트 (최초 호버 시 1회만) */}
      {!isMobile && showHint && !isDragging && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300 pointer-events-none">
          <div className="text-center px-4 space-y-2">
            <p className="text-white text-sm font-medium">
              💡 <strong>Drag</strong> to move
            </p>
            <p className="text-white text-sm font-medium">
              💡 <strong>Double-click</strong> for fullscreen
            </p>
          </div>
        </div>
      )}

      {/* 모바일: 롱프레스 진행 표시 */}
      {isMobile && !isDragReady && !isDragging && (
        <div className="absolute top-2 left-2 text-white text-xs bg-black/60 backdrop-blur-sm px-2 py-1 rounded pointer-events-none">
          Hold 2s to drag
        </div>
      )}

      {/* 모바일: 스와이프 숨김 피드백 (가장자리 근처에서만) */}
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
