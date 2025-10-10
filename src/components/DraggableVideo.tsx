// src/components/DraggableVideo.tsx - 데스크톱/모바일 통합

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

  // 🎯 호버 및 제스처 힌트 상태
  const [isHovered, setIsHovered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout>();

  // 🎯 마우스 홀드 타이머 (데스크톱)
  const mouseHoldTimerRef = useRef<NodeJS.Timeout>();
  const [isMouseHolding, setIsMouseHolding] = useState(false);

  // 🎯 터치 홀드 타이머 (모바일)
  const touchHoldTimerRef = useRef<NodeJS.Timeout>();

  // 🎯 스와이프 감지 (마우스/터치 공통)
  const [swipeStart, setSwipeStart] = useState({ x: 0, y: 0, time: 0 });
  const [swipeDistance, setSwipeDistance] = useState({ x: 0, y: 0 });
  const [isSwiping, setIsSwiping] = useState(false);

  /**
   * 🎯 호버 시작: 2초 후 제스처 힌트 표시
   */
  const handleMouseEnter = () => {
    setIsHovered(true);

    // 2초 후 힌트 표시
    hoverTimerRef.current = setTimeout(() => {
      setShowHint(true);

      // 5초 후 힌트 자동 숨김
      setTimeout(() => {
        setShowHint(false);
      }, 5000);
    }, 2000);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowHint(false);

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    // 마우스 홀드 타이머 취소
    if (mouseHoldTimerRef.current) {
      clearTimeout(mouseHoldTimerRef.current);
    }
    setIsMouseHolding(false);
  };

  /**
   * 🎯 더블 클릭: 전체화면 전환
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
   * 🎯 마우스 다운: 2초 홀드 후 드래그 활성화 (데스크톱)
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;

    setSwipeStart({
      x: startX,
      y: startY,
      time: Date.now()
    });

    setIsMouseHolding(true);

    // 2초 홀드 타이머
    mouseHoldTimerRef.current = setTimeout(() => {
      setIsDragging(true);
      setDragStart({
        x: startX - position.x,
        y: startY - position.y
      });
      setShowHint(false);
      setIsMouseHolding(false);
    }, 2000);
  };

  /**
   * 🎯 마우스 무브: 드래그 또는 스와이프 처리
   */
  const handleMouseMoveGlobal = (e: MouseEvent) => {
    if (isDragging) {
      // 드래그 모드
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 150);
      const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 100) - 80;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    } else if (isMouseHolding) {
      // 스와이프 거리 측정
      const deltaX = e.clientX - swipeStart.x;
      const deltaY = e.clientY - swipeStart.y;

      setSwipeDistance({ x: deltaX, y: deltaY });

      // 홀드 타이머 취소 (이동 시작 시)
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        if (mouseHoldTimerRef.current) {
          clearTimeout(mouseHoldTimerRef.current);
        }
        setIsSwiping(true);
      }
    }
  };

  /**
   * 🎯 마우스 업: 드래그 종료 또는 스와이프 감지
   */
  const handleMouseUpGlobal = () => {
    if (mouseHoldTimerRef.current) {
      clearTimeout(mouseHoldTimerRef.current);
    }

    if (isDragging) {
      setIsDragging(false);
      setIsMouseHolding(false);
      return;
    }

    if (isSwiping) {
      checkSwipeToHide();
    }

    // 리셋
    setIsMouseHolding(false);
    setIsSwiping(false);
    setSwipeDistance({ x: 0, y: 0 });
  };

  /**
   * 🎯 터치 시작 (모바일)
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();

    setSwipeStart({
      x: touch.clientX,
      y: touch.clientY,
      time: now
    });

    // 2초 홀드 타이머
    touchHoldTimerRef.current = setTimeout(() => {
      setIsDragging(true);
      setDragStart({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      });

      // 햅틱 피드백
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, 2000);
  };

  /**
   * 🎯 터치 이동
   */
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
      // 스와이프 거리 측정
      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;

      setSwipeDistance({ x: deltaX, y: deltaY });

      // 홀드 타이머 취소 (이동 시작 시)
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        if (touchHoldTimerRef.current) {
          clearTimeout(touchHoldTimerRef.current);
        }
        setIsSwiping(true);
      }
    }
  };

  /**
   * 🎯 터치 종료
   */
  const handleTouchEnd = () => {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
    }

    if (isDragging) {
      setIsDragging(false);
      return;
    }

    if (isSwiping) {
      checkSwipeToHide();
    }

    // 리셋
    setIsSwiping(false);
    setSwipeDistance({ x: 0, y: 0 });
  };

  /**
   * 🎯 스와이프 숨김 처리 (공통 로직)
   */
  const checkSwipeToHide = () => {
    const { x: deltaX, y: deltaY } = swipeDistance;
    const swipeTime = Date.now() - swipeStart.time;
    const velocity = Math.sqrt(deltaX * deltaX + deltaY * deltaY) / swipeTime;

    // 화면 경계로 스와이프 감지
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const threshold = 80; // 80px 이상 스와이프

    const isEdgeSwipe =
      (position.x < threshold && deltaX < -threshold) || // 좌측 끝에서 왼쪽으로
      (position.x > screenWidth - 200 && deltaX > threshold) || // 우측 끝에서 오른쪽으로
      (position.y < threshold && deltaY < -threshold) || // 상단 끝에서 위로
      (position.y > screenHeight - 200 && deltaY > threshold); // 하단 끝에서 아래로

    if (isEdgeSwipe && velocity > 0.3) {
      // 스와이프 애니메이션과 함께 숨김
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
  };

  /**
   * 🎯 글로벌 마우스 이벤트 리스너
   */
  useEffect(() => {
    if (isDragging || isMouseHolding) {
      document.addEventListener('mousemove', handleMouseMoveGlobal);
      document.addEventListener('mouseup', handleMouseUpGlobal);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMoveGlobal);
      document.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, [isDragging, isMouseHolding, dragStart, swipeStart, swipeDistance]);

  /**
   * 🎯 클린업
   */
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (mouseHoldTimerRef.current) clearTimeout(mouseHoldTimerRef.current);
      if (touchHoldTimerRef.current) clearTimeout(touchHoldTimerRef.current);
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          "fixed rounded-lg overflow-hidden shadow-2xl border-2 z-40 transition-all duration-300",
          "w-32 h-24 sm:w-40 sm:h-28",
          "border-primary/30 hover:border-primary/60",
          isDragging && "cursor-grabbing scale-95 opacity-90",
          isMouseHolding && !isDragging && "cursor-wait scale-98",
          !isDragging && !isMouseHolding && "cursor-pointer"
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
          hideNickname={true}
        />

        {/* 🎯 제스처 힌트 오버레이 */}
        {showHint && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div className="text-center px-4 space-y-3">
              <div className="text-white text-sm font-medium leading-relaxed">
                <p className="mb-2">🖱️ <strong>Hold 2s</strong> to drag</p>
                <p className="mb-2">🖱️ <strong>Double-click</strong> for fullscreen</p>
                <p>👆 <strong>Swipe to edge</strong> to hide</p>
              </div>
            </div>
          </div>
        )}

        {/* 🎯 홀드 진행 표시 (데스크톱) */}
        {isMouseHolding && !isDragging && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="relative w-16 h-16">
              {/* 원형 진행 바 */}
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="hsl(var(--primary))"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray="176"
                  strokeDashoffset="176"
                  className="animate-[dash_2s_linear_forwards]"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-xs font-bold">Hold</span>
              </div>
            </div>
          </div>
        )}

        {/* 🎯 스와이프 인디케이터 (마우스/터치 공통) */}
        {isSwiping && !isDragging && Math.abs(swipeDistance.x) + Math.abs(swipeDistance.y) > 20 && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-150"
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

      {/* 🎯 CSS 애니메이션 정의 */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </>
  );
};
