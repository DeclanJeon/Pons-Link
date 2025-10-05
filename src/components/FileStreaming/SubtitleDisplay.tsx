/**
 * @fileoverview 자막 표시 컴포넌트 - 전체 화면 최적화
 * @module components/FileStreaming/SubtitleDisplay
 * @description 일반 모드와 전체 화면 모드 모두에서 자막을 정상적으로 표시합니다.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { useFullscreen } from '@/hooks/useFullscreen';
import DOMPurify from 'dompurify';

/**
 * SubtitleDisplay 컴포넌트 Props
 */
interface SubtitleDisplayProps {
  /** 비디오 엘리먼트 ref */
 videoRef: React.RefObject<HTMLVideoElement>;
}

/**
 * 자막 표시 컴포넌트
 * 비디오 재생 시 현재 큐에 해당하는 자막을 오버레이로 표시합니다.
 */
export const SubtitleDisplay: React.FC<SubtitleDisplayProps> = React.memo(({ 
  videoRef, 
}) => {
  const { 
    currentCue, 
    isEnabled, 
    position, 
    customPosition, 
    style 
  } = useSubtitleStore();
  
  const { isFullscreen } = useFullscreen('fileStreaming');
  
  // ✅ 동적 컨트롤바 높이 계산
 const [controlBarHeight, setControlBarHeight] = useState(0);
  
  useEffect(() => {
    if (!isFullscreen) {
      setControlBarHeight(0);
      return;
    }

    // Video.js 컨트롤바 높이 측정
    const measureControlBar = () => {
      const controlBar = document.querySelector('.vjs-control-bar');
      if (controlBar) {
        const rect = controlBar.getBoundingClientRect();
        setControlBarHeight(rect.height);
      }
    };

    measureControlBar();

    // 윈도우 리사이즈 시 재측정
    window.addEventListener('resize', measureControlBar);

    return () => {
      window.removeEventListener('resize', measureControlBar);
    };
  }, [isFullscreen]);

  /**
   * ✅ 개선된 위치 계산
   */
  const positionStyle = useMemo(() => {
    const baseStyle = {
      position: 'absolute' as const,
      left: '50%',
      transform: 'translateX(-50%)',
      width: isFullscreen ? '90%' : '80%',
      maxWidth: isFullscreen ? '1200px' : '800px',
    };

    if (isFullscreen) {
      if (position === 'top') {
        return {
          ...baseStyle,
          bottom: 'auto',
          top: '5%',
        };
      }
      
      if (position === 'bottom') {
        // ✅ 실제 컨트롤바 높이 + 여유 공간 사용
        const bottomOffset = controlBarHeight > 0 
          ? `${controlBarHeight + 20}px` 
          : '8%'; // fallback
        
        return {
          ...baseStyle,
          bottom: bottomOffset,
          top: 'auto',
        };
      }
      
      // 커스텀 위치
      return {
        ...baseStyle,
        bottom: `${100 - customPosition.y}%`,
      };
    }
    
    // 일반 모드
    if (position === 'top') {
      return { ...baseStyle, bottom: 'auto', top: '10%' };
    }
    if (position === 'bottom') {
      return { ...baseStyle, bottom: '10%', top: 'auto' };
    }
    return {
      ...baseStyle,
      bottom: `${100 - customPosition.y}%`,
    };
  }, [position, customPosition, isFullscreen, controlBarHeight]);
  
  /**
   * ✅ 전체 화면 모드에 따른 텍스트 스타일
   */
  const textStyle = useMemo(() => {
    const fontSizes = {
      small: isFullscreen ? '20px' : '14px',
      medium: isFullscreen ? '28px' : '18px',
      large: isFullscreen ? '36px' : '24px',
      xlarge: isFullscreen ? '48px' : '32px'
    };
    
    const edgeStyles = {
      none: {},
      dropshadow: {
        textShadow: `2px 2px 4px ${style.edgeColor}`
      },
      raised: {
        textShadow: `1px 1px 2px ${style.edgeColor}`
      },
      depressed: {
        textShadow: `-1px -1px 2px ${style.edgeColor}`
      },
      uniform: {
        textShadow: `0 0 4px ${style.edgeColor}`,
        WebkitTextStroke: `1px ${style.edgeColor}`
      }
    };
    
    return {
      fontFamily: style.fontFamily,
      fontSize: fontSizes[style.fontSize],
      fontWeight: style.fontWeight,
      color: style.color,
      lineHeight: 1.4,
      ...edgeStyles[style.edgeStyle]
    };
  }, [style, isFullscreen]);
  
  /**
   * ✅ 배경 스타일
   */
  const backgroundStyle = useMemo(() => {
    const bgAlpha = Math.round(style.backgroundOpacity * 255)
      .toString(16)
      .padStart(2, '0');
    
    return {
      backgroundColor: `${style.backgroundColor}${bgAlpha}`,
      padding: isFullscreen ? '12px 24px' : '8px 16px',
      borderRadius: '4px',
      display: 'inline-block',
      maxWidth: '100%',
    };
  }, [style, isFullscreen]);
  
  /**
   * HTML 정제
   */
  const sanitizedHTML = useMemo(() => {
    if (!currentCue) return { __html: '' };
    
    const config = {
      ALLOWED_TAGS: ['b', 'i', 'u', 'ruby', 'rt', 'v', 'c', 'span'],
      ALLOWED_ATTR: ['class', 'lang'],
      KEEP_CONTENT: true
    };
    
    return {
      __html: DOMPurify.sanitize(currentCue.text, config)
    };
  }, [currentCue]);
  
  if (!isEnabled || !currentCue) {
    return null;
 }
  
  return (
    <div
      className="subtitle-display"
      style={{
        ...positionStyle,
        zIndex: 100,
        pointerEvents: 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={backgroundStyle}>
        <div
          style={{
            ...textStyle,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
          dangerouslySetInnerHTML={sanitizedHTML}
        />
      </div>
    </div>
  );
});

SubtitleDisplay.displayName = 'SubtitleDisplay';
  
