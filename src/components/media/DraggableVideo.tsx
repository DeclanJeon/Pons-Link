import { cn } from '@/lib/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoPreview } from './VideoPreview';

/**
 * DraggableVideo 컴포넌트의 Props 인터페이스
 *
 * @property stream - MediaStream 객체 (null 가능)
 * @property nickname - 사용자 닉네임
 * @property isVideoEnabled - 비디오 활성화 상태
 * @property isLocalVideo - 로컬 비디오 여부
 * @property onHide - 숨김 콜백 함수
 * @property onFocus - 포커스 콜백 함수
 * @property canFocus - 포커스 가능 여부 (기본값: false)
 * @property isFocused - 현재 포커스 상태 (기본값: false)
 * @property stackIndex - 스택 내 위치 인덱스 (기본값: 0)
 * @property stackGap - 스택 간 간격(px) (기본값: 12)
 */
interface DraggableVideoProps {
  stream: MediaStream | null;
  nickname: string;
  isVideoEnabled: boolean;
  isLocalVideo: boolean;
  onHide?: () => void;
  onFocus?: () => void;
  canFocus?: boolean;
  isFocused?: boolean;
  stackIndex?: number;
  stackGap?: number;
}

/**
 * 디바이스 타입 감지 Hook
 *
 * 터치 지원 여부와 화면 크기를 기반으로 모바일 환경을 판단합니다.
 * 768px 미만의 터치 지원 디바이스를 모바일로 분류합니다.
 *
 * @returns isMobile - 모바일 디바이스 여부
 */
const useDeviceType = (): boolean => {
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
 * 디바이스 타입에 따라 적절한 PIP(Picture-in-Picture) 크기를 계산합니다.
 * 모바일: 화면 너비의 25% (최소 120px, 최대 160px)
 * 데스크톱: 고정 크기 240x180px
 *
 * @param isMobile - 모바일 디바이스 여부
 * @returns pipSize - { width, height } 객체
 */
const usePIPSize = (isMobile: boolean): { width: number; height: number } => {
  const [pipSize, setPipSize] = useState({ width: 240, height: 180 });

  useEffect(() => {
    const updateSize = () => {
      const screenWidth = window.innerWidth;

      if (isMobile) {
        const width = Math.min(160, Math.max(120, screenWidth * 0.25));
        const height = (width / 4) * 3; // 4:3 비율 유지
        setPipSize({ width, height });
      } else {
        setPipSize({ width: 240, height: 180 });
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
 * 디바이스 타입과 스택 인덱스에 따라 PIP의 초기 위치를 계산합니다.
 * 모바일: 좌상단 (20, 20)
 * 데스크톱: 우하단 기준으로 스택 인덱스만큼 위로 배치
 *
 * @param isMobile - 모바일 디바이스 여부
 * @param pipSize - PIP 크기 객체
 * @param stackIndex - 스택 내 위치 인덱스
 * @param stackGap - 스택 간 간격(px)
 * @returns position - { x, y } 좌표 객체
 */
const getInitialPosition = (
  isMobile: boolean,
  pipSize: { width: number; height: number },
  stackIndex: number = 0,
  stackGap: number = 12
): { x: number; y: number } => {
  if (isMobile) {
    return { x: 20, y: 20 };
  } else {
    const baseX = window.innerWidth - pipSize.width - 20;
    const baseY = window.innerHeight - pipSize.height - 100;
    // 스택 인덱스에 따라 위로 배치 (화면 상단 20px 이하로는 내려가지 않음)
    const y = Math.max(20, baseY - stackIndex * (pipSize.height + stackGap));
    return { x: baseX, y };
  }
};

/**
 * 위치 관리 Hook
 *
 * PIP의 위치 상태를 관리하고, 디바이스 타입 변경 및 창 크기 조정 시
 * 위치를 재계산합니다. 드래그 모드일 때는 사용자 설정 위치를 유지합니다.
 *
 * @param isMobile - 모바일 디바이스 여부
 * @param pipSize - PIP 크기 객체
 * @param isDragMode - 드래그 모드 활성화 여부
 * @param stackIndex - 스택 내 위치 인덱스
 * @param stackGap - 스택 간 간격(px)
 * @returns [position, setPosition] - 위치 상태와 setter 함수
 */
const usePosition = (
  isMobile: boolean,
  pipSize: { width: number; height: number },
  isDragMode: boolean,
  stackIndex: number = 0,
  stackGap: number = 12
): readonly [{ x: number; y: number }, React.Dispatch<React.SetStateAction<{ x: number; y: number }>>] => {
  const [position, setPosition] = useState(() =>
    getInitialPosition(isMobile, pipSize, stackIndex, stackGap)
  );

  const prevIsMobileRef = useRef(isMobile);

  // 디바이스 타입 변경 감지 및 위치 재설정
  useEffect(() => {
    if (prevIsMobileRef.current !== isMobile) {
      console.log('[DraggableVideo] Device type changed, resetting position');
      setPosition(getInitialPosition(isMobile, pipSize, stackIndex, stackGap));
      prevIsMobileRef.current = isMobile;
    }
  }, [isMobile, pipSize, stackIndex, stackGap]);

  // 창 크기 조정 시 위치 재계산
  useEffect(() => {
    const handleResize = () => {
      if (!isDragMode) {
        // 드래그 모드가 아닐 때는 스택 위치로 재설정
        setPosition(getInitialPosition(isMobile, pipSize, stackIndex, stackGap));
      } else {
        // 드래그 모드일 때는 현재 위치를 화면 경계 내로 제한
        setPosition((prev) => {
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
    handleResize(); // 초기 실행
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, pipSize.width, pipSize.height, isDragMode, stackIndex, stackGap]);

  return [position, setPosition] as const;
};

/**
 * 더블 클릭/탭 감지 Hook
 *
 * 300ms 이내의 두 번의 클릭/탭을 감지하여 콜백 함수를 실행합니다.
 * 전체화면 토글 등의 제스처 기반 상호작용에 사용됩니다.
 *
 * @param callback - 더블 클릭/탭 시 실행할 함수
 * @returns handleInteraction - 클릭/탭 이벤트 핸들러
 */
const useDoubleClickTap = (callback: () => void): (() => void) => {
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
 * 드래그 가능한 PIP 비디오 플레이어를 제공합니다.
 * 주요 기능:
 * - 1초 롱프레스로 드래그 모드 활성화
 * - 모바일/데스크톱 환경 자동 감지 및 최적화
 * - 스택 기반 다중 PIP 배치 지원
 * - 더블 클릭/탭으로 전체화면 토글
 * - 스와이프로 숨기기 (모바일)
 * - 포커스 기능 (옵션)
 *
 * @param props - DraggableVideoProps 참조
 */
export const DraggableVideo = ({
  stream,
  nickname,
  isVideoEnabled,
  isLocalVideo,
  onHide,
  onFocus,
  canFocus = false,
  isFocused = false,
  stackIndex = 0,
  stackGap = 12
}: DraggableVideoProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useDeviceType();
  const pipSize = usePIPSize(isMobile);

  // 드래그 모드 상태 (롱프레스 후 활성화)
  const [isDragMode, setIsDragMode] = useState(false);
  const [position, setPosition] = usePosition(isMobile, pipSize, isDragMode, stackIndex, stackGap);

  // 드래그 진행 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  // 롱프레스 진행률 (0-100)
  const [longPressProgress, setLongPressProgress] = useState(0);
  const [isLongPressing, setIsLongPressing] = useState(false);

  // 롱프레스 타이머 및 애니메이션 참조
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const progressStartTimeRef = useRef<number>(0);
  const progressAnimationFrameRef = useRef<number>();

  // 스와이프 숨기기 상태 (모바일)
  const [swipeStart, setSwipeStart] = useState({ x: 0, y: 0, time: 0 });
  const [isSwipingToHide, setIsSwipingToHide] = useState(false);

  // 터치 이벤트 추적 변수
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const hasMovedDuringTouchRef = useRef(false);

  // 마우스 이벤트 추적 변수
  const mouseDownTimeRef = useRef<number>(0);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const hasMovedDuringMouseRef = useRef(false);

  // 힌트 표시 상태 (데스크톱)
  const [showHint, setShowHint] = useState(false);
  const [hasShownHint, setHasShownHint] = useState(false);
  const hintTimerRef = useRef<NodeJS.Timeout>();

  /**
   * 롱프레스 진행률 업데이트 함수
   *
   * requestAnimationFrame을 사용하여 60fps로 부드럽게 진행률을 업데이트합니다.
   * 1초 동안 0%에서 100%까지 증가합니다.
   */
  const updateProgress = useCallback(() => {
    const activationTime = 1000; // 1초
    const elapsed = Date.now() - progressStartTimeRef.current;
    const newProgress = Math.min((elapsed / activationTime) * 100, 100);

    setLongPressProgress(newProgress);

    if (newProgress < 100) {
      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);
    }
  }, []);

  /**
   * 롱프레스 시작 함수
   *
   * 1초 후 드래그 모드를 활성화하고, 진행률 애니메이션을 시작합니다.
   * 모바일 환경에서는 햅틱 피드백을 제공합니다.
   *
   * @param clientX - 클릭/터치 X 좌표
   * @param clientY - 클릭/터치 Y 좌표
   */
  const startLongPress = useCallback(
    (clientX: number, clientY: number) => {
      setIsLongPressing(true);
      setLongPressProgress(0);
      progressStartTimeRef.current = Date.now();

      // 진행률 애니메이션 시작
      progressAnimationFrameRef.current = requestAnimationFrame(updateProgress);

      // 1초 후 드래그 모드 활성화
      longPressTimerRef.current = setTimeout(() => {
        setIsDragMode(true);
        setIsDragging(true);
        setDragStart({
          x: clientX - position.x,
          y: clientY - position.y
        });
        setIsLongPressing(false);
        setLongPressProgress(100);

        // 애니메이션 중지
        if (progressAnimationFrameRef.current) {
          cancelAnimationFrame(progressAnimationFrameRef.current);
        }

        // 햅틱 피드백 (모바일)
        if (isMobile && 'vibrate' in navigator) {
          navigator.vibrate(50);
        }

        console.log('[DraggableVideo] Drag mode activated - ready to drag');
      }, 1000);
    },
    [position.x, position.y, isMobile, updateProgress]
  );

  /**
   * 롱프레스 중지 함수
   *
   * 진행 중인 롱프레스를 취소하고 모든 타이머와 애니메이션을 정리합니다.
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
   * 전체화면 토글 함수
   *
   * 더블 클릭/탭 시 PIP를 전체화면으로 전환하거나 해제합니다.
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
   * 더블 클릭/탭 핸들러
   */
  const handleDoubleInteraction = useDoubleClickTap(handleFullscreen);

  /**
   * 단일 클릭 핸들러 (포커스 기능)
   *
   * 드래그하지 않았고, 포커스 가능하며, 현재 포커스되지 않은 상태일 때만
   * 포커스 콜백을 실행합니다.
   */
  const handleSingleClick = useCallback(() => {
    if (!hasMoved && canFocus && !isFocused && onFocus && !isDragMode) {
      onFocus();
    }
  }, [hasMoved, canFocus, isFocused, onFocus, isDragMode]);

  /**
   * 마우스 호버 진입 핸들러 (데스크톱)
   *
   * 1초 후 힌트 메시지를 표시합니다 (최초 1회만).
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

  /**
   * 마우스 호버 이탈 핸들러 (데스크톱)
   *
   * 힌트 표시 타이머를 취소합니다.
   */
  const handleMouseLeave = () => {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
  };

  /**
   * 스와이프 숨기기 핸들러 (모바일)
   *
   * 화면 가장자리 근처에서 빠른 스와이프 동작을 감지하여
   * PIP를 화면 밖으로 이동시키고 숨김 콜백을 실행합니다.
   *
   * @param clientX - 터치 종료 X 좌표
   * @param clientY - 터치 종료 Y 좌표
   */
  const handleSwipeHide = useCallback(
    (clientX: number, clientY: number) => {
      const deltaX = clientX - swipeStart.x;
      const deltaY = clientY - swipeStart.y;
      const swipeTime = Date.now() - swipeStart.time;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const velocity = swipeTime > 0 ? distance / swipeTime : 0;

      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const edgeThreshold = 60;

      // 가장자리 근처 여부 판단
      const isNearEdge =
        position.x < edgeThreshold ||
        position.x > screenWidth - pipSize.width - edgeThreshold ||
        position.y < edgeThreshold ||
        position.y > screenHeight - pipSize.height - edgeThreshold;

      // 강한 스와이프 여부 판단 (80px 이상, 속도 0.4 이상)
      const isStrongSwipe = distance > 80 && velocity > 0.4;

      if (isNearEdge && isStrongSwipe) {
        // 스와이프 방향으로 화면 밖으로 이동
        const hideDirection = {
          x: deltaX < 0 ? -400 : deltaX > 0 ? 400 : 0,
          y: deltaY < 0 ? -400 : deltaY > 0 ? 400 : 0
        };

        setPosition((prev) => ({
          x: prev.x + hideDirection.x,
          y: prev.y + hideDirection.y
        }));

        setTimeout(() => onHide?.(), 300);
      }

      setIsSwipingToHide(false);
    },
    [swipeStart, position, pipSize, onHide, setPosition]
  );

  /**
   * 마우스 다운 핸들러 (데스크톱)
   *
   * 롱프레스를 시작하고, 클릭 추적을 위한 초기 상태를 설정합니다.
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
   * 마우스 업 핸들러 (데스크톱)
   *
   * 드래그 종료 또는 클릭 동작을 처리합니다.
   * 1초 미만의 짧은 클릭으로 드래그 모드를 해제하거나 포커스할 수 있습니다.
   */
  const handleMouseUp = (e: React.MouseEvent) => {
    if (isMobile) return;

    // 롱프레스 중지
    stopLongPress();

    // 드래그 종료
    if (isDragging) {
      setIsDragging(false);
      setIsDragMode(false);

      console.log(
        `[DraggableVideo] Drag finished. Position set to {x: ${position.x}, y: ${position.y}}`
      );
      return;
    }

    const mouseUpTime = Date.now();
    const pressDuration = mouseUpTime - mouseDownTimeRef.current;
    const deltaX = e.clientX - mouseDownPosRef.current.x;
    const deltaY = e.clientY - mouseDownPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 1초 미만의 짧은 클릭으로 드래그 모드 해제 또는 포커스
    if (pressDuration < 1000 && distance < 10 && !hasMovedDuringMouseRef.current) {
      if (isDragMode) {
        setIsDragMode(false);
        console.log('[DraggableVideo] Drag mode deactivated by click.');
      } else {
        handleSingleClick();
      }
    }
  };

  /**
   * 마우스 이동 핸들러 (데스크톱)
   *
   * 드래그 중일 때 PIP 위치를 업데이트합니다.
   * 10px 이상 이동 시 롱프레스를 취소합니다.
   */
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile) return;

    const deltaX = e.clientX - mouseDownPosRef.current.x;
    const deltaY = e.clientY - mouseDownPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 10px 이상 이동 시 롱프레스 취소
    if (distance > 10 && !isDragging) {
      hasMovedDuringMouseRef.current = true;
      stopLongPress();
    }

    // 드래그 모드에서 위치 업데이트
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
   * 터치 시작 핸들러 (모바일)
   *
   * 롱프레스와 스와이프 추적을 시작합니다.
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
   * 터치 종료 핸들러 (모바일)
   *
   * 드래그 종료, 탭, 또는 스와이프 숨기기를 처리합니다.
   */
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;

    // 롱프레스 중지
    stopLongPress();

    // 드래그 종료
    if (isDragging) {
      setIsDragging(false);
      setIsDragMode(false);

      console.log(
        `[DraggableVideo] Mobile drag finished. Position set to {x: ${position.x}, y: ${position.y}}`
      );
      return;
    }

    const touch = e.changedTouches[0];
    const touchDuration = Date.now() - touchStartTimeRef.current;
    const deltaX = touch.clientX - touchStartPosRef.current.x;
    const deltaY = touch.clientY - touchStartPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 1초 미만의 짧은 탭으로 드래그 모드 해제 또는 포커스
    if (touchDuration < 1000 && distance < 10 && !hasMovedDuringTouchRef.current) {
      if (isDragMode) {
        setIsDragMode(false);
        console.log('[DraggableVideo] Mobile drag mode deactivated by tap.');
      } else if (canFocus && !isFocused && onFocus) {
        onFocus();
      }
      return;
    }

    // 스와이프 숨기기 처리
    handleSwipeHide(touch.clientX, touch.clientY);
  };

  /**
   * 터치 이동 핸들러 (모바일)
   *
   * 드래그 중일 때 PIP 위치를 업데이트하거나,
   * 스와이프 숨기기 상태를 감지합니다.
   */
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartPosRef.current.x;
    const deltaY = touch.clientY - touchStartPosRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // 10px 이상 이동 시 롱프레스 취소
    if (distance > 10 && !isDragging) {
      hasMovedDuringTouchRef.current = true;
      stopLongPress();
    }

    // 드래그 모드에서 위치 업데이트
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
      // 스와이프 숨기기 상태 감지
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
   * 더블 클릭 핸들러 (데스크톱)
   */
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isMobile) return;
    e.preventDefault();
    handleDoubleInteraction();
  };

  // 클린업: 모든 타이머와 애니메이션 정리
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

      {/* 롱프레스 진행률 표시 (원형 프로그레스) */}
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
            {/* 드래그 아이콘 */}
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

      {/* 스와이프 숨기기 힌트 (모바일) */}
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

      {/* 초기 힌트 메시지 (데스크톱) */}
      {!isMobile && showHint && !isDragMode && !isLongPressing && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap shadow-lg pointer-events-none z-10">
          Hold 1s to move • Click to focus
        </div>
      )}
    </div>
  );
};
