import { useEffect, useState } from 'react';
import { useScreenOrientation } from './useScreenOrientation';

export const useResponsiveVideoGrid = (participantCount: number) => {
  const { isMobile, isPortrait, isLandscape, width, height } = useScreenOrientation();

  const [gridConfig, setGridConfig] = useState({
    layout: 'grid' as 'grid' | 'flex-col' | 'custom-3' | 'custom-4',
    gridClass: '',
    containerClass: '',
    itemClass: '',
    gap: 'gap-2',
  });

  useEffect(() => {
    let config = {
      layout: 'grid' as 'grid' | 'flex-col' | 'custom-3' | 'custom-4',
      gridClass: '',
      containerClass: '',
      itemClass: '',
      gap: 'gap-2',
    };

    // ============================================================
    // 모바일 세로 모드
    // ============================================================
    if (isPortrait) {
      if (participantCount === 1) {
        config = {
          layout: 'flex-col',
          gridClass: '',
          containerClass: 'flex flex-col h-full p-2',
          itemClass: 'w-full h-full',
          gap: 'gap-2',
        };
      } else if (participantCount === 2) {
        config = {
          layout: 'flex-col',
          gridClass: '',
          containerClass: 'flex flex-col h-full p-2',
          itemClass: 'w-full flex-1 min-h-0',
          gap: 'gap-2',
        };
      } else if (participantCount === 3) {
        // ✅ 상단 1개, 하단 2개
        config = {
          layout: 'custom-3',
          gridClass: '',
          containerClass: 'flex flex-col h-full p-2',
          itemClass: '',
          gap: 'gap-2',
        };
      } else {
        // ✅ 4명 이상: 상단 2개, 하단 2개
        config = {
          layout: 'custom-4',
          gridClass: '',
          containerClass: 'flex flex-col h-full p-2',
          itemClass: '',
          gap: 'gap-2',
        };
      }
    }
    // ============================================================
    // 모바일 가로 & 데스크톱
    // ============================================================
    else {
      if (participantCount === 1) {
        config = {
          layout: 'grid',
          gridClass: 'grid-cols-1',
          containerClass: 'grid h-full p-2 sm:p-4',
          itemClass: 'w-full h-full',
          gap: 'gap-2 sm:gap-4',
        };
      } else if (participantCount === 2) {
        config = {
          layout: 'grid',
          gridClass: 'grid-cols-2',
          containerClass: 'grid h-full p-2 sm:p-4',
          itemClass: 'w-full h-full',
          gap: 'gap-2 sm:gap-4',
        };
      } else if (participantCount === 3) {
        // ✅ 상단 2개, 하단 중앙 1개
        config = {
          layout: 'custom-3',
          gridClass: '',
          containerClass: 'flex flex-col h-full p-2 sm:p-4',
          itemClass: '',
          gap: 'gap-2 sm:gap-4',
        };
      } else if (participantCount === 4) {
        config = {
          layout: 'custom-4',
          gridClass: '',
          containerClass: 'flex flex-col h-full p-2 sm:p-4',
          itemClass: '',
          gap: 'gap-2 sm:gap-4',
        };
      } else if (participantCount <= 6) {
        config = {
          layout: 'grid',
          gridClass: 'grid-cols-3',
          containerClass: 'grid h-full p-2 sm:p-4',
          itemClass: 'w-full h-full',
          gap: 'gap-2 sm:gap-4',
        };
      } else {
        config = {
          layout: 'grid',
          gridClass: 'grid-cols-4',
          containerClass: 'grid h-full p-2 sm:p-4',
          itemClass: 'w-full h-full',
          gap: 'gap-2 sm:gap-3',
        };
      }
    }

    setGridConfig(config);
  }, [participantCount, isMobile, isPortrait, isLandscape, width, height]);

  return { ...gridConfig, isMobile, isPortrait, isLandscape };
};
