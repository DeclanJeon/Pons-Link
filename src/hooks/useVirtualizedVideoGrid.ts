// src/hooks/useVirtualizedVideoGrid.ts

import { useState, useEffect, useRef, useMemo } from 'react';
import type { Participant } from '@/hooks/useParticipants';

interface VirtualizedGridConfig {
  itemHeight: number;
  gap: number;
  overscan: number;
}

export const useVirtualizedVideoGrid = (
  participants: Participant[],
  containerHeight: number,
  config: VirtualizedGridConfig
) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const { itemHeight, gap, overscan } = config;
    const itemTotalHeight = itemHeight + gap;
    
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / itemTotalHeight) - overscan
    );
    
    const visibleCount = Math.ceil(containerHeight / itemTotalHeight) + overscan * 2;
    const endIndex = Math.min(
      participants.length,
      startIndex + visibleCount
    );
    
    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, participants.length, config]);
  
  const visibleParticipants = useMemo(() => {
    return participants.slice(visibleRange.startIndex, visibleRange.endIndex);
  }, [participants, visibleRange]);
  
  const totalHeight = participants.length * (config.itemHeight + config.gap);
  const offsetY = visibleRange.startIndex * (config.itemHeight + config.gap);
  
  return {
    visibleParticipants,
    totalHeight,
    offsetY,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    }
  };
};
