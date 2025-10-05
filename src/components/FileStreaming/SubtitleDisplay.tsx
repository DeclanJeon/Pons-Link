/**
 * @fileoverview 자막 디스플레이 컴포넌트
 * @module components/FileStreaming/SubtitleDisplay
 */

import React, { useMemo } from 'react';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import DOMPurify from 'dompurify';

/**
 * SubtitleDisplay 컴포넌트 Props
 */
interface SubtitleDisplayProps {
  /** 비디오 엘리먼트 ref */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** 전체화면 여부 */
  isFullscreen: boolean;
}

/**
 * 자막 표시 컴포넌트
 * 현재 재생 시간에 맞는 자막을 화면에 렌더링
 */
export const SubtitleDisplay: React.FC<SubtitleDisplayProps> = React.memo(({ 
  videoRef, 
  isFullscreen 
}) => {
  const { 
    currentCue, 
    isEnabled, 
    position, 
    customPosition, 
    style 
  } = useSubtitleStore();
  
  /**
   * 자막 위치 계산
   */
  const positionStyle = useMemo(() => {
    if (position === 'top') {
      return { bottom: 'auto', top: '10%' };
    }
    if (position === 'bottom') {
      return { bottom: '10%', top: 'auto' };
    }
    return { 
      bottom: `${100 - customPosition.y}%`, 
      left: `${customPosition.x}%`,
      transform: 'translateX(-50%)'
    };
  }, [position, customPosition]);
  
  /**
   * 자막 텍스트 스타일 계산
   */
  const textStyle = useMemo(() => {
    const sizes = {
      small: '14px',
      medium: '18px',
      large: '24px',
      xlarge: '32px'
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
      fontSize: isFullscreen ?
        `calc(${sizes[style.fontSize]} * 1.5)` :
        sizes[style.fontSize],
      fontWeight: style.fontWeight,
      color: style.color,
      lineHeight: 1.4,
      ...edgeStyles[style.edgeStyle]
    };
  }, [style, isFullscreen]);
  
  /**
   * ✅ 수정: 배경 스타일 (컨테이너용)
   */
  const backgroundStyle = useMemo(() => {
    const bgAlpha = Math.round(style.backgroundOpacity * 255)
      .toString(16)
      .padStart(2, '0');
    
    return {
      backgroundColor: `${style.backgroundColor}${bgAlpha}`,
      padding: '8px 16px',
      borderRadius: '4px',
      display: 'inline-block', // ✅ 텍스트 크기에 맞춤
      maxWidth: '80%', // ✅ 최대 너비 제한
    };
  }, [style]);
  
  /**
   * 자막 HTML 정제
   */
  const sanitizedHTML = useMemo(() => {
    if (!currentCue) return { __html: '' };
    
    // WebVTT 태그만 허용
    const config = {
      ALLOWED_TAGS: ['b', 'i', 'u', 'ruby', 'rt', 'v', 'c', 'span'],
      ALLOWED_ATTR: ['class', 'lang'],
      KEEP_CONTENT: true
    };
    
    return {
      __html: DOMPurify.sanitize(currentCue.text, config)
    };
  }, [currentCue]);
  
  // 자막이 없거나 비활성화된 경우 렌더링하지 않음
  if (!isEnabled || !currentCue) {
    return null;
  }
  
  return (
    <div
      className="subtitle-display"
      style={{
        position: 'absolute',
        ...positionStyle,
        zIndex: 100,
        pointerEvents: 'none',
        // 🔧 width 제거 - 자막이 필요한 만큼만 차지
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        // 🔧 좌우 여백 확보
        left: '10%',
        right: '10%',
      }}
    >
      {/* ✅ 수정: 배경과 텍스트를 분리 */}
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
