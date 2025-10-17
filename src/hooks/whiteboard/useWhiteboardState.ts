// 📁 src/hooks/whiteboard/useWhiteboardState.ts

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * @hook useWhiteboardState
 * @description 캔버스의 핵심 상태(컨텍스트, 크기)와 생명주기를 관리합니다.
 *              고해상도 디스플레이 지원 및 반응형 크기 조정을 책임집니다.
 * @returns {object} 캔버스 참조, 컨텍스트, 준비 상태, 크기 정보.
 */
export const useWhiteboardState = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // 캔버스 초기화 및 반응형 크기 조정 로직
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    // willReadFrequently: false는 일부 브라우저에서 렌더링 성능을 향상시킬 수 있습니다.
    const ctx = canvas.getContext('2d', { willReadFrequently: false });

    if (!ctx) {
      console.error('[WhiteboardState] FATAL: Failed to get 2D context.');
      setIsCanvasReady(false);
      return;
    }

    // 고해상도 디스플레이(Retina 등) 대응을 위한 DPR(Device Pixel Ratio) 설정
    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // 실제 픽셀 크기를 설정하여 선명하게 렌더링
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // CSS 크기는 레이아웃에 맞게 유지
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // 모든 그리기에 DPR 스케일을 적용
      ctx.scale(dpr, dpr);
      
      setDimensions({ width: rect.width, height: rect.height });
      setContext(ctx);
      setIsCanvasReady(true);
      console.log(`[WhiteboardState] Canvas initialized. DPR: ${dpr}, Size: ${rect.width}x${rect.height}`);
    };

    setupCanvas();

    // ResizeObserver를 사용하여 캔버스 컨테이너의 크기 변경에 동적으로 반응
    const resizeObserver = new ResizeObserver(() => {
      // 리사이즈 시, 캔버스 설정 및 기존 드로잉을 다시 그려야 합니다.
      // 이 로직은 히스토리 훅과 연동될 때 완성됩니다.
      // 지금은 일단 재설정만 합니다.
      setupCanvas();
      // TODO: Phase 3에서 historyManager.redrawAll() 호출
    });

    resizeObserver.observe(canvas.parentElement!);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return {
    canvasRef,
    context,
    isCanvasReady,
    dimensions,
  };
};