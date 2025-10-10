import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { VideoPreview } from './VideoPreview';

interface DraggableVideoProps {
  stream: MediaStream | null;
  nickname: string;
  isVideoEnabled: boolean;
  isLocalVideo: boolean;
  onHide?: () => void;
}

export const DraggableVideo = ({
  stream,
  nickname,
  isVideoEnabled,
  isLocalVideo,
  onHide
}: DraggableVideoProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 힌트 표시 관련 상태
  const [isHovered, setIsHovered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintType, setHintType] = useState<'drag' | 'swipe' | null>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout>();
  const dragHoldTimerRef = useRef<NodeJS.Timeout>();

  // 스와이프 관련 상태
  const [swipeStart, setSwipeStart] = useState({ x: 0, y: 0, time: 0 });
  const [swipeDistance, setSwipeDistance] = useState({ x: 0, y: 0 });

  /**
   * 마우스 호버 시작: 2초 후 힌트 표시
   */
  const handleMouseEnter = () => {
    setIsHovered(true);

    // 2초 후 힌트 표시
    hoverTimerRef.current = setTimeout(() => {
      setHintType('drag');
      setShowHint(true);

      // 5초 후 힌트 숨김
      setTimeout(() => {
        setShowHint(false);
        setHintType(null);
      }, 5000);
    }, 2000);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowHint(false);
    setHintType(null);

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
  };

  /**
   * 더블클릭: 전체화면 전환
   */
  const handleDoubleClick = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  /**
   * 마우스 드래그 시작 (데스크톱)
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });

    // 스와이프 시작점 기록
    setSwipeStart({
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    });

    // 힌트 숨김
    setShowHint(false);
  };

  /**
   * 터치 드래그 시작 (모바일)
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();

    setSwipeStart({
      x: touch.clientX,
      y: touch.clientY,
      time: now
    });

    // 롱프레스 감지 (2초)
    dragHoldTimerRef.current = setTimeout(() => {
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      });

      // 햅틱 피드백 (지원 시)
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 2000);
  };

  /**
   * 마우스/터치 이동
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 150);
      const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 100) - 80;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    } else {
      // 드래그 중이 아닐 때 스와이프 거리 계산
      const deltaX = e.clientX - swipeStart.x;
      const deltaY = e.clientY - swipeStart.y;

      setSwipeDistance({ x: deltaX, y: deltaY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];

    if (isDragging) {
      // 드래그 모드
      const newX = touch.clientX - dragStart.x;
      const newY = touch.clientY - dragStart.y;

      const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 150);
      const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 100) - 80;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    } else {
      // 스와이프 거리 계산
      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;

      setSwipeDistance({ x: deltaX, y: deltaY });

      // 스와이프 시작 시 롱프레스 타이머 취소
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        if (dragHoldTimerRef.current) {
          clearTimeout(dragHoldTimerRef.current);
        }
      }
    }
  };

  /**
   * 마우스/터치 종료: 스와이프 숨김 처리
   */
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setSwipeDistance({ x: 0, y: 0 });
      return;
    }

    // 스와이프 숨김 처리
    handleSwipeHide();
  };

  const handleTouchEnd = () => {
    if (dragHoldTimerRef.current) {
      clearTimeout(dragHoldTimerRef.current);
    }

    if (isDragging) {
      setIsDragging(false);
      setSwipeDistance({ x: 0, y: 0 });
      return;
    }

    // 스와이프 숨김 처리
    handleSwipeHide();
  };

  /**
   * 스와이프 숨김 로직 (데스크톱/모바일 공통)
   */
  const handleSwipeHide = () => {
    const { x: deltaX, y: deltaY } = swipeDistance;
    const swipeTime = Date.now() - swipeStart.time;
    const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / swipeTime;

    // 스와이프 임계값
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const threshold = 80; // 80px 이상

    const isEdgeSwipe =
      (position.x < threshold && deltaX < -threshold) || // 왼쪽 끝
      (position.x > screenWidth - 200 && deltaX > threshold) || // 오른쪽 끝
      (position.y < threshold && deltaY < -threshold) || // 위쪽 끝
      (position.y > screenHeight - 200 && deltaY > threshold); // 아래쪽 끝

    if (isEdgeSwipe && velocity > 0.3) {
      // 숨김 애니메이션
      const hideDirection = {
        x: deltaX < 0 ? -300 : deltaX > 0 ? 300 : 0,
        y: deltaY < 0 ? -300 : deltaY > 0 ? 300 : 0
      };

      setPosition(prev => ({
        x: prev.x + hideDirection.x,
        y: prev.y + hideDirection.y
      }));

      setTimeout(() => {
        onHide?.();
      }, 300);
    }

    // 초기화
    setSwipeDistance({ x: 0, y: 0 });
  };

  /**
   * 마우스 드래그 이벤트 (데스크톱)
   */
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 150);
      const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 100) - 80;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        handleSwipeHide();
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart]);

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          "fixed rounded-lg overflow-hidden shadow-2xl border-2 z-40 transition-all duration-300",
          "w-32 h-24 sm:w-40 sm:h-28",
          "border-primary/30 hover:border-primary/60",
          isDragging && "cursor-grabbing scale-95 opacity-90",
          !isDragging && "cursor-grab"
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: isDragging ? 'none' : 'translateZ(0)',
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <VideoPreview
          stream={stream}
          nickname={nickname}
          isVideoEnabled={isVideoEnabled}
          isLocalVideo={isLocalVideo}
        />

        {/* 사용법 힌트 */}
        {showHint && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div className="text-center px-4 space-y-3">
              {hintType === 'drag' && (
                <>
                  <div className="text-white text-sm font-medium leading-relaxed">
                    <p className="mb-2">💡 <strong>Drag</strong> to move</p>
                    <p className="mb-2">💡 <strong>Double-click</strong> for fullscreen</p>
                    <p>💡 <strong>Swipe to edge</strong> to hide</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* 스와이프 피드백 (드래그 중이 아닐 때만) */}
        {!isDragging && Math.abs(swipeDistance.x) + Math.abs(swipeDistance.y) > 20 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(${
                swipeDistance.x < 0 ? '90deg' :
                swipeDistance.x > 0 ? '270deg' :
                swipeDistance.y < 0 ? '180deg' : '0deg'
              }, rgba(239, 68, 68, 0.3), transparent)`
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-xs font-bold bg-red-500/80 px-3 py-1 rounded-full">
                Swipe to hide
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
