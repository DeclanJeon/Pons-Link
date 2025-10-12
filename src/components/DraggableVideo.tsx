import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPreview } from './VideoPreview';

interface DraggableVideoProps {
  stream: MediaStream | null;
  nickname: string;
  isVideoEnabled: boolean;
  isLocalVideo: boolean;
  onHide?: () => void;
  onFocus?: () => void;
  canFocus?: boolean;
  isFocused?: boolean;
}

/**
 * 디바이스 타입 감지 Hook
 * 
 * 터치 지원 여부와 화면 크기를 기반으로 모바일 디바이스를 판별합니다.
 * 반응형 디자인의 기초가 되는 중요한 분기점을 제공합니다.
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
 * PIP 크기 계산 Hook
 * 
 * 디바이스 타입에 따라 적절한 PIP 크기를 동적으로 계산합니다.
 * 모바일에서는 화면 크기의 25%, 데스크톱에서는 고정 크기를 사용합니다.
 */
const usePIPSize = (isMobile: boolean) => {
  const [pipSize, setPipSize] = useState({ width: 240, height: 180 });

  useEffect(() => {
    const updateSize = () => {
      const screenWidth = window.innerWidth;

      if (isMobile) {
        const width = Math.min(160, Math.max(120, screenWidth * 0.25));
        const height = (width / 4) * 3;
        setPipSize({ width, height });
      } else {
        const width = 240;
        const height = 180;
        setPipSize({ width, height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isMobile]);

  return pipSize;
};

/**
 * 초기 위치 계산
 * 
 * 디바이스 타입에 따라 PIP의 초기 배치 위치를 결정합니다.
 * 모바일은 좌측 상단, 데스크톱은 우측 하단에 배치됩니다.
 */
const getInitialPosition = (
  isMobile: boolean, 
  pipSize: { width: number; height: number }
) => {
  if (isMobile) {
    return { x: 20, y: 20 };
  } else {
    const x = window.innerWidth - pipSize.width - 20;
    const y = window.innerHeight - pipSize.height - 100;
    return { x, y };
  }
};

/**
 * 위치 관리 Hook
 * 
 * PIP의 위치를 관리하고, 디바이스 타입 변경 및 화면 크기 변경에 대응합니다.
 * 데스크톱에서는 드래그 모드가 아닐 때 우측 하단으로 자동 재배치됩니다.
 */
const usePosition = (
  isMobile: boolean, 
  pipSize: { width: number; height: number },
  isDragMode: boolean
) => {
  const [position, setPosition] = useState(() => 
    getInitialPosition(isMobile, pipSize)
  );
  
  const prevIsMobileRef = useRef(isMobile);

  useEffect(() => {
    if (prevIsMobileRef.current !== isMobile) {
      console.log('[DraggableVideo] Device type changed, resetting position');
      setPosition(getInitialPosition(isMobile, pipSize));
      prevIsMobileRef.current = isMobile;
    }
  }, [isMobile, pipSize]);

  useEffect(() => {
    const handleResize = () => {
      if (isMobile) {
        setPosition(prev => {
          const maxX = window.innerWidth - pipSize.width - 20;
          const maxY = window.innerHeight - pipSize.height - 100;

          return {
            x: Math.max(20, Math.min(prev.x, maxX)),
            y: Math.max(20, Math.min(prev.y, maxY))
          };
        });
      } else {
        if (!isDragMode) {
          setPosition(getInitialPosition(false, pipSize));
        } else {
          setPosition(prev => {
            const maxX = window.innerWidth - pipSize.width - 20;
            const maxY = window.innerHeight - pipSize.height - 100;

            return {
              x: Math.max(20, Math.min(prev.x, maxX)),
              y: Math.max(20, Math.min(prev.y, maxY))
            };
          });
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, pipSize.width, pipSize.height, isDragMode]);

  return [position, setPosition] as const;
};

/**
 * 더블클릭/탭 감지 Hook
 * 
 * 300ms 이내의 두 번의 연속 상호작용을 더블클릭/탭으로 인식합니다.
 * 전체화면 토글과 같은 고급 기능 트리거에 사용됩니다.
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

  // 드래그 모드 상태 (데스크톱/모바일 공통)
  const [isDragMode, setIsDragMode] = useState(false);
  const [position, setPosition] = usePosition(isMobile, pipSize, isDragMode);

  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  // 롱프레스 진행률 (0-100)
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  // 롱프레스 타이머 및 진행률 업데이트
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const progressStartTimeRef = useRef<number>(0);
  const progressAnimationFrameRef = useRef<number>();

  // 모바일 전용: 스와이프
  const [swipeStart, setSwipeStart] = useState({ x: 0, y: 0, time: 0 });
  const [isSwipingToHide, setIsSwipingToHide] = useState(false);

  // 모바일 전용: 단일 탭 감지
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedDuringTouchRef = useRef(false);

  // 데스크톱 전용: 마우스 다운 시작 시간 및 위치
  const mouseDownTimeRef = useRef<number>(0);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const hasMovedDuringMouseRef = useRef(false);

  // 힌트 표시
  const [showHint, setShowHint] = useState(false);
  const [hasShownHint, setHasShownHint] = useState(false);
  const hintTimerRef = useRef<NodeJS.Timeout>();

  /**
   * 롱프레스 진행률 애니메이션 업데이트
   * 
   * requestAnimationFrame을 사용하여 부드러운 60fps 진행률 업데이트를 제공합니다.
   * 실제 경과 시간과 진행률을 정확히 동기화합니다.
   */
  const updateProgress = useCallback(() => {
    const elapsed = Date.now() - progressStartTimeRef.current;
    const newProgress = Math.min((elapsed / 2000) * 100, 100);
    
    setLongPressProgress(newProgress);

    if (newProgress < 100) {
      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  /**
   * 롱프레스 시작
   */
  const startLongPress = useCallback((clientX: number, clientY: number) => {
    setIsLongPressing(true);
    setLongPressProgress(0);
    progressStartTimeRef.current = Date.now();
    
    // 진행률 애니메이션 시작
    progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);

    // 정확히 2초 후 드래그 모드 활성화
    longPressTimerRef.current = setTimeout(() => {
      setIsDragMode(true);
      setIsDragging(true);
      setDragStart({
        x: clientX - position.x,
        y: clientY - position.y
      });
      setIsLongPressing(false);
      setLongPressProgress(100);
      
      // 진행률 애니메이션 중지
      if (progressAnimationFrameRef.current) {
        cancelAnimationFrame(progressAnimationFrameRef.current);
      }
      
      if (isMobile && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      console.log('[DraggableVideo] Drag mode activated - ready to drag');
    }, 2000);
  }, [position.x, position.y, isMobile, updateProgress]);

  /**
   * 롱프레스 중지
   */
  const stopLongPress = useCallback(() => {
    setIsLongPressing(false);
    setLongPressProgress(0);
    
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
    
    if (progressAnimationFrameRef.current) {
      cancelAnimationFrame(progressAnimationFrameRef.current);
      progressAnimationFrameRef.current = undefined;
    }
  }, []);

  /**
   * 전체화면 토글
   * 
   * 더블클릭/탭 시 PIP를 전체화면으로 전환하거나 해제합니다.
   * 몰입형 비디오 시청 경험을 제공합니다.
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
   * 더블클릭/탭 핸들러
   */
  const handleDoubleInteraction = useDoubleClickTap(handleFullscreen);

  /**
   * 단일 클릭 핸들러 (포커스 전환)
   * 
   * 드래그가 발생하지 않은 단순 클릭 시 포커스를 전환합니다.
   * 사용자가 특정 참가자에게 주목하고 싶을 때 사용됩니다.
   */
  const handleSingleClick = useCallback(() => {
    if (!hasMoved && canFocus && !isFocused && onFocus && !isDragMode) {
      onFocus();
    }
  }, [hasMoved, canFocus, isFocused, onFocus, isDragMode]);

  /**
   * 데스크톱: 마우스 호버 힌트
   * 
   * 1초간 호버 시 사용 가능한 기능을 힌트로 표시합니다.
   * 사용자가 기능을 발견하고 학습하는 데 도움을 줍니다.
   */
  const handleMouseEnter = () => {
    if (!isMobile && !hasShownHint && !isDragMode) {
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
   * 
   * 화면 가장자리에서 강한 스와이프 제스처를 감지하여 PIP를 숨깁니다.
   * 속도와 거리를 모두 고려하여 의도적인 제스처만 인식합니다.
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
   * 데스크톱: 마우스 다운 (2초 롱프레스로 드래그 모드 활성화)
   * 
   * 마우스를 2초간 누르고 있으면 드래그 모드가 활성화되고 즉시 드래그를 시작합니다.
   * 진행률 표시를 통해 사용자가 활성화 시점을 예측할 수 있습니다.
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;

    e.preventDefault();
    
    mouseDownTimeRef.current = Date.now();
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedDuringMouseRef.current = false;
    setHasMoved(false);

    // 롱프레스 시작
    startLongPress(e.clientX, e.clientY);
  };

  /**
   * 데스크톱: 마우스 업
   * 
   * 마우스 버튼을 놓으면 드래그 모드를 종료하고 기본 위치로 복귀합니다.
   * 단순 클릭의 경우 포커스 전환을 시도합니다.
   */
  const handleMouseUp = (e: React.MouseEvent) => {
    if (isMobile) return;

    // 롱프레스 중지
    stopLongPress();

    // 드래그 중이었다면 드래그 모드 종료 및 기본 위치 복귀
    if (isDragging) {
      setIsDragging(false);
      setIsDragMode(false);
      
      // 기본 위치로 애니메이션과 함께 복귀
      setTimeout(() => {
        setPosition(getInitialPosition(false, pipSize));
      }, 50);
      
      console.log('[DraggableVideo] Drag mode deactivated - returning to default position');
      return;
    }

    const mouseUpTime = Date.now();
    const pressDuration = mouseUpTime - mouseDownTimeRef.current;
    const deltaX = e.clientX - mouseDownPosRef.current.x;
    const deltaY = e.clientY - mouseDownPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 2초 미만의 짧은 클릭이고 거의 이동하지 않았다면 포커스 전환
    if (pressDuration < 2000 && distance < 10 && !hasMovedDuringMouseRef.current) {
      handleSingleClick();
    }
  };

  /**
   * 데스크톱: 마우스 이동
   * 
   * 드래그 모드가 활성화된 상태에서 마우스 이동을 처리합니다.
   * 화면 경계를 벗어나지 않도록 위치를 제한합니다.
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return;

    const deltaX = e.clientX - mouseDownPosRef.current.x;
    const deltaY = e.clientY - mouseDownPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 10px 이상 이동하면 롱프레스 취소
    if (distance > 10 && !isDragging) {
      hasMovedDuringMouseRef.current = true;
      stopLongPress();
    }

    // 드래그 모드에서 드래그 중일 때만 이동
    if (isDragging && isDragMode) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
        setHasMoved(true);
      }

      const maxX = window.innerWidth - pipSize.width - 20;
      const maxY = window.innerHeight - pipSize.height - 100;

      setPosition({
        x: Math.max(20, Math.min(newX, maxX)),
        y: Math.max(20, Math.min(newY, maxY))
      });
    }
  };

  /**
   * 모바일: 터치 시작
   * 
   * 터치 시작 시 롱프레스 타이머를 설정하고 스와이프 감지를 준비합니다.
   * 2초 롱프레스로 드래그 모드를 활성화하고 즉시 드래그를 시작합니다.
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;

    const touch = e.touches[0];
    
    touchStartTimeRef.current = Date.now();
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    hasMovedDuringTouchRef.current = false;

    setSwipeStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });
    setHasMoved(false);

    // 롱프레스 시작
    startLongPress(touch.clientX, touch.clientY);
  };

  /**
   * 모바일: 터치 종료
   * 
   * 터치 종료 시 드래그, 탭, 스와이프를 구분하여 처리합니다.
   * 드래그 중이었다면 드래그 모드를 종료하고 기본 위치로 복귀합니다.
   */
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;

    // 롱프레스 중지
    stopLongPress();

    // 드래그 중이었다면 드래그 모드 종료
    if (isDragging) {
      setIsDragging(false);
      setIsDragMode(false);
      
      // 기본 위치로 애니메이션과 함께 복귀
      setTimeout(() => {
        setPosition(getInitialPosition(true, pipSize));
      }, 50);
      
      console.log('[DraggableVideo] Mobile drag mode deactivated - returning to default position');
      return;
    }

    const touch = e.changedTouches[0];
    const touchDuration = Date.now() - touchStartTimeRef.current;
    const deltaX = touch.clientX - touchStartPosRef.current.x;
    const deltaY = touch.clientY - touchStartPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (touchDuration < 2000 && distance < 10 && !hasMovedDuringTouchRef.current) {
      if (canFocus && !isFocused && onFocus && !isDragMode) {
        onFocus();
        return;
      }
    }

    handleSwipeHide(touch.clientX, touch.clientY);
  };

  /**
   * 모바일: 터치 이동
   * 
   * 터치 이동을 감지하여 드래그 또는 스와이프를 처리합니다.
   * 의도하지 않은 롱프레스를 방지하기 위해 이동 감지 시 타이머를 취소합니다.
   */
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartPosRef.current.x;
    const deltaY = touch.clientY - touchStartPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 10 && !isDragging) {
      hasMovedDuringTouchRef.current = true;
      stopLongPress();
    }

    if (isDragging && isDragMode) {
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
   * 데스크톱: 더블클릭
   * 
   * 더블클릭 시 전체화면 모드를 토글합니다.
   */
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    handleDoubleInteraction();
  };

  // 정리 작업
  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (progressAnimationFrameRef.current) {
        cancelAnimationFrame(progressAnimationFrameRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed rounded-lg overflow-hidden shadow-2xl border-2 z-40 transition-all duration-200",
        canFocus && !isFocused && !isDragMode
          ? "border-primary/50 hover:border-primary cursor-pointer hover:scale-105"
          : "border-primary/30 hover:border-primary/60",
        isDragMode && !isDragging && "ring-2 ring-blue-500/60 cursor-move",
        isDragging && "cursor-grabbing scale-95 opacity-90 shadow-3xl",
        isFocused && "ring-2 ring-green-500/60",
        !isDragMode && !isDragging && canFocus && !isFocused && "cursor-pointer"
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${pipSize.width}px`,
        height: `${pipSize.height}px`,
        transform: 'translateZ(0)',
        transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: isMobile ? 'none' : 'auto'
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

      {/* 롱프레스 진행률 표시 (원형 프로그레스 바) */}
      {isLongPressing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-sm z-50">
          <div className="relative w-20 h-20">
            {/* 배경 원 */}
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-gray-700"
              />
              {/* 진행률 원 */}
              <circle
                cx="40"
                cy="40"
                r="36"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - longPressProgress / 100)}`}
                className="text-primary transition-none"
                strokeLinecap="round"
              />
            </svg>
            {/* 중앙 아이콘 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                />
              </svg>
            </div>
          </div>
          <div className="absolute bottom-6 text-white text-xs font-bold bg-primary/90 px-3 py-1.5 rounded-full shadow-lg">
            Hold to move ({Math.round(longPressProgress)}%)
          </div>
        </div>
      )}

      {/* 포커스 힌트 */}
      {canFocus && !isFocused && !isDragging && !isDragMode && !isLongPressing && (
        <div className="absolute inset-0 bg-primary/10 opacity-0 hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
          <div className="bg-primary/90 text-white px-3 py-1.5 rounded-full text-xs font-medium">
            {isMobile ? 'Tap to focus' : 'Click to focus'}
          </div>
        </div>
      )}

      {/* 포커스 상태 표시 */}
      {isFocused && !isLongPressing && (
        <div className="absolute top-2 right-2 bg-green-500/90 text-white px-2 py-1 rounded-full text-xs font-bold pointer-events-none z-10">
          Focused
        </div>
      )}

      {/* 모바일: 스와이프 숨기기 힌트 */}
      {isMobile && !isDragging && isSwipingToHide && !isLongPressing && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center z-10"
          style={{
            background: 'linear-gradient(to bottom, rgba(239, 68, 68, 0.4), transparent)'
          }}
        >
          <div className="text-white text-sm font-bold bg-red-500/90 px-4 py-2 rounded-full shadow-lg">
            Swipe to hide
          </div>
        </div>
      )}

      {/* 드래그 중 표시 */}
      {isDragging && !isLongPressing && (
        <div className="absolute inset-0 border-2 border-primary/60 rounded-lg pointer-events-none z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary/90 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
            Release to return
          </div>
        </div>
      )}

      {/* 초기 힌트 (데스크톱) */}
      {!isMobile && showHint && !isDragMode && !isLongPressing && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg pointer-events-none z-10">
          Hold 2s to move • Click to focus
        </div>
      )}
    </div>
  );
};
