import { useVideoFullscreen } from "@/hooks/useVideoFullscreen";
import { cn } from "@/lib/utils";
import { useSubtitleStore } from "@/stores/useSubtitleStore";
import { Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SubtitleDisplay } from "../functions/FileStreaming/SubtitleDisplay";

/**
 * Container size hook (responsive handling)
 */
const useContainerSize = (ref: React.RefObject<HTMLDivElement>) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateSize = () => {
      setSize({
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [ref]);

  return size;
};

interface VideoPreviewProps {
  /** Media stream */
  stream: MediaStream | null;
  /** Video enabled status */
  isVideoEnabled: boolean;
 /** User nickname */
  nickname: string;
  /** Audio level (0-1) */
  audioLevel?: number;
  /** Voice frame display */
  showVoiceFrame?: boolean;
 /** Local video */
  isLocalVideo?: boolean;
  /** Subtitle display */
  showSubtitles?: boolean;
  /** Screen share */
  isScreenShare?: boolean;
  /** File streaming */
  isFileStreaming?: boolean;
}

/**
 * Video Preview Component
 *
 * Displays local/remote video streams with the following features:
 * - Avatar display when video is off
 * - Fullscreen support (double-click or F key)
 * - Subtitle overlay (optional)
 * - Nickname display
 * - Responsive layout
 */
export const VideoPreview = ({
  stream,
  isVideoEnabled,
  nickname,
  isLocalVideo = false,
  showSubtitles = false,
  isScreenShare = false,
  isFileStreaming = false,
}: VideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFullName, setShowFullName] = useState(false);

  const containerSize = useContainerSize(containerRef);
  const isPIP = containerSize.width < 200; // 200px 미만이면 PIP 모드

  const { isFullscreen, handleDoubleClick } = useVideoFullscreen(containerRef, videoRef);

  // 자막 표시 여부: 로컬/원격에 따라 다른 스토어 상태 참조
  const { isEnabled: localSubtitlesEnabled, isRemoteSubtitleEnabled } = useSubtitleStore();

  // 자막 표시 조건: showSubtitles prop이 true이고, 해당 자막이 활성화된 경우
  const shouldShowSubtitles = showSubtitles &&
                              (isLocalVideo ? localSubtitlesEnabled : isRemoteSubtitleEnabled);

  /**
   * Video stream connection and playback
   */
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

      // 원격 비디오는 자동 재생
      if (!isLocalVideo && video.paused) {
        video.play().catch(err => {
          console.warn(`[VideoPreview] ${nickname} Auto-play failed:`, err);
        });
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
      {/* 비디오 요소 */}
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
      />

      {/* Video off status: Avatar display */}
      {(!stream || !isVideoEnabled) && !isFullscreen && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary/50 to-muted">
          <div className="w-20 h-20 lg:w-24 lg:h-24 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-3xl lg:text-4xl font-bold text-primary">
              {nickname.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Subtitle overlay - passing isRemote prop */}
      {shouldShowSubtitles && (
        <SubtitleDisplay
          videoRef={videoRef}
          isRemote={!isLocalVideo}
        />
      )}

      {/* Nickname display */}
      {isPIP ? (
        // PIP mode: Avatar only
        <div className="absolute bottom-2 left-2 w-8 h-8 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center">
          <span className="text-sm font-bold text-white">
            {nickname.charAt(0).toUpperCase()}
          </span>
        </div>
      ) : (
        // Normal mode: Nickname display
        <div className={cn(
          "absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white",
          isFullscreen && "bottom-4 left-4 text-sm px-4 py-2"
        )}>
          {nickname} {isLocalVideo && "(You)"}
        </div>
      )}

      {/* Full name tooltip (PIP mode hover) */}
      {/* {showFullName && isPIP && (
        <div className="absolute bottom-12 left-2 bg-black/90 backdrop-blur-sm px-3 py-2 rounded-lg text-sm text-white shadow-lg z-10 whitespace-nowrap">
          {nickname} {isLocalVideo && "(You)"}
        </div>
      )} */}

      {/* Fullscreen button hint */}
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

      {/* Fullscreen exit hint */}
      {isFullscreen && (
        <div className="absolute top-4 right-4 text-sm text-white/70 bg-black/60 px-3 py-2 rounded">
          Press ESC to exit fullscreen
        </div>
      )}
    </div>
  );
};
