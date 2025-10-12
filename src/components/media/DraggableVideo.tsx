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
 *    Hook
 * 
 *         .
 *       .
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
 * PIP   Hook
 * 
 *     PIP   .
 *    25%,    .
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
 *   
 * 
 *    PIP    .
 *   ,    .
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
 *   Hook
 * 
 * PIP  ,        .
 *         .
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
      // [수정 2-1] 드래그 모드가 아닐 때만 위치를 재설정하도록 로직을 단순화합니다.
      // 사용자가 드래그하여 위치를 옮긴 경우, 창 크기가 바뀌어도 그 위치를 최대한 유지하려 합니다.
      if (!isDragMode) {
        setPosition(getInitialPosition(isMobile, pipSize));
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
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, pipSize.width, pipSize.height, isDragMode]);

  return [position, setPosition] as const;
};

/**
 * /  Hook
 * 
 * 300ms      / .
 *       .
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

  //    (/ )
  const [isDragMode, setIsDragMode] = useState(false);
  const [position, setPosition] = usePosition(isMobile, pipSize, isDragMode);

  //  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  //   (0-100)
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  //     
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const progressStartTimeRef = useRef<number>(0);
  const progressAnimationFrameRef = useRef<number>();

  //  : 
  const [swipeStart, setSwipeStart] = useState({ x: 0, y: 0, time: 0 });
  const [isSwipingToHide, setIsSwipingToHide] = useState(false);

  //  :   
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedDuringTouchRef = useRef(false);

  //  :      
  const mouseDownTimeRef = useRef<number>(0);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const hasMovedDuringMouseRef = useRef(false);

  //  
  const [showHint, setShowHint] = useState(false);
  const [hasShownHint, setHasShownHint] = useState(false);
  const hintTimerRef = useRef<NodeJS.Timeout>();

  /**
   *    
   * 
   * requestAnimationFrame   60fps   .
   *      .
   */
  const updateProgress = useCallback(() => {
    // [수정 1-1] 활성화 시간을 1초로 변경
    const activationTime = 1000;
    const elapsed = Date.now() - progressStartTimeRef.current;
    const newProgress = Math.min((elapsed / activationTime) * 100, 100);
    
    setLongPressProgress(newProgress);

    if (newProgress < 100) {
      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  /**
   *  
   */
  const startLongPress = useCallback((clientX: number, clientY: number) => {
    setIsLongPressing(true);
    setLongPressProgress(0);
    progressStartTimeRef.current = Date.now();
    
    //   
    progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);

    // [수정 1-2] 활성화 시간을 2초에서 1초로 단축합니다.
    longPressTimerRef.current = setTimeout(() => {
      setIsDragMode(true);
      setIsDragging(true);
      setDragStart({
        x: clientX - position.x,
        y: clientY - position.y
      });
      setIsLongPressing(false);
      setLongPressProgress(100);
      
      //   
      if (progressAnimationFrameRef.current) {
        cancelAnimationFrame(progressAnimationFrameRef.current);
      }
      
      if (isMobile && 'vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      console.log('[DraggableVideo] Drag mode activated - ready to drag');
    }, 1000); // 2000ms -> 1000ms
  }, [position.x, position.y, isMobile, updateProgress]);

  /**
   *  
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
   *  
   * 
   * /  PIP   .
   *     .
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
   * / 
   */
  const handleDoubleInteraction = useDoubleClickTap(handleFullscreen);

  /**
   *    ( )
   * 
   *        .
   *       .
   */
  const handleSingleClick = useCallback(() => {
    if (!hasMoved && canFocus && !isFocused && onFocus && !isDragMode) {
      onFocus();
    }
  }, [hasMoved, canFocus, isFocused, onFocus, isDragMode]);

  /**
   * :   
   * 
   * 1       .
   *       .
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
   *   ( )
   * 
   *       PIP .
   *       .
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
  }, [swipeStart, position, pipSize, onHide, setPosition]);

  /**
   * :   (2    )
   * 
   *  2        .
   *         .
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;

    e.preventDefault();
    
    mouseDownTimeRef.current = Date.now();
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedDuringMouseRef.current = false;
    setHasMoved(false);

    //  
    startLongPress(e.clientX, e.clientY);
  };

  /**
   * :  
   * 
   *         .
   *      .
   */
  const handleMouseUp = (e: React.MouseEvent) => {
    if (isMobile) return;

    //  
    stopLongPress();

    // [수정 2-2] 드래그가 끝나면 위치를 유지하고, 드래그 모드만 비활성화합니다.
    if (isDragging) {
      setIsDragging(false);
      // setIsDragMode(false); // 드래그 모드를 유지하여 사용자가 다시 롱프레스 없이 움직일 수 있게 할 수도 있습니다. 여기서는 비활성화합니다.
      
      console.log(`[DraggableVideo] Drag finished. Position set to {x: ${position.x}, y: ${position.y}}`);
      return; // 여기서 함수를 종료하여 아래의 클릭 로직이 실행되지 않도록 합니다.
    }

    const mouseUpTime = Date.now();
    const pressDuration = mouseUpTime - mouseDownTimeRef.current;
    const deltaX = e.clientX - mouseDownPosRef.current.x;
    const deltaY = e.clientY - mouseDownPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 2        
    if (pressDuration < 1000 && distance < 10 && !hasMovedDuringMouseRef.current) {
        if (isDragMode) {
            setIsDragMode(false); // 드래그 모드에서 클릭하면 모드 해제
            console.log('[DraggableVideo] Drag mode deactivated by click.');
        } else {
            handleSingleClick();
        }
    }
  };

  /**
   * :  
   * 
   *       .
   *      .
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return;

    const deltaX = e.clientX - mouseDownPosRef.current.x;
    const deltaY = e.clientY - mouseDownPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 10px    
    if (distance > 10 && !isDragging) {
      hasMovedDuringMouseRef.current = true;
      stopLongPress();
    }

    //      
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
   * :  
   * 
   *         .
   * 2       .
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

    //  
    startLongPress(touch.clientX, touch.clientY);
  };

  /**
   * :  
   * 
   *    , ,   .
   *        .
   */
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;

    //  
    stopLongPress();

    // [수정 2-3] 드래그가 끝나면 위치를 유지하고, 드래그 모드만 비활성화합니다.
    if (isDragging) {
      setIsDragging(false);
      // setIsDragMode(false); // 마찬가지로 드래그 모드를 유지할지 결정할 수 있습니다.
      
      console.log(`[DraggableVideo] Mobile drag finished. Position set to {x: ${position.x}, y: ${position.y}}`);
      return;
    }

    const touch = e.changedTouches[0];
    const touchDuration = Date.now() - touchStartTimeRef.current;
    const deltaX = touch.clientX - touchStartPosRef.current.x;
    const deltaY = touch.clientY - touchStartPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (touchDuration < 1000 && distance < 10 && !hasMovedDuringTouchRef.current) {
        if (isDragMode) {
            setIsDragMode(false);
            console.log('[DraggableVideo] Mobile drag mode deactivated by tap.');
        } else if (canFocus && !isFocused && onFocus) {
            onFocus();
        }
        return;
    }

    handleSwipeHide(touch.clientX, touch.clientY);
  };

  /**
   * :  
   * 
   *       .
   *          .
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
   * : 
   * 
   *     .
   */
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    handleDoubleInteraction();
  };

  //  
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

      {/*    (  ) */}
      {isLongPressing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-sm z-50">
          <div className="relative w-20 h-20">
            {/*   */}
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
              {/*   */}
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
            {/*   */}
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
            {/* [수정 1-3] 힌트 텍스트도 1초로 변경 */}
            Hold to move ({Math.round(longPressProgress)}%)
          </div>
        </div>
      )}

      {/*   */}
      {canFocus && !isFocused && !isDragging && !isDragMode && !isLongPressing && (
        <div className="absolute inset-0 bg-primary/10 opacity-0 hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
          <div className="bg-primary/90 text-white px-3 py-1.5 rounded-full text-xs font-medium">
            {isMobile ? 'Tap to focus' : 'Click to focus'}
          </div>
        </div>
      )}

      {/*    */}
      {isFocused && !isLongPressing && (
        <div className="absolute top-2 right-2 bg-green-500/90 text-white px-2 py-1 rounded-full text-xs font-bold pointer-events-none z-10">
          Focused
        </div>
      )}

      {/* :    */}
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

      {/*    */}
      {isDragging && !isLongPressing && (
        <div className="absolute inset-0 border-2 border-primary/60 rounded-lg pointer-events-none z-10">
          {/* [수정 2-4] 드래그 중 힌트 텍스트를 "Release to place"로 변경 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary/90 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
            Release to place
          </div>
        </div>
      )}

      {/*   () */}
      {!isMobile && showHint && !isDragMode && !isLongPressing && (
        // [수정 1-4] 힌트 텍스트도 1초로 변경
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg pointer-events-none z-10">
          Hold 1s to move  Click to focus
        </div>
      )}
    </div>
  );
};
