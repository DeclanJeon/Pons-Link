// src/hooks/useAdaptiveLayout.ts

import { useState, useEffect } from 'react';
import { useDeviceType } from './useDeviceType';

export interface AdaptiveLayoutConfig {
  containerPadding: string;
  videoGap: string;
  controlBarHeight: string;
  minTouchTarget: number;
  fontSize: {
    base: string;
    heading: string;
    caption: string;
  };
  borderRadius: string;
  maxVideoWidth?: string;
}

export const useAdaptiveLayout = (): AdaptiveLayoutConfig => {
  const { isMobile, isTablet, width, orientation } = useDeviceType();
  
  const [config, setConfig] = useState<AdaptiveLayoutConfig>(() => 
    calculateLayout(isMobile, isTablet, width, orientation)
  );
  
  useEffect(() => {
    const handleResize = () => {
      setConfig(calculateLayout(isMobile, isTablet, width, orientation));
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isMobile, isTablet, width, orientation]);
  
  return config;
};

function calculateLayout(
  isMobile: boolean,
  isTablet: boolean,
  width: number,
  orientation: 'portrait' | 'landscape'
): AdaptiveLayoutConfig {
  // 모바일 세로 모드 (가장 제약적)
  if (isMobile && orientation === 'portrait') {
    return {
      containerPadding: '0.5rem',
      videoGap: '0.25rem',
      controlBarHeight: '60px',
      minTouchTarget: 44, // Apple HIG 권장
      fontSize: {
        base: '14px',
        heading: '18px',
        caption: '12px'
      },
      borderRadius: '8px',
      maxVideoWidth: '100%' // 전체 너비 사용
    };
  }
  
  // 모바일 가로 모드
  if (isMobile && orientation === 'landscape') {
    return {
      containerPadding: '0.5rem',
      videoGap: '0.5rem',
      controlBarHeight: '50px',
      minTouchTarget: 44,
      fontSize: {
        base: '14px',
        heading: '16px',
        caption: '11px'
      },
      borderRadius: '6px',
      maxVideoWidth: '70%' // 양쪽 여백 확보
    };
  }
  
  // 태블릿
  if (isTablet) {
    return {
      containerPadding: '1rem',
      videoGap: '0.75rem',
      controlBarHeight: '70px',
      minTouchTarget: 48,
      fontSize: {
        base: '15px',
        heading: '20px',
        caption: '13px'
      },
      borderRadius: '10px',
      maxVideoWidth: '80%'
    };
  }
  
  // 데스크톱 (기본)
  return {
    containerPadding: '1.5rem',
    videoGap: '1rem',
    controlBarHeight: '80px',
    minTouchTarget: 40,
    fontSize: {
      base: '16px',
      heading: '24px',
      caption: '14px'
    },
    borderRadius: '12px'
  };
}
