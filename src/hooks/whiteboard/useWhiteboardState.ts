/**
 * @fileoverview 화이트보드 상태 관리 훅 (v3.8 - 무한 루프 수정)
 * @module hooks/whiteboard/useWhiteboardState
 */

import { useRef, useEffect, useState } from 'react';
import type Konva from 'konva';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';

export const useWhiteboardState = () => {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  
  // 이전 크기 저장 (중복 업데이트 방지)
  const prevSizeRef = useRef({ width: 0, height: 0 });

  const viewport = useWhiteboardStore(state => state.viewport);
  const setViewport = useWhiteboardStore(state => state.setViewport);
  const resetViewport = useWhiteboardStore(state => state.resetViewport);

  /**
   * ResizeObserver로 컨테이너 크기 변경 감지
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        // 크기가 실제로 변경되었는지 확인 (중복 방지)
        if (
          Math.abs(width - prevSizeRef.current.width) < 1 &&
          Math.abs(height - prevSizeRef.current.height) < 1
        ) {
          return;
        }
        
        console.log('[WhiteboardState] Container resized:', { width, height });
        
        // 이전 크기 업데이트
        prevSizeRef.current = { width, height };
        
        // Stage 크기만 직접 업데이트 (setState 호출 최소화)
        if (stageRef.current) {
          stageRef.current.width(width);
          stageRef.current.height(height);
          
          // Zustand 스토어 직접 업데이트 (리렌더링 최소화)
          useWhiteboardStore.setState((state) => ({
            viewport: {
              ...state.viewport,
              width,
              height
            }
          }));
          
          stageRef.current.batchDraw();
        }
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []); // 빈 의존성 배열 (한 번만 실행)

  /**
   * 초기 크기 설정
   */
  useEffect(() => {
    if (!containerRef.current || !stageRef.current) return;

    const width = containerRef.current.offsetWidth;
    const height = containerRef.current.offsetHeight;

    console.log('[WhiteboardState] Initial stage size:', { width, height });

    prevSizeRef.current = { width, height };

    stageRef.current.width(width);
    stageRef.current.height(height);

    useWhiteboardStore.setState((state) => ({
      viewport: {
        ...state.viewport,
        width,
        height
      }
    }));

    setIsReady(true);
  }, []); // 한 번만 실행

  /**
   * Window resize 이벤트 (백업)
   */
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !stageRef.current) return;

      const width = containerRef.current.offsetWidth;
      const height = containerRef.current.offsetHeight;

      // 크기 변경 확인
      if (
        Math.abs(width - prevSizeRef.current.width) < 1 &&
        Math.abs(height - prevSizeRef.current.height) < 1
      ) {
        return;
      }

      console.log('[WhiteboardState] Window resized:', { width, height });

      prevSizeRef.current = { width, height };

      stageRef.current.width(width);
      stageRef.current.height(height);

      useWhiteboardStore.setState((state) => ({
        viewport: {
          ...state.viewport,
          width,
          height
        }
      }));

      stageRef.current.batchDraw();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return {
    stageRef,
    containerRef,
    viewport,
    setViewport,
    resetViewport,
    isReady
  };
};
