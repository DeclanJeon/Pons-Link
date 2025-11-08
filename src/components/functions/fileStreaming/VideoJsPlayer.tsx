import { useRef, useEffect, useState, useCallback, ChangeEvent } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { SubtitleParser } from '@/lib/subtitle/parser';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Maximize2, Minimize2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useFullscreenStore } from '@/stores/useFullscreenStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSubtitleSync } from '@/hooks/useSubtitleSync';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { SubtitleCCMenu } from './SubtitleCCMenu';
import { SubtitleDisplay } from './SubtitleDisplay';
import { subtitleTransport } from '@/services/subtitleTransport';

interface VideoJsPlayerOptions {
  controls?: boolean;
  responsive?: boolean;
  fluid?: boolean;
  playbackRates?: number[];
  controlBar?: {
    volumePanel?: { inline: boolean };
    pictureInPictureToggle?: boolean;
    fullscreenToggle?: boolean;
    playbackRateMenuButton?: boolean;
    chaptersButton?: boolean;
    descriptionsButton?: boolean;
    subsCapsButton?: boolean;
    audioTrackButton?: boolean;
  };
  userActions?: { hotkeys?: boolean };
  html5?: {
    vhs?: { overrideNative: boolean };
    nativeVideoTracks?: boolean;
    nativeAudioTracks?: boolean;
    nativeTextTracks?: boolean;
  };
}

interface VideoJsPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  playerRef: React.MutableRefObject<Player | null>;
  videoState: {
    isPaused: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
  };
  onStateChange: (updates: any) => void;
  onEnded?: () => void;
  isStreaming: boolean;
  file?: File;
}

export const VideoJsPlayer = ({
  videoRef,
  playerRef,
  videoState,
  onStateChange,
  onEnded,
  isStreaming,
  file
}: VideoJsPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(true);
  const objectUrlRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const { toggleFullscreen } = useFullscreen(playerRef.current, 'fileStreaming');
  const isFullscreen = useFullscreenStore(state => state.isFullscreen);
  const {
    tracks,
    activeTrackId,
    isEnabled,
    syncOffset,
    speedMultiplier,
    setSpeedMultiplier,
    setActiveTrack,
    addTrack,
    broadcastTrack,
    broadcastSubtitleState
  } = useSubtitleStore();
  const [openCC, setOpenCC] = useState(false);
  useSubtitleSync(videoRef, isStreaming);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setPresentationVideoEl = useFileStreamingStore(s => s.setPresentationVideoEl);

  useEffect(() => {
    setPresentationVideoEl(videoRef.current || null);
    return () => {
      setPresentationVideoEl(null);
    };
  }, [setPresentationVideoEl]);

  useEffect(() => {
    if (!videoRef.current || playerRef.current) return;
    const options: VideoJsPlayerOptions = {
      controls: true,
      responsive: true,
      fluid: true,
      playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
      controlBar: {
        volumePanel: { inline: false },
        pictureInPictureToggle: true,
        fullscreenToggle: true,
        playbackRateMenuButton: true,
        chaptersButton: false,
        descriptionsButton: false,
        subsCapsButton: false,
        audioTrackButton: false
      },
      userActions: { hotkeys: true },
      html5: {
        vhs: { overrideNative: true },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false
      }
    };
    const player = videojs(videoRef.current, options);
    playerRef.current = player;
    addCustomControls(player);
    setupEventListeners(player);
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [videoRef]);

  useEffect(() => {
    if (!playerRef.current || !file) return;
    const loadVideo = async () => {
      try {
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;
        playerRef.current!.src({ src: url, type: file.type });
        playerRef.current!.load();

        // ✅ 비디오 엘리먼트 참조 가져오기
        const videoEl = playerRef.current!.tech().el() as HTMLVideoElement;
        if (videoEl) {
          console.log('[VideoJsPlayer] 🎥 Video element loaded, preparing audio context');

          // ✅ presentationVideoEl 설정 (릴레이용)
          setPresentationVideoEl(videoEl);

          // ✅ 오디오 캡처 준비 (AudioContext 미리 생성)
          // 주의: 비디오가 로드된 후 약간의 지연을 주어 AudioContext 설정
          setTimeout(() => {
            if (!videoEl.muted && videoEl.readyState >= 2) { // HAVE_CURRENT_DATA
              try {
                const ctx = new AudioContext();
                const src = ctx.createMediaElementSource(videoEl);
                const dest = ctx.createMediaStreamDestination();

                // ✅ 게인 노드 추가 (볼륨 조절)
                const gainNode = ctx.createGain();
                gainNode.gain.value = 1.0;

                src.connect(gainNode);
                gainNode.connect(dest);
                gainNode.connect(ctx.destination); // 스피커 출력도 유지

                // ✅ 오디오 트랙 저장 (릴레이에서 사용 가능)
                (videoEl as any)._audioContext = ctx;
                (videoEl as any)._audioDestination = dest;
                (videoEl as any)._audioGainNode = gainNode;

                console.log('[VideoJsPlayer] ✅ Audio context prepared for relay', {
                  contextState: ctx.state,
                  audioTracks: dest.stream.getAudioTracks().length
                });
              } catch (e) {
                console.warn('[VideoJsPlayer] AudioContext setup failed:', e);
              }
            } else {
              console.log('[VideoJsPlayer] ⚠️ Video is muted or not ready, skipping audio context setup');
            }
          }, 1000); // 1초 지연
        }
      } catch (error) {
        onStateChange({ videoState: `error: ${error}` });
        toast.error('Failed to load video file');
      }
    };
    loadVideo();
    return () => {
      // ✅ 정리
      const videoEl = playerRef.current?.tech().el() as HTMLVideoElement;
      if (videoEl) {
        const ctx = (videoEl as any)._audioContext;
        if (ctx && ctx.state !== 'closed') {
          console.log('[VideoJsPlayer] 🧹 Cleaning up audio context');
          ctx.close();
        }
      }

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file, onStateChange, setPresentationVideoEl]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    // Video.js의 내장 자막 트랙을 모두 제거하여 SubtitleDisplay와 중복 표시 방지
    const existingTracks = player.remoteTextTracks();
    const toRemove: any[] = [];
    for (let i = 0; i < (existingTracks as any).length; i++) {
      toRemove.push((existingTracks as any)[i]);
    }
    toRemove.forEach(track => player.removeRemoteTextTrack(track));
  }, [tracks]);

  useEffect(() => {
    if (!playerRef.current) return;
    const currentRate = playerRef.current.playbackRate();
    if (Math.abs(currentRate - speedMultiplier) > 0.01) {
      playerRef.current.playbackRate(speedMultiplier);
    }
  }, [speedMultiplier]);

  const addCustomControls = useCallback((player: Player) => {
    const ButtonBase = videojs.getComponent('Button');
    
    // Create a proper Video.js component class
    class SubtitleCCButton extends (ButtonBase as any) {
      constructor(p: Player, options?: any) {
        super(p, options);
        (this as any).controlText('Subtitles');
        (this as any).addClass('vjs-subtitle-cc-button');
        (this as any).el().innerHTML = '<span style="font-weight:700">CC</span>';
      }
      
      handleClick() {
        setOpenCC((v) => !v);
      }
    }
    
    // Register component with proper typing
    videojs.registerComponent('SubtitleCCButton', SubtitleCCButton as any);
    
    // Add to control bar
    const controlBar: any = player.getChild('controlBar');
    if (controlBar && !controlBar.getChild('SubtitleCCButton')) {
      controlBar.addChild('SubtitleCCButton', {}, controlBar.children().length - 2);
    }
  }, []);

  const setupEventListeners = useCallback((player: Player) => {
    player.on('loadstart', () => setIsBuffering(true));
    player.on('canplay', () => {
      setIsReady(true);
      setIsBuffering(false);
    });
    player.on('waiting', () => setIsBuffering(true));
    player.on('playing', () => setIsBuffering(false));
    player.on('play', () => onStateChange({ videoState: 'playing' }));
    player.on('pause', () => onStateChange({ videoState: 'paused' }));
    player.on('timeupdate', () => onStateChange({ videoTime: player.currentTime() || 0 }));
    player.on('volumechange', () => onStateChange({ volume: (player.volume() || 0) * 100, isMuted: player.muted() }));
    player.on('ratechange', () => setSpeedMultiplier(player.playbackRate() || 1));
    player.on('ended', () => {
      onStateChange({ videoState: 'ended' });
      if (typeof onEnded === 'function') onEnded();
    });
    player.on('error', () => {
      const error = player.error();
      toast.error(`Video error: ${error?.message || 'Unknown error'}`);
      onStateChange({ videoState: `error: ${error?.message}` });
    });
  }, [onStateChange, setSpeedMultiplier, onEnded]);

  const handleSubtitleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubtitleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await addTrack(file);
      const state = useSubtitleStore.getState();
      const ids = Array.from(state.tracks.keys());
      const newId = ids[ids.length - 1];
      if (newId) {
        state.setActiveTrack(newId);
        state.broadcastTrack(newId);
        state.broadcastSubtitleState();
      }
      toast.success(`Subtitle loaded: ${file.name}`);
    } catch {
      toast.error('Failed to load subtitle');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [addTrack]);

  return (
    <div className="video-player-container space-y-3">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.vtt"
            className="hidden"
            onChange={handleSubtitleFileChange}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSubtitleUploadClick}
            title="Load subtitle"
          >
            <Upload className="w-4 h-4" />
            <span className="ml-2">Subtitle</span>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {!isReady && <span className="text-xs text-yellow-500">Loading video...</span>}
          {isReady && !isBuffering && <span className="text-xs text-green-500">Ready</span>}
          {isBuffering && <span className="text-xs text-blue-500 animate-pulse">Buffering...</span>}
          {isStreaming && (
            <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          )}
        </div>
      </div>
      {showPreview && (
        <div ref={containerRef} data-vjs-player className="relative bg-black overflow-hidden rounded-lg h-[56.25vw] max-h-[70vh]">
          <video ref={videoRef} className="video-js vjs-big-play-centered w-full h-full" playsInline />
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          )}
          <SubtitleDisplay videoRef={videoRef} />
          <SubtitleCCMenu open={openCC} onClose={() => setOpenCC(false)} containerRef={containerRef} isStreaming={isStreaming} />
        </div>
      )}
      {isStreaming && (
        <div className="text-center text-sm text-blue-500 bg-blue-50 dark:bg-blue-950 p-2 rounded">
           Live streaming to {usePeerConnectionStore.getState().peers.size || 0} participant(s)
        </div>
      )}
    </div>
  );
};
