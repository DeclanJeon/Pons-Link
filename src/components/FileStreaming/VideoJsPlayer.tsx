/**
 * @fileoverview Video.js 기반 비디오 플레이어 컴포넌트
 * @module components/FileStreaming/VideoJsPlayer
 * @description 기존 VideoPlayer를 대체하며 자막/속도/스트리밍 기능 통합
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';

// Video.js Player Options 인터페이스 정의
interface VideoJsPlayerOptions {
  controls?: boolean;
  responsive?: boolean;
  fluid?: boolean;
  playbackRates?: number[];
  controlBar?: {
    volumePanel?: {
      inline: boolean;
    };
    pictureInPictureToggle?: boolean;
    fullscreenToggle?: boolean;
    playbackRateMenuButton?: boolean;
    chaptersButton?: boolean;
    descriptionsButton?: boolean;
    subsCapsButton?: boolean;
    audioTrackButton?: boolean;
  };
  userActions?: {
    hotkeys?: boolean;
  };
  html5?: {
    vhs?: {
      overrideNative: boolean;
    };
    nativeVideoTracks?: boolean;
    nativeAudioTracks?: boolean;
    nativeTextTracks?: boolean;
  };
}
import 'video.js/dist/video-js.css';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { useSubtitleSync } from '@/hooks/useSubtitleSync';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VideoJsPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoState: {
    isPaused: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
  };
  onStateChange: (updates: any) => void;
  isStreaming: boolean;
  file?: File;
}

export const VideoJsPlayer = ({
  videoRef,
  videoState,
  onStateChange,
  isStreaming,
  file
}: VideoJsPlayerProps) => {
  const playerRef = useRef<Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const objectUrlRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // 자막 스토어
  const {
    tracks,
    activeTrackId,
    syncOffset,
    speedMultiplier,
    isEnabled: subtitlesEnabled,
    style: subtitleStyle,
    adjustSyncOffset,
    setSpeedMultiplier,
    setActiveTrack
  } = useSubtitleStore();

  // 자막 동기화 훅
  useSubtitleSync(videoRef, isStreaming);

  /**
   * Video.js 플레이어 초기화
   */
  useEffect(() => {
    if (!videoRef.current || playerRef.current) return;

    console.log('[VideoJsPlayer] Initializing Video.js player...');

    // Video.js 옵션
    const options: VideoJsPlayerOptions = {
      controls: true,
      responsive: true,
      fluid: true,
      playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      controlBar: {
        volumePanel: {
          inline: false
        },
        pictureInPictureToggle: true,
        fullscreenToggle: true,
        playbackRateMenuButton: true,
        chaptersButton: false,
        descriptionsButton: false,
        subsCapsButton: true,
        audioTrackButton: false
      },
      userActions: {
        hotkeys: true
      },
      html5: {
        vhs: {
          overrideNative: true
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false
      }
    };

    // 플레이어 생성
    const player = videojs(videoRef.current, options);
    playerRef.current = player;

    // 커스텀 컨트롤 버튼 추가
    addCustomControls(player);

    // 이벤트 리스너 설정
    setupEventListeners(player);

    console.log('[VideoJsPlayer] Player initialized successfully');

    return () => {
      if (playerRef.current) {
        console.log('[VideoJsPlayer] Disposing player...');
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [videoRef]);

  /**
   * 비디오 소스 로드
   */
  useEffect(() => {
    if (!playerRef.current || !file) return;

    const loadVideo = async () => {
      try {
        // 이전 URL 정리
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }

        // 새 URL 생성
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;

        console.log('[VideoJsPlayer] Loading video source:', file.name);

        // Video.js에 소스 설정
        playerRef.current.src({
          src: url,
          type: file.type
        });

        // 메타데이터 로드 대기
        playerRef.current.load();

        console.log('[VideoJsPlayer] Video source loaded successfully');
      } catch (error) {
        console.error('[VideoJsPlayer] Failed to load video:', error);
        onStateChange({ videoState: `error: ${error}` });
        toast.error('Failed to load video file');
      }
    };

    loadVideo();

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file, onStateChange]);

  /**
   * 자막 트랙 동기화
   */
  useEffect(() => {
    if (!playerRef.current) return;

    const player = playerRef.current;

    console.log('[VideoJsPlayer] Syncing subtitle tracks...');

    // 🔧 기존 SubtitleDisplay와 충돌 방지
    const { setActiveTrack } = useSubtitleStore.getState();
    
    // Video.js가 자막을 관리하므로 SubtitleStore의 activeTrack을 null로 설정
    if (isStreaming) {
      setActiveTrack(null);
    }

    // 기존 텍스트 트랙 제거
    const existingTracks = player.remoteTextTracks();
    const tracksToRemove: any[] = [];
    
    for (let i = 0; i < (existingTracks as any).length; i++) {
      tracksToRemove.push(existingTracks[i]);
    }
    
    tracksToRemove.forEach(track => {
      player.removeRemoteTextTrack(track);
    });

    // 새 자막 트랙 추가
    const trackUrls: string[] = [];
    
    tracks.forEach((track, trackId) => {
      const vttBlob = convertToVTT(track);
      const vttUrl = URL.createObjectURL(vttBlob);
      trackUrls.push(vttUrl);

      player.addRemoteTextTrack({
        kind: 'subtitles',
        label: track.label,
        srclang: track.language,
        src: vttUrl,
        default: trackId === activeTrackId
      }, false);

      console.log(`[VideoJsPlayer] Added subtitle track: ${track.label}`);
    });

    // Video.js 자막과 Store 동기화
    const textTracks = player.textTracks();
    
    const handleCueChange = () => {
      const tracksArray = Array.from(textTracks as any as TextTrack[]);
      tracksArray.forEach((track: TextTrack) => {
        if (track.mode === 'showing' && track.activeCues && track.activeCues.length > 0) {
          const activeCue = track.activeCues[0] as VTTCue;
          
          // Store의 currentCue 업데이트
          const { syncWithVideo } = useSubtitleStore.getState();
          // Video.js의 현재 시간을 기반으로 자막 동기화
          if (videoRef.current) {
            syncWithVideo(videoRef.current.currentTime * 1000);
          }
        }
      });
    };
    
    textTracks.addEventListener('cuechange', handleCueChange);
    
    return () => {
      textTracks.removeEventListener('cuechange', handleCueChange);
      trackUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [tracks, activeTrackId, setActiveTrack]);

  /**
   * 자막 스타일 적용
   */
  useEffect(() => {
    if (!playerRef.current) return;

    const player = playerRef.current;
    const textTrackDisplay = player.el().querySelector('.vjs-text-track-display');

    if (textTrackDisplay) {
      applySubtitleStyle(textTrackDisplay as HTMLElement, subtitleStyle);
    }
  }, [subtitleStyle]);

  /**
   * 재생 속도 동기화
   */
  useEffect(() => {
    if (!playerRef.current) return;
    
    const currentRate = playerRef.current.playbackRate();
    if (Math.abs(currentRate - speedMultiplier) > 0.01) {
      playerRef.current.playbackRate(speedMultiplier);
      console.log('[VideoJsPlayer] Playback rate set to:', speedMultiplier);
    }
  }, [speedMultiplier]);

  /**
   * 자막 활성화/비활성화
   */
  useEffect(() => {
    if (!playerRef.current) return;

    const player = playerRef.current;
    const textTracks = player.textTracks();

    // textTracks는 Video.js의 TextTrackList로, 표준 DOM TextTrackList와 다름
    // length 속성이 없을 수 있으므로 Array.from()을 사용하여 배열로 변환
    const tracksArray = Array.from(textTracks as any as TextTrack[]);
    tracksArray.forEach((track: TextTrack) => {
      if (subtitlesEnabled) {
        if (track.mode === 'disabled') {
          track.mode = 'showing';
        }
      } else {
        track.mode = 'disabled';
      }
    });
  }, [subtitlesEnabled]);

  /**
   * 커스텀 컨트롤 추가
   */
  const addCustomControls = useCallback((player: Player) => {
    // 자막 오프셋 조정 버튼
    const Button = videojs.getComponent('Button');
    
    class SubtitleDelayButton extends Button {
      constructor(player: Player, options?: any) {
        super(player, options);
        (this as any).controlText('Subtitle Delay');
        this.addClass('vjs-subtitle-delay-button');
      }

      handleClick() {
        const currentOffset = useSubtitleStore.getState().syncOffset;
        const newOffsetStr = prompt(
          `Current subtitle delay: ${(currentOffset / 1000).toFixed(2)}s\n\nEnter new delay in seconds:\n  + for delay (e.g., +2.5)\n  - for advance (e.g., -1.0)`,
          (currentOffset / 1000).toString()
        );
        
        if (newOffsetStr !== null && newOffsetStr.trim() !== '') {
          const newOffset = parseFloat(newOffsetStr);
          if (!isNaN(newOffset)) {
            const offsetMs = newOffset * 1000;
            const delta = offsetMs - currentOffset;
            useSubtitleStore.getState().adjustSyncOffset(delta);
            toast.success(`Subtitle delay: ${newOffset > 0 ? '+' : ''}${newOffset.toFixed(2)}s`);
          } else {
            toast.error('Invalid delay value');
          }
        }
      }
    }

    videojs.registerComponent('SubtitleDelayButton', SubtitleDelayButton);
    
    const controlBar = player.getChild('controlBar');
    if (controlBar) {
      controlBar.addChild('SubtitleDelayButton', {}, 10);
    }
  }, []);

  /**
   * 이벤트 리스너 설정
   */
  const setupEventListeners = useCallback((player: Player) => {
    player.on('loadstart', () => {
      console.log('[VideoJsPlayer] Load start');
      setIsBuffering(true);
      setIsReady(false);
    });

    player.on('loadedmetadata', () => {
      console.log('[VideoJsPlayer] Metadata loaded');
      onStateChange({ duration: player.duration() });
    });

    player.on('canplay', () => {
      console.log('[VideoJsPlayer] Can play');
      setIsReady(true);
      setIsBuffering(false);
    });

    player.on('waiting', () => {
      console.log('[VideoJsPlayer] Waiting (buffering)');
      setIsBuffering(true);
    });

    player.on('playing', () => {
      console.log('[VideoJsPlayer] Playing');
      setIsBuffering(false);
    });

    player.on('play', () => {
      onStateChange({ videoState: 'playing' });
    });

    player.on('pause', () => {
      onStateChange({ videoState: 'paused' });
    });

    player.on('timeupdate', () => {
      const currentTime = player.currentTime() || 0;
      onStateChange({
        videoTime: currentTime,
        currentTime: currentTime,
        videoState: player.paused() ? 'paused' : 'playing'
      });
    });

    player.on('volumechange', () => {
      onStateChange({
        volume: (player.volume() || 0) * 100,
        isMuted: player.muted()
      });
    });

    player.on('ratechange', () => {
      const rate = player.playbackRate() || 1;
      setSpeedMultiplier(rate);
    });

    player.on('ended', () => {
      console.log('[VideoJsPlayer] Video ended');
      onStateChange({ videoState: 'ended' });
    });

    player.on('error', () => {
      const error = player.error();
      console.error('[VideoJsPlayer] Player error:', error);
      
      let errorMessage = 'Unknown error';
      if (error) {
        switch (error.code) {
          case 1: errorMessage = 'Video loading aborted'; break;
          case 2: errorMessage = 'Network error'; break;
          case 3: errorMessage = 'Video decoding error'; break;
          case 4: errorMessage = 'Video format not supported'; break;
        }
      }
      
      onStateChange({ videoState: `error: ${errorMessage}` });
      toast.error(`Video error: ${errorMessage}`);
    });

    player.on('fullscreenchange', () => {
      setIsFullscreen(player.isFullscreen());
    });
  }, [onStateChange, setSpeedMultiplier]);

  /**
   * 자막을 VTT 형식으로 변환
   */
  const convertToVTT = useCallback((track: any): Blob => {
    let vttContent = 'WEBVTT\n\n';
    
    track.cues.forEach((cue: any, index: number) => {
      // 동기화 오프셋 적용
      const start = formatVTTTime(cue.startTime + syncOffset);
      const end = formatVTTTime(cue.endTime + syncOffset);
      
      vttContent += `${index + 1}\n`;
      vttContent += `${start} --> ${end}\n`;
      vttContent += `${cue.text}\n\n`;
    });

    return new Blob([vttContent], { type: 'text/vtt' });
  }, [syncOffset]);

  /**
   * VTT 시간 형식 변환 (밀리초 → HH:MM:SS.mmm)
   */
  const formatVTTTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = ms % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }, []);

  /**
   * 자막 스타일 적용
   */
  const applySubtitleStyle = useCallback((element: HTMLElement, style: any) => {
    const fontSizes: Record<string, string> = {
      small: '14px',
      medium: '18px',
      large: '24px',
      xlarge: '32px'
    };

    element.style.fontFamily = style.fontFamily;
    element.style.fontSize = fontSizes[style.fontSize] || '18px';
    element.style.fontWeight = style.fontWeight;
    element.style.color = style.color;
    
    // 배경색 + 투명도
    const bgAlpha = Math.round(style.backgroundOpacity * 255)
      .toString(16)
      .padStart(2, '0');
    element.style.backgroundColor = `${style.backgroundColor}${bgAlpha}`;

    // 텍스트 그림자 (edge style)
    switch (style.edgeStyle) {
      case 'dropshadow':
        element.style.textShadow = `2px 2px 4px ${style.edgeColor}`;
        break;
      case 'raised':
        element.style.textShadow = `1px 1px 2px ${style.edgeColor}`;
        break;
      case 'depressed':
        element.style.textShadow = `-1px -1px 2px ${style.edgeColor}`;
        break;
      case 'uniform':
        element.style.textShadow = `0 0 4px ${style.edgeColor}`;
        element.style.webkitTextStroke = `1px ${style.edgeColor}`;
        break;
      default:
        element.style.textShadow = 'none';
    }
  }, []);

  /**
   * 풀스크린 토글
   */
  const toggleFullscreen = useCallback(() => {
    if (playerRef.current) {
      if (playerRef.current.isFullscreen()) {
        playerRef.current.exitFullscreen();
      } else {
        playerRef.current.requestFullscreen();
      }
    }
  }, []);

  return (
    <div className="video-player-container space-y-3">
      {/* 컨트롤 헤더 */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? 'Hide preview' : 'Show preview'}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="ml-2">{showPreview ? 'Hide' : 'Show'} Preview</span>
          </Button>

          {!isFullscreen && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              title="Enter fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* 상태 표시 */}
        <div className="flex items-center gap-2">
          {!isReady && (
            <span className="text-xs text-yellow-500">Loading video...</span>
          )}
          {isReady && !isBuffering && (
            <span className="text-xs text-green-500">Ready</span>
          )}
          {isBuffering && (
            <span className="text-xs text-blue-500 animate-pulse">Buffering...</span>
          )}
          {isStreaming && (
            <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE STREAMING
            </div>
          )}
        </div>
      </div>

      {/* Video.js 플레이어 */}
      {showPreview && (
        <div 
          ref={containerRef}
          data-vjs-player
          className={cn(
            "relative bg-black rounded-lg overflow-hidden",
            isFullscreen && "fixed inset-0 z-50 rounded-none"
          )}
        >
          <video
            ref={videoRef}
            className="video-js vjs-big-play-centered vjs-fluid vjs-theme-city"
            playsInline
          />
          
          {/* 버퍼링 인디케이터 */}
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          )}
        </div>
      )}

      {/* 스트리밍 경고 */}
      {isStreaming && (
        <div className="text-center text-sm text-blue-500 bg-blue-50 dark:bg-blue-950 p-2 rounded">
          🔴 Live streaming to {usePeerConnectionStore.getState().peers.size || 0} participant(s)
        </div>
      )}
    </div>
  );
};

// Store import
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
