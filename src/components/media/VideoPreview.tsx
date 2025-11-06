import { useVideoFullscreen } from "@/hooks/useVideoFullscreen";
import { cn } from "@/lib/utils";
import { useSubtitleStore } from "@/stores/useSubtitleStore";
import { Maximize2 } from "lucide-react";
import { useEffect, useRef, useState, memo } from "react";
import { SubtitleDisplay } from "../functions/fileStreaming/SubtitleDisplay";

const useContainerSize = (ref: React.RefObject<HTMLDivElement>) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    
    let rafId: number;
    const updateSize = () => {
      rafId = requestAnimationFrame(() => {
        setSize({ width: element.offsetWidth, height: element.offsetHeight });
      });
    };
    
    updateSize();
    const resizeObserver = new ResizeObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      updateSize();
    });
    
    resizeObserver.observe(element);
    return () => {
      resizeObserver.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [ref]);
  return size;
};

interface VideoPreviewProps {
  stream: MediaStream | null;
  isVideoEnabled: boolean;
  nickname: string;
  audioLevel?: number;
  showVoiceFrame?: boolean;
  isLocalVideo?: boolean;
  showSubtitles?: boolean;
  isScreenShare?: boolean;
  isFileStreaming?: boolean;
  isRelay?: boolean;
}

export const VideoPreview = memo(({
  stream,
  isVideoEnabled,
  nickname,
  isLocalVideo = false,
  showSubtitles = false,
  isScreenShare = false,
  isFileStreaming = false,
  isRelay = false,
}: VideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFullName, setShowFullName] = useState(false);
  const containerSize = useContainerSize(containerRef);
  const isPIP = containerSize.width < 240;
  const { isFullscreen, handleDoubleClick } = useVideoFullscreen(containerRef, videoRef);
  const { isEnabled: localSubtitlesEnabled, isRemoteSubtitleEnabled } = useSubtitleStore();
  const shouldShowSubtitles = showSubtitles && (isLocalVideo ? localSubtitlesEnabled : isRemoteSubtitleEnabled);

  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const currentSrc = video.srcObject;
    if (!stream) {
      if (currentSrc) video.srcObject = null;
      return;
    }
    if (currentSrc !== stream) {
      if (currentSrc instanceof MediaStream) video.srcObject = null;
      video.srcObject = stream;
      if (!isLocalVideo && video.paused) {
        video.play().catch(() => {});
      }
    }
  }, [stream, isLocalVideo, nickname]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-full bg-muted rounded-lg overflow-hidden flex items-center justify-center shadow-md border border-border/20 group",
        isFullscreen && "fixed inset-0 z-50 rounded-none bg-black"
      )}
      onDoubleClick={handleDoubleClick}
      tabIndex={0}
      onMouseEnter={() => setShowFullName(true)}
      onMouseLeave={() => setShowFullName(false)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocalVideo}
        className={cn(
          "transition-opacity duration-300",
          isFullscreen
            ? "w-full h-full object-contain"
            : (isScreenShare || isFileStreaming)
              ? "w-full h-full object-contain"
              : "w-full h-full object-cover",
          stream && isVideoEnabled ? "opacity-100" : "opacity-0"
        )}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          objectPosition: isScreenShare || isFileStreaming ? 'center' : 'center 100%',
        }}
      />

      {shouldShowSubtitles && (
        <SubtitleDisplay
          videoRef={videoRef}
          isRemote={!isLocalVideo}
        />
      )}

      {isRelay && (
        <div className="absolute top-2 left-2 bg-purple-600/90 text-white text-xs px-2 py-1 rounded-full shadow">
          Relay Stream
        </div>
      )}

      {(!stream || !isVideoEnabled) && !isFullscreen && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary/50 to-muted">
          <div className="w-20 h-20 lg:w-24 lg:h-24 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-3xl lg:text-4xl font-bold text-primary">
              {nickname.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {isPIP ? (
        <div className="absolute bottom-2 left-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center">
          <span className="text-sm font-bold text-white">
            {nickname.charAt(0).toUpperCase()}
          </span>
        </div>
      ) : (
        <div className={cn(
          "absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white",
          isFullscreen && "bottom-4 left-4 text-sm px-4 py-2"
        )}>
          {nickname} {isLocalVideo && "(You)"}
        </div>
      )}

      {!isFullscreen && (
        <>
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-black/60 backdrop-blur-sm p-2 rounded-lg">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="absolute bottom-2 right-2 text-xs text-white/50 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-1 rounded">
            Double-click or Press F
          </div>
        </>
      )}

      {isFullscreen && (
        <div className="absolute top-4 right-4 text-sm text-white/70 bg-black/60 px-3 py-2 rounded">
          Press ESC to exit fullscreen
        </div>
      )}
    </div>
  );
});

VideoPreview.displayName = 'VideoPreview';
