import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import { cn } from '@/lib/utils';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { EyeOff, Maximize2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPreview } from './VideoPreview';

/**
 * DraggableVideo Props 인터페이스
 *
 * @property stream - MediaStream 객체
 * @property nickname - 사용자 닉네임
 * @property isVideoEnabled - 비디오 활성화 상태
 * @property isLocalVideo - 로컬 비디오 여부
 * @property userId - 고유 식별자 (위치 저장용)
 * @property onHide - 숨김 콜백
 * @property onFocus - 포커스 콜백
 * @property canFocus - 포커스 가능 여부
 * @property isFocused - 현재 포커스 상태
 * @property stackIndex - 스택 내 위치 인덱스
 * @property stackGap - 스택 간 간격(px)
 * @property enableMobileDrag - 모바일 드래그 활성화 (기본값: false)
 */
interface DraggableVideoProps {
  stream: MediaStream | null;
  nickname: string;
  isVideoEnabled: boolean;
  isLocalVideo: boolean;
  userId: string;
  onHide?: () => void;
  onFocus?: () => void;
  canFocus?: boolean;
  isFocused?: boolean;
  stackIndex?: number;
  stackGap?: number;
  enableMobileDrag?: boolean;
}

/**
 * 디바이스 타입 감지 Hook
 *
 * useScreenOrientation과 통합하여 더 정확한 모바일 감지를 제공합니다.
 */
const useDeviceType = () => {
  const { isMobile: orientationMobile } = useScreenOrientation();
  const [isMobile, setIsMobile] = useState(orientationMobile);

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

  return isMobile || orientationMobile;
};

/**
 * PIP 크기 계산 Hook
 *
 * 디바이스 타입과 화면 크기에 따라 적응형 크기를 계산합니다.
 */
const usePIPSize = (isMobile: boolean): { width: number; height: number } => {
  const [pipSize, setPipSize] = useState({ width: 200, height: 140 });

  useEffect(() => {
    const updateSize = () => {
      const screenWidth = window.innerWidth;

      if (isMobile) {
        const width = Math.min(160, Math.max(120, screenWidth * 0.25));
        const height = (width / 4) * 3; // 4:3 비율 유지
        setPipSize({ width, height });
      } else {
        setPipSize({ width: 200, height: 140 });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isMobile]);

  return pipSize;
};

/**
 * 초기 위치 계산 함수
 *
 * Store에 저장된 위치를 우선 사용하고, 없으면 디바이스별 기본 위치를 계산합니다.
 */
const getInitialPosition = (
  isMobile: boolean,
  pipSize: { width: number; height: number },
  stackIndex: number,
  stackGap: number,
  savedPosition?: { x: number; y: number }
): { x: number; y: number } => {
  // 저장된 위치가 있으면 최우선 사용
  if (savedPosition) {
    return savedPosition;
  }

  if (isMobile) {
    // 모바일: 좌측 상단에서 우측으로 스택
    const mobileGap = 8;
    return {
      x: 16 + stackIndex * (pipSize.width + mobileGap),
      y: 16
    };
  } else {
    // 데스크톱: 우측 하단에서 위로 스택
    const baseX = window.innerWidth - pipSize.width - 20;
    const baseY = window.innerHeight - pipSize.height - 100;
    const y = Math.max(20, baseY - stackIndex * (pipSize.height + stackGap));
    return { x: baseX, y };
  }
};

/**
 * 위치 관리 Hook (Store 통합)
 *
 * Zustand Store와 연동하여 위치를 지속적으로 관리합니다.
 */
const usePosition = (
  userId: string,
  isMobile: boolean,
  pipSize: { width: number; height: number },
  isDragMode: boolean,
  stackIndex: number,
  stackGap: number
) => {
  const { pipPositions, setPIPPosition } = useUIManagementStore();
  const savedPosition = pipPositions[userId];

  const [position, setPosition] = useState(() =>
    getInitialPosition(isMobile, pipSize, stackIndex, stackGap, savedPosition)
  );

  const prevIsMobileRef = useRef(isMobile);

  // 디바이스 타입 변경 시 위치 재설정
  useEffect(() => {
    if (prevIsMobileRef.current !== isMobile) {
      const newPosition = getInitialPosition(
        isMobile,
        pipSize,
        stackIndex,
        stackGap,
        savedPosition
      );
      setPosition(newPosition);
      setPIPPosition(userId, newPosition);
      prevIsMobileRef.current = isMobile;
    }
  }, [isMobile, pipSize, stackIndex, stackGap, savedPosition, userId, setPIPPosition]);

  // 창 크기 조정 시 위치 제한
  useEffect(() => {
    const handleResize = () => {
      if (!isDragMode) {
        // 드래그 모드가 아니면 스택 위치로 재설정
        const newPosition = getInitialPosition(
          isMobile,
          pipSize,
          stackIndex,
          stackGap,
          savedPosition
        );
        setPosition(newPosition);
      } else {
        // 드래그 모드일 때는 화면 경계 내로 제한
        setPosition((prev) => {
          const maxX = window.innerWidth - pipSize.width - 20;
          const maxY = window.innerHeight - pipSize.height - 100;

          const bounded = {
            x: Math.max(20, Math.min(prev.x, maxX)),
            y: Math.max(20, Math.min(prev.y, maxY))
          };

          // 경계 조정된 위치를 Store에 저장
          if (bounded.x !== prev.x || bounded.y !== prev.y) {
            setPIPPosition(userId, bounded);
          }

          return bounded;
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, pipSize, isDragMode, stackIndex, stackGap, savedPosition, userId, setPIPPosition]);

  // 위치 업데이트 함수 (Store 동기화 포함)
  const updatePosition = useCallback(
    (newPosition: { x: number; y: number }) => {
      setPosition(newPosition);
      setPIPPosition(userId, newPosition);
    },
    [userId, setPIPPosition]
  );

  return [position, updatePosition] as const;
};

/**
 * 더블 클릭/탭 감지 Hook
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

/**
 * DraggableVideo 컴포넌트
 *
 * **통합된 주요 기능:**
 * - 롱프레스 드래그 활성화 (1초 홀드)
 * - Store 기반 위치 지속성
 * - 모바일/데스크톱 적응형 동작
 * - 스와이프 숨기기 (모바일)
 * - 더블 클릭/탭 전체화면
 * - 포커스 기능
 */
export const DraggableVideo = ({
  stream,
  nickname,
  isVideoEnabled,
  isLocalVideo,
  userId,
  onHide,
  onFocus,
  canFocus = false,
  isFocused = false,
  stackIndex = 0,
  stackGap = 12,
  enableMobileDrag = false
}: DraggableVideoProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useDeviceType();
  const pipSize = usePIPSize(isMobile);

  // 드래그 모드 상태
  const [isDragMode, setIsDragMode] = useState(false);
  const [position, updatePosition] = usePosition(
    userId,
    isMobile,
    pipSize,
    isDragMode,
    stackIndex,
    stackGap
  );

  // 드래그 진행 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  // 롱프레스 진행률
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const progressStartTimeRef = useRef<number>(0);
  const progressAnimationFrameRef = useRef<number>();

  // 스와이프 상태 (모바일)
  const [swipeStart, setSwipeStart] = useState({ x: 0, y: 0, time: 0 });
  const [isSwipingToHide, setIsSwipingToHide] = useState(false);

  // 터치/마우스 추적
  const interactionStartTimeRef = useRef<number>(0);
  const interactionStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedDuringInteractionRef = useRef(false);

  // 힌트 표시 (데스크톱)
  const [showHint, setShowHint] = useState(false);
  const [hasShownHint, setHasShownHint] = useState(false);
  const hintTimerRef = useRef<NodeJS.Timeout>();

  /**
   * 롱프레스 진행률 업데이트
   */
  const updateProgress = useCallback(() => {
    const activationTime = 1000;
    const elapsed = Date.now() - progressStartTimeRef.current;
    const newProgress = Math.min((elapsed / activationTime) * 100, 100);

    setLongPressProgress(newProgress);

    if (newProgress < 100) {
      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  /**
   * 롱프레스 시작
   */
  const startLongPress = useCallback(
    (clientX: number, clientY: number) => {
      // 모바일에서 드래그 비활성화된 경우 롱프레스 무시
      if (isMobile && !enableMobileDrag) return;

      setIsLongPressing(true);
      setLongPressProgress(0);
      progressStartTimeRef.current = Date.now();

      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);

      longPressTimerRef.current = setTimeout(() => {
        setIsDragMode(true);
        setIsDragging(true);
        setDragStart({
          x: clientX - position.x,
          y: clientY - position.y
        });
        setIsLongPressing(false);
        setLongPressProgress(100);

        if (progressAnimationFrameRef.current) {
          cancelAnimationFrame(progressAnimationFrameRef.current);
        }

        // 햅틱 피드백
        if (isMobile && 'vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }, 1000);
    },
    [position.x, position.y, isMobile, enableMobileDrag, updateProgress]
  );

  /**
   * 롱프레스 중지
   */
  const stopLongPress = useCallback(() => {
    setIsLongPressing(false);
    setLongPressProgress(0);

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    if (progressAnimationFrameRef.current) {
      cancelAnimationFrame(progressAnimationFrameRef.current);
    }
  }, []);

  /**
   * 전체화면 토글
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

  const handleDoubleInteraction = useDoubleClickTap(handleFullscreen);

  /**
   * 단일 클릭/탭 핸들러 (포커스)
   */
  const handleSingleClick = useCallback(() => {
    if (!hasMoved && canFocus && !isFocused && onFocus && !isDragMode) {
      onFocus();
    }
  }, [hasMoved, canFocus, isFocused, onFocus, isDragMode]);

  /**
   * 스와이프 숨기기 (모바일)
   */
  const handleSwipeHide = useCallback(
    (clientX: number, clientY: number) => {
      if (!isMobile || !onHide) return;

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

        updatePosition({
          x: position.x + hideDirection.x,
          y: position.y + hideDirection.y
        });

        setTimeout(() => onHide(), 300);
      }

      setIsSwipingToHide(false);
    },
    [swipeStart, position, pipSize, onHide, isMobile, updatePosition]
  );

  /**
   * 통합 인터랙션 시작 핸들러
   */
  const handleInteractionStart = (clientX: number, clientY: number) => {
    interactionStartTimeRef.current = Date.now();
    interactionStartPosRef.current = { x: clientX, y: clientY };
    hasMovedDuringInteractionRef.current = false;
    setHasMoved(false);

    if (isMobile) {
      setSwipeStart({ x: clientX, y: clientY, time: Date.now() });
    }

    startLongPress(clientX, clientY);
  };

  /**
   * 통합 인터랙션 이동 핸들러
   */
  const handleInteractionMove = (clientX: number, clientY: number) => {
    const deltaX = clientX - interactionStartPosRef.current.x;
    const deltaY = clientY - interactionStartPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 10px 이상 이동 시 롱프레스 취소
    if (distance > 10 && !isDragging) {
      hasMovedDuringInteractionRef.current = true;
      stopLongPress();
    }

    // 드래그 중일 때 위치 업데이트
    if (isDragging && isDragMode) {
      const newX = clientX - dragStart.x;
      const newY = clientY - dragStart.y;

      if (Math.abs(newX - position.x) > 5 || Math.abs(newY - position.y) > 5) {
        setHasMoved(true);
      }

      const maxX = window.innerWidth - pipSize.width - 20;
      const maxY = window.innerHeight - pipSize.height - 100;

      updatePosition({
        x: Math.max(20, Math.min(newX, maxX)),
        y: Math.max(20, Math.min(newY, maxY))
      });
    } else if (isMobile && distance > 30) {
      // 스와이프 숨기기 감지
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
   * 통합 인터랙션 종료 핸들러
   */
  const handleInteractionEnd = (clientX: number, clientY: number) => {
    stopLongPress();

    if (isDragging) {
      setIsDragging(false);
      setIsDragMode(false);
      return;
    }

    const interactionDuration = Date.now() - interactionStartTimeRef.current;
    const deltaX = clientX - interactionStartPosRef.current.x;
    const deltaY = clientY - interactionStartPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 짧은 탭/클릭 처리
    if (interactionDuration < 1000 && distance < 10 && !hasMovedDuringInteractionRef.current) {
      if (isDragMode) {
        setIsDragMode(false);
      } else {
        handleSingleClick();
      }
      return;
    }

    // 모바일 스와이프 숨기기
    if (isMobile) {
      handleSwipeHide(clientX, clientY);
    }
  };

  /**
   * 마우스 이벤트 핸들러
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    handleInteractionStart(e.clientX, e.clientY);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isMobile) return;
    handleInteractionEnd(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return;
    handleInteractionMove(e.clientX, e.clientY);
  };

  /**
   * 터치 이벤트 핸들러
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile && !enableMobileDrag) return;
    const touch = e.touches[0];
    handleInteractionStart(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile && !enableMobileDrag) return;
    const touch = e.changedTouches[0];
    handleInteractionEnd(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile && !enableMobileDrag) return;
    const touch = e.touches[0];
    handleInteractionMove(touch.clientX, touch.clientY);
  };

  /**
   * 더블 클릭 핸들러
   */
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    handleDoubleInteraction();
  };

  /**
   * 마우스 호버 핸들러 (힌트 표시)
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

  // 클린업
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
        'fixed rounded-lg overflow-hidden shadow-2xl border-2 z-40 transition-all duration-200',
        canFocus && !isFocused && !isDragMode
          ? 'border-primary/50 hover:border-primary cursor-pointer hover:scale-105'
          : 'border-primary/30 hover:border-primary/60',
        isDragMode && !isDragging && 'ring-2 ring-blue-500/60 cursor-move',
        isDragging && 'cursor-grabbing scale-95 opacity-90 shadow-3xl',
        isFocused && 'ring-2 ring-green-500/60',
        !isDragMode && !isDragging && canFocus && !isFocused && 'cursor-pointer'
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
        touchAction: isMobile && !enableMobileDrag ? 'auto' : 'none'
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

      {/* 롱프레스 진행률 표시 */}
      {isLongPressing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-sm z-50">
          <div className="relative w-20 h-20">
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

      {/* 컨트롤 버튼 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        <div className="absolute bottom-2 right-2 flex gap-2 pointer-events-auto">
          {canFocus && onFocus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFocus();
              }}
              className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label="Focus this participant"
            >
              <Maximize2 className="w-4 h-4 text-white" />
            </button>
          )}

          {onHide && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHide();
              }}
              className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label="Hide video"
            >
              <EyeOff className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* 포커스 힌트 오버레이 */}
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

      {/* 스와이프 숨기기 힌트 */}
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

      {/* 드래그 중 힌트 */}
      {isDragging && !isLongPressing && (
        <div className="absolute inset-0 border-2 border-primary/60 rounded-lg pointer-events-none z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary/90 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
            Release to place
          </div>
        </div>
      )}

      {/* 초기 힌트 메시지 */}
      {!isMobile && showHint && !isDragMode && !isLongPressing && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg pointer-events-none z-10">
          Hold 1s to move • Click to focus
        </div>
      )}

      {/* 드래그 인디케이터 */}
      {!isMobile && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-white/30 rounded-full" />
      )}
    </div>
  );
};
