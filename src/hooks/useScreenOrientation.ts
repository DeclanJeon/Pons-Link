// hooks/useScreenOrientation.ts
import { useEffect, useState } from 'react';

/**
 * Screen Orientation Detection Hook
 *
 * Detects device type and orientation to optimize layout:
 * - Mobile Portrait: Vertical stacking layout
 * - Mobile Landscape: Horizontal layout similar to desktop
 * - Desktop: Standard grid layout
 *
 * @returns {Object} Screen orientation information
 */
export const useScreenOrientation = () => {
  const [orientation, setOrientation] = useState<{
    isMobile: boolean;
    isPortrait: boolean;
    isLandscape: boolean;
    width: number;
    height: number;
  }>({
    isMobile: false,
    isPortrait: false,
    isLandscape: false,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const updateOrientation = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width < 768; // 768px 미만을 모바일로 간주
      const isPortrait = height > width;
      const isLandscape = width >= height;

      setOrientation({
        isMobile,
        isPortrait: isMobile && isPortrait,
        isLandscape: isMobile && isLandscape,
        width,
        height,
      });

      console.log('[useScreenOrientation]', {
        isMobile,
        isPortrait: isMobile && isPortrait,
        isLandscape: isMobile && isLandscape,
        dimensions: `${width}x${height}`,
      });
    };

    updateOrientation();

    // 리사이즈 및 방향 변경 이벤트 리스너
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  return orientation;
};
