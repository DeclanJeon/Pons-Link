/**
 * @fileoverview 자막 디스플레이 컴포넌트 - 로컬/리모트 통합
 * @module components/FileStreaming/SubtitleDisplay
 * @description 로컬 및 리모트 자막을 모두 표시하는 통합 컴포넌트
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { useFullscreenStore } from '@/stores/useFullscreenStore';
import DOMPurify from 'dompurify';

/**
 * SubtitleDisplay 컴포넌트 Props
 */
interface SubtitleDisplayProps {
  /** 비디오 엘리먼트 ref */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** 리모트 자막 여부 */
  isRemote?: boolean;
}

/**
 * 자막 디스플레이 컴포넌트
 * 비디오 위에 자막을 오버레이하여 표시합니다.
 */
export const SubtitleDisplay: React.FC<SubtitleDisplayProps> = React.memo(({
  videoRef,
  isRemote = false
}) => {
  const {
    currentCue,
    remoteSubtitleCue,
    isEnabled,
    isRemoteSubtitleEnabled,
    position,
    customPosition,
    style
  } = useSubtitleStore();
  
  const isFullscreen = useFullscreenStore(state => state.isFullscreen);
  const [controlBarHeight, setControlBarHeight] = useState(0);
  
  // 표시할 자막 결정
  const displayCue = isRemote ? remoteSubtitleCue : currentCue;
  const shouldShow = isRemote ? isRemoteSubtitleEnabled : isEnabled;

  // 자막 텍스트 메모이제이션
  const subtitleText = useMemo(() =>
    displayCue?.text || '',
    [displayCue?.text]
  );

  /**
   * 풀스크린 모드에서 컨트롤 바 높이 측정
   */
  useEffect(() => {
    if (!isFullscreen) {
      setControlBarHeight(0);
      return;
    }

    const measureControlBar = () => {
      const controlBar = document.querySelector('.vjs-control-bar');
      if (controlBar) {
        const rect = controlBar.getBoundingClientRect();
        setControlBarHeight(rect.height);
      }
    };

    measureControlBar();
    window.addEventListener('resize', measureControlBar);

    return () => {
      window.removeEventListener('resize', measureControlBar);
    };
  }, [isFullscreen]);

  /**
   * 자막 위치 스타일 계산
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
        const bottomOffset = controlBarHeight > 0 
          ? `${controlBarHeight + 20}px` 
          : '8%';
        
        return {
          ...baseStyle,
          bottom: bottomOffset,
          top: 'auto',
        };
      }
      
      return {
        ...baseStyle,
        bottom: `${100 - customPosition.y}%`,
      };
    }
    
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
   * 텍스트 스타일 계산
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
   * 배경 스타일 계산
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
   * HTML 새니타이제이션
   */
  const sanitizedHTML = useMemo(() => {
    if (!displayCue) return { __html: '' };
    
    const config = {
      ALLOWED_TAGS: ['b', 'i', 'u', 'ruby', 'rt', 'v', 'c', 'span'],
      ALLOWED_ATTR: ['class', 'lang'],
      KEEP_CONTENT: true
    };
    
    return {
      __html: DOMPurify.sanitize(subtitleText, config)
    };
  }, [subtitleText]);
  
  if (!shouldShow || !displayCue) {
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
      
      {/* 리모트 자막 표시 */}
      {isRemote && (
        <div className="text-xs text-white/50 text-center mt-1">
          Remote Subtitle
        </div>
      )}
    </div>
  );
});

SubtitleDisplay.displayName = 'SubtitleDisplay';