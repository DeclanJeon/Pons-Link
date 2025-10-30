import { useRef, useEffect, useState, useCallback } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { SubtitleParser } from '@/lib/subtitle/parser';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useFullscreenStore } from '@/stores/useFullscreenStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSubtitleSync } from '@/hooks/useSubtitleSync';

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
    syncOffset,
    speedMultiplier,
    isEnabled: subtitlesEnabled,
    setSpeedMultiplier,
    setActiveTrack
  } = useSubtitleStore();
  useSubtitleSync(videoRef, isStreaming);

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
        subsCapsButton: true,
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
      } catch (error) {
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

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const existingTracks = player.remoteTextTracks();
    const toRemove: any[] = [];
    for (let i = 0; i < (existingTracks as any).length; i++) {
      toRemove.push((existingTracks as any)[i]);
    }
    toRemove.forEach(track => player.removeRemoteTextTrack(track));
    const trackUrls: string[] = [];
    tracks.forEach((track) => {
      const vttContent = SubtitleParser.stringify(track.cues, 'vtt');
      const vttBlob = new Blob([vttContent], { type: 'text/vtt' });
      const vttUrl = URL.createObjectURL(vttBlob);
      trackUrls.push(vttUrl);
      player.addRemoteTextTrack({
        kind: 'subtitles',
        label: track.label,
        srclang: track.language,
        src: vttUrl,
      }, false);
    });
    const textTracks = player.textTracks();
    for (let i = 0; i < (textTracks as any).length; i++) {
      const vjsTrack = (textTracks as any)[i];
      const storeTrack = Array.from(tracks.values()).find(t => t.label === vjsTrack.label);
      if (storeTrack) {
        vjsTrack.mode = (storeTrack.id === activeTrackId && subtitlesEnabled) ? 'showing' : 'disabled';
      }
    }
    return () => {
      trackUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [tracks, activeTrackId, subtitlesEnabled]);

  useEffect(() => {
    if (!playerRef.current) return;
    const currentRate = playerRef.current.playbackRate();
    if (Math.abs(currentRate - speedMultiplier) > 0.01) {
      playerRef.current.playbackRate(speedMultiplier);
    }
  }, [speedMultiplier]);

  const addCustomControls = useCallback((player: Player) => {
    const Button = videojs.getComponent('Button');
    
    // Create a proper Video.js component class
    class SubtitleDelayButton extends (Button as any) {
      constructor(player: Player, options?: any) {
        super(player, options);
        (this as any).controlText('Subtitle Delay');
        (this as any).addClass('vjs-subtitle-delay-button');
        (this as any).el().innerHTML = '<span class="vjs-icon-placeholder" aria-hidden="true">+/-</span>';
      }
      
      handleClick() {
        // Handle subtitle delay logic here
      }
    }
    
    // Register the component with proper typing
    videojs.registerComponent('SubtitleDelayButton', SubtitleDelayButton as any);
    
    // Add to control bar
    const controlBar: any = player.getChild('controlBar');
    if (controlBar && !controlBar.getChild('SubtitleDelayButton')) {
      controlBar.addChild('SubtitleDelayButton', {}, controlBar.children().length - 2);
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
