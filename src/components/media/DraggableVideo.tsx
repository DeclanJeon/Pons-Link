import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import { cn } from '@/lib/utils';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { EyeOff, Maximize2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPreview } from './VideoPreview';

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
  isRelay?: boolean;
}

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

const usePIPSize = (isMobile: boolean): { width: number; height: number } => {
  const [pipSize, setPipSize] = useState({ width: 200, height: 140 });
  useEffect(() => {
    const updateSize = () => {
      const screenWidth = window.innerWidth;
      if (isMobile) {
        const width = Math.min(160, Math.max(120, screenWidth * 0.25));
        const height = (width / 4) * 3;
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

const getInitialPosition = (
  isMobile: boolean,
  pipSize: { width: number; height: number },
  stackIndex: number,
  stackGap: number,
  savedPosition?: { x: number; y: number }
): { x: number; y: number } => {
  if (savedPosition) {
    return savedPosition;
  }
  if (isMobile) {
    const mobileGap = 8;
    return { x: 16 + stackIndex * (pipSize.width + mobileGap), y: 16 };
  } else {
    const baseX = window.innerWidth - pipSize.width - 20;
    const baseY = window.innerHeight - pipSize.height - 100;
    const y = Math.max(20, Math.min(baseY - stackIndex * (pipSize.height + stackGap), window.innerHeight - pipSize.height - 20));
    return { x: baseX, y };
  }
};

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

  useEffect(() => {
    if (prevIsMobileRef.current !== isMobile) {
      const newPosition = getInitialPosition(isMobile, pipSize, stackIndex, stackGap, savedPosition);
      setPosition(newPosition);
      setPIPPosition(userId, newPosition);
      prevIsMobileRef.current = isMobile;
    }
  }, [isMobile, pipSize, stackIndex, stackGap, savedPosition, userId, setPIPPosition]);

  useEffect(() => {
    const handleResize = () => {
      if (!isDragMode) {
        const newPosition = getInitialPosition(isMobile, pipSize, stackIndex, stackGap, savedPosition);
        setPosition(newPosition);
      } else {
        setPosition((prev) => {
          const maxX = window.innerWidth - pipSize.width - 20;
          const maxY = window.innerHeight - pipSize.height - 100;
          const bounded = {
            x: Math.max(20, Math.min(prev.x, maxX)),
            y: Math.max(20, Math.min(prev.y, maxY))
          };
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

  const updatePosition = useCallback(
    (newPosition: { x: number; y: number }) => {
      setPosition(newPosition);
      setPIPPosition(userId, newPosition);
    },
    [userId, setPIPPosition]
  );

  return [position, updatePosition] as const;
};

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
  userId,
  onHide,
  onFocus,
  canFocus = false,
  isFocused = false,
  stackIndex = 0,
  stackGap = 12,
  enableMobileDrag = false,
  isRelay = false
}: DraggableVideoProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useDeviceType();
  const pipSize = usePIPSize(isMobile);
  const [isDragMode, setIsDragMode] = useState(false);
  const [position, updatePosition] = usePosition(userId, isMobile, pipSize, isDragMode, stackIndex, stackGap);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const progressStartTimeRef = useRef<number>(0);
  const progressAnimationFrameRef = useRef<number>();
  const [swipeStart, setSwipeStart] = useState({ x: 0, y: 0, time: 0 });
  const [isSwipingToHide, setIsSwipingToHide] = useState(false);
  const interactionStartTimeRef = useRef<number>(0);
  const interactionStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedDuringInteractionRef = useRef(false);
  const [showHint, setShowHint] = useState(false);
  const [hasShownHint, setHasShownHint] = useState(false);
  const hintTimerRef = useRef<NodeJS.Timeout>();

  const updateProgress = useCallback(() => {
    const activationTime = 1000;
    const elapsed = Date.now() - progressStartTimeRef.current;
    const newProgress = Math.min((elapsed / activationTime) * 100, 100);
    setLongPressProgress(newProgress);
    if (newProgress < 100) {
      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  const startLongPress = useCallback(
    (clientX: number, clientY: number) => {
      if (isMobile && !enableMobileDrag) return;
      setIsLongPressing(true);
      setLongPressProgress(0);
      progressStartTimeRef.current = Date.now();
      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
      longPressTimerRef.current = setTimeout(() => {
        setIsDragMode(true);
        setIsDraggingVideo(true);
        setDragStart({ x: clientX - position.x, y: clientY - position.y });
        setIsLongPressing(false);
        setLongPressProgress(100);
        if (progressAnimationFrameRef.current) {
          cancelAnimationFrame(progressAnimationFrameRef.current);
        }
        if (isMobile && 'vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }, 1000);
    },
    [position.x, position.y, isMobile, enableMobileDrag, updateProgress]
  );

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

  const handleSingleClick = useCallback(() => {
    if (!hasMoved && canFocus && !isFocused && onFocus && !isDragMode) {
      onFocus();
    }
  }, [hasMoved, canFocus, isFocused, onFocus, isDragMode]);

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
        updatePosition({ x: position.x + hideDirection.x, y: position.y + hideDirection.y });
        setTimeout(() => onHide(), 300);
      }
      setIsSwipingToHide(false);
    },
    [swipeStart, position, pipSize, onHide, isMobile, updatePosition]
  );

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

  const handleInteractionMove = (clientX: number, clientY: number) => {
    const deltaX = clientX - interactionStartPosRef.current.x;
    const deltaY = clientY - interactionStartPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > 10 && !isDraggingVideo) {
      hasMovedDuringInteractionRef.current = true;
      stopLongPress();
    }
    if (isDraggingVideo && isDragMode) {
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

  const handleInteractionEnd = (clientX: number, clientY: number) => {
    stopLongPress();
    if (isDraggingVideo) {
      setIsDraggingVideo(false);
      setIsDragMode(false);
      return;
    }
    const interactionDuration = Date.now() - interactionStartTimeRef.current;
    const deltaX = clientX - interactionStartPosRef.current.x;
    const deltaY = clientY - interactionStartPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (interactionDuration < 1000 && distance < 10 && !hasMovedDuringInteractionRef.current) {
      if (isDragMode) {
        setIsDragMode(false);
      } else {
        handleSingleClick();
      }
      return;
    }
    if (isMobile) {
      handleSwipeHide(clientX, clientY);
    }
  };

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

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    handleDoubleInteraction();
  };

  const handleMouseEnter = () => {};
  const handleMouseLeave = () => {};

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed rounded-lg overflow-hidden shadow-2xl border-2 z-40 transition-all duration-200',
        canFocus && !isFocused && !isDragMode
          ? 'border-primary/50 hover:border-primary cursor-pointer hover:scale-105'
          : 'border-primary/30 hover:border-primary/60',
        isDragMode && !isDraggingVideo && 'ring-2 ring-blue-500/60 cursor-move',
        isDraggingVideo && 'cursor-grabbing scale-95 opacity-90 shadow-3xl',
        isFocused && 'ring-2 ring-green-500/60',
        !isDragMode && !isDraggingVideo && canFocus && !isFocused && 'cursor-pointer'
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${pipSize.width}px`,
        height: `${pipSize.height}px`,
        transform: 'translateZ(0)',
        transition: isDraggingVideo ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
        isRelay={isRelay}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
        <div className="absolute bottom-2 right-2 flex gap-2 pointer-events-auto">
          {onFocus && (
            <button
              onClick={(e) => { e.stopPropagation(); onFocus(); }}
              className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label="Focus this participant"
            >
              <Maximize2 className="w-4 h-4 text-white" />
            </button>
          )}
          {onHide && (
            <button
              onClick={(e) => { e.stopPropagation(); onHide(); }}
              className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              aria-label="Hide video"
            >
              <EyeOff className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
