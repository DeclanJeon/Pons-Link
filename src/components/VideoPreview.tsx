// frontend/src/components/VideoPreview.tsx (최종 수정본)
/**
 * @fileoverview 비디오 프리뷰 컴포넌트 - 로컬/리모트 자막 통합
 * @module components/VideoPreview
 * @description 비디오 스트림을 표시하고 자막을 오버레이하는 컴포넌트
 */

import { useVideoFullscreen } from "@/hooks/useVideoFullscreen";
import { cn } from "@/lib/utils";
import { useSubtitleStore } from "@/stores/useSubtitleStore";
import { Maximize2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { SubtitleDisplay } from "./FileStreaming/SubtitleDisplay";

interface VideoPreviewProps {
  stream: MediaStream | null;
  isVideoEnabled: boolean;
  nickname: string;
  audioLevel?: number;
  showVoiceFrame?: boolean;
  isLocalVideo?: boolean;
  showSubtitles?: boolean;
}

export const VideoPreview = ({
  stream,
  isVideoEnabled,
  nickname,
  isLocalVideo = false,
  showSubtitles = false,
}: VideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isFullscreen, handleDoubleClick } = useVideoFullscreen(containerRef, videoRef);

  // ⭐️ 수정 지점: 로컬/리모트 자막 활성화 상태를 모두 가져옵니다.
  const { isEnabled: localSubtitlesEnabled, isRemoteSubtitleEnabled } = useSubtitleStore();

  // ⭐️ 수정 지점: 자막 표시 조건을 분리합니다.
  // 로컬 비디오는 로컬 자막 상태를, 리모트 비디오는 리모트 자막 상태를 확인합니다.
  const shouldShowSubtitles = showSubtitles &&
                              (isLocalVideo ? localSubtitlesEnabled : isRemoteSubtitleEnabled);

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
        video.play().catch(err => console.warn(`[VideoPreview] ${nickname} - 재생 실패:`, err));
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
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocalVideo}
        className={cn(
          "transition-opacity duration-300",
          isFullscreen ? "w-full h-full object-contain" : "w-full h-full object-cover",
          stream && isVideoEnabled ? "opacity-100" : "opacity-0"
        )}
      />

      {(!stream || !isVideoEnabled) && !isFullscreen && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary/50 to-muted">
          <div className="w-20 h-20 lg:w-24 lg:h-24 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-3xl lg:text-4xl font-bold text-primary">
              {nickname.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* 자막 표시 - isRemote prop으로 로컬/리모트 구분 */}
      {shouldShowSubtitles && (
        <SubtitleDisplay
          videoRef={videoRef}
          isRemote={!isLocalVideo}
        />
      )}

      <div className={cn(
        "absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white",
        isFullscreen && "bottom-4 left-4 text-sm px-4 py-2"
      )}>
        {nickname} {isLocalVideo && "(You)"}
      </div>

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
};
