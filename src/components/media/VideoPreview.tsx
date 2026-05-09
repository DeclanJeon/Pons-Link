import { useVideoFullscreen } from "@/hooks/useVideoFullscreen";
import { cn } from "@/lib/utils";
import { useSubtitleStore } from "@/stores/useSubtitleStore";
import { useDeviceMetadataStore, VideoDisplayMode } from "@/stores/useDeviceMetadataStore";
import { VIDEO_DISPLAY_OPTIONS } from '@/lib/media/videoDisplayOptions';
import { useMediaQualityStore } from '@/stores/useMediaQualityStore';
import {
  blendReframePosition,
  DEFAULT_CAMERA_REFRAME_POSITION,
  detectCameraReframePosition,
  type CameraReframePosition,
} from '@/lib/media/cameraReframe';
import { Focus, Maximize2, Settings } from "lucide-react";
import { useEffect, useRef, memo, useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { SubtitleDisplay } from "../functions/fileStreaming/SubtitleDisplay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { PonsCastReceiverViewer } from "./PonsCastReceiverViewer";

interface VideoPreviewProps {
  stream?: MediaStream | null;
  isVideoEnabled: boolean;
  nickname: string;
  avatarUrl?: string;
  audioLevel?: number;
  showVoiceFrame?: boolean;
  isLocalVideo?: boolean;
 showSubtitles?: boolean;
  isScreenShare?: boolean;
  isFileStreaming?: boolean;
  isRelay?: boolean;
  userId?: string; // 원격 피어 식별용
}

const getVideoObjectFit = (displayMode: VideoDisplayMode): CSSProperties['objectFit'] => {
  return displayMode === 'fill' ? 'cover' : 'contain';
};

const getVideoAspectRatio = (stream?: MediaStream | null): number | null => {
  const settings = stream?.getVideoTracks?.()[0]?.getSettings?.();
  const width = settings?.width;
  const height = settings?.height;

  if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
    return width / height;
  }

  return null;
};

const CAMERA_PRIVACY_LABELS = {
  avatar: 'Avatar',
  'live-avatar': 'Live Avatar',
} as const;

export const VideoPreview = memo(({
  stream,
  isVideoEnabled,
  nickname,
  avatarUrl,
  isLocalVideo = false,
 showSubtitles = false,
  isScreenShare = false,
  isFileStreaming = false,
  isRelay = false,
  userId
}: VideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backdropVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reframeTimerRef = useRef<number | null>(null);
  const [measuredAspectRatio, setMeasuredAspectRatio] = useState<number | null>(() => getVideoAspectRatio(stream));
  const [reframePosition, setReframePosition] = useState<CameraReframePosition>(DEFAULT_CAMERA_REFRAME_POSITION);
  
  const { isFullscreen, handleDoubleClick } = useVideoFullscreen(containerRef, videoRef);
 const { isEnabled: localSubtitlesEnabled } = useSubtitleStore();
  
  // 로컬 비디오가 아니고 파일 스트리밍 중인데 스트림이 없거나 비디오 트랙이 없는 경우 (PonsCast 바이너리 스트리밍)
  const hasUsableVideoTrack = !!stream && typeof stream.getVideoTracks === 'function' && stream.getVideoTracks().length > 0;
  const isBinaryStreaming = !!(isFileStreaming && !isLocalVideo && userId && !hasUsableVideoTrack);
  
  // ✅ Local Metadata 구독
  const { localMetadata, setPreferredObjectFit } = useDeviceMetadataStore();
  const localCameraPrivacyMode = useMediaQualityStore(state => state.cameraPrivacyMode);
  const localVideoMirrored = useMediaQualityStore(state => state.localVideoMirrored);
  
  // ✅ Remote Metadata 구독 (userId가 있을 때만)
  // Zustand selector가 Map 내부 값 변경을 감지하여 리렌더링을 트리거합니다.
  const remoteMetadata = useDeviceMetadataStore(
    (state) => userId ? state.remoteMetadata.get(userId) : undefined
  );
  
  // ✅ Object-fit 결정 로직 (Derived State)
  // useEffect/useState를 제거하고 렌더링 시점에 즉시 계산하여 동기화 문제 해결
  const displayMode: VideoDisplayMode = useMemo(() => {
    // 화면 공유나 파일 스트리밍은 항상 전체 콘텐츠를 보존
    if (isScreenShare || isFileStreaming) return 'fit';
    
    // 로컬 비디오인 경우 로컬 설정 사용
    if (isLocalVideo) {
      return localMetadata.preferredObjectFit;
    }
    
    // 원격 비디오인 경우 수신된 메타데이터 사용
    if (remoteMetadata) {
      return remoteMetadata.preferredObjectFit;
    }
    
    // 기본값
    return 'balanced';
  }, [isScreenShare, isFileStreaming, isLocalVideo, localMetadata.preferredObjectFit, remoteMetadata]);

  const objectFit = getVideoObjectFit(displayMode);
  const shouldUseDynamicCameraFrame =
    (displayMode === 'balanced' || displayMode === 'fit') &&
    !isScreenShare &&
    !isFileStreaming &&
    !!stream &&
    isVideoEnabled;
  const shouldUseMeetStyleReframe =
    displayMode === 'reframe' &&
    !isScreenShare &&
    !isFileStreaming &&
    !!stream &&
    isVideoEnabled;
  const shouldUseSoftFillBackdrop = (displayMode === 'balanced' && shouldUseDynamicCameraFrame) || shouldUseMeetStyleReframe;
  const shouldUseFaceReframe =
    displayMode === 'reframe' &&
    !isScreenShare &&
    !isFileStreaming &&
    !!stream &&
    isVideoEnabled;
  const shouldShowReframeControl = isLocalVideo && !isScreenShare && !isFileStreaming;
  const shouldMirrorLocalVideo = isLocalVideo && localVideoMirrored && !isScreenShare && !isFileStreaming;
  const cameraPrivacyMode = isLocalVideo ? localCameraPrivacyMode : remoteMetadata?.cameraPrivacyMode;
  const cameraPrivacyLabel = cameraPrivacyMode === 'avatar' || cameraPrivacyMode === 'live-avatar'
    ? CAMERA_PRIVACY_LABELS[cameraPrivacyMode]
    : null;

  const videoAspectRatio = measuredAspectRatio ?? getVideoAspectRatio(stream) ?? 16 / 9;
  const dynamicFrameStyle = useMemo<CSSProperties>(() => {
    if (!shouldUseDynamicCameraFrame) return {};

    return {
      aspectRatio: String(videoAspectRatio),
      width: videoAspectRatio >= 1 ? '100%' : 'auto',
      height: videoAspectRatio < 1 ? '100%' : 'auto',
      maxWidth: '100%',
      maxHeight: '100%',
    };
  }, [shouldUseDynamicCameraFrame, videoAspectRatio]);

  const updateMeasuredAspectRatio = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;

    setMeasuredAspectRatio(video.videoWidth / video.videoHeight);
  };

  const handleReframeClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setReframePosition(DEFAULT_CAMERA_REFRAME_POSITION);
    setPreferredObjectFit('reframe');
  };

  useEffect(() => {
    if (!shouldUseFaceReframe) {
      if (reframeTimerRef.current !== null) {
        window.clearTimeout(reframeTimerRef.current);
        reframeTimerRef.current = null;
      }
      setReframePosition(DEFAULT_CAMERA_REFRAME_POSITION);
      return;
    }

    let cancelled = false;

    const schedule = (delay = 900) => {
      reframeTimerRef.current = window.setTimeout(runDetection, delay);
    };

    const runDetection = async () => {
      const video = videoRef.current;
      if (!video || cancelled) return;

      try {
        const nextPosition = await detectCameraReframePosition(video);
        if (nextPosition && !cancelled) {
          setReframePosition((current) => blendReframePosition(current, nextPosition));
        }
      } catch (error) {
        console.warn('[VideoPreview] Camera reframe detection unavailable:', error);
      }

      if (!cancelled) schedule();
    };

    schedule(250);

    return () => {
      cancelled = true;
      if (reframeTimerRef.current !== null) {
        window.clearTimeout(reframeTimerRef.current);
        reframeTimerRef.current = null;
      }
    };
  }, [shouldUseFaceReframe, stream]);
  
  // 비디오 스트림 설정
  useEffect(() => {
    if (!videoRef.current || isBinaryStreaming) return;
    const video = videoRef.current;
    const backdropVideo = backdropVideoRef.current;
    const currentSrc = video.srcObject;

    setMeasuredAspectRatio(getVideoAspectRatio(stream));
    
    if (!stream) {
      if (currentSrc) video.srcObject = null;
      if (backdropVideo?.srcObject) backdropVideo.srcObject = null;
      return;
    }
    
	    if (currentSrc !== stream) {
	      if (typeof MediaStream !== 'undefined' && currentSrc instanceof MediaStream) video.srcObject = null;
	      video.srcObject = stream;
	      if (video.paused) {
	        const playPromise = video.play();
	        if (playPromise && typeof playPromise.catch === 'function') {
	          playPromise.catch(() => {});
	        }
	      }
    }

    if (backdropVideo && backdropVideo.srcObject !== stream) {
      if (typeof MediaStream !== 'undefined' && backdropVideo.srcObject instanceof MediaStream) {
        backdropVideo.srcObject = null;
      }
      backdropVideo.srcObject = stream;
      if (backdropVideo.paused) {
        const playPromise = backdropVideo.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
	      }
	    }
	  }, [stream, displayMode, isLocalVideo, nickname, isBinaryStreaming]);
  
  const shouldShowSubtitles = showSubtitles && isLocalVideo && localSubtitlesEnabled;

  const handleTileKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (key !== 'enter' && key !== ' ' && key !== 'f') return;

    event.preventDefault();
    event.stopPropagation();
    handleDoubleClick();
  };

  if (isBinaryStreaming && userId) {
    return (
      <PonsCastReceiverViewer 
        nickname={nickname}
        userId={userId}
        className={cn(isFullscreen && "fixed inset-0 z-50 rounded-none bg-black")}
      />
    );
  }

 return (
    <div
      ref={containerRef}
      className={cn(
        "group relative flex h-full w-full items-center justify-center overflow-hidden bg-[#050507] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050507]",
        isFullscreen && "fixed inset-0 z-[90] rounded-none bg-black"
      )}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleTileKeyDown}
      role="button"
      aria-label={`${nickname} 비디오 타일. Enter 또는 F 키로 전체화면 전환`}
      tabIndex={0}
    >
      {shouldUseSoftFillBackdrop && (
        <video
          ref={backdropVideoRef}
          autoPlay
          playsInline
          muted
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full scale-[1.03] object-cover opacity-35 brightness-50 saturate-75 transition-opacity duration-300",
            stream && isVideoEnabled ? "opacity-[0.18] brightness-[0.32] contrast-125 saturate-[0.78]" : "opacity-0"
          )}
          style={{
            transform: shouldMirrorLocalVideo ? 'scaleX(-1) scale(1.03)' : undefined,
          }}
        />
      )}

      {shouldUseDynamicCameraFrame ? (
        <div
          className="relative z-10 overflow-hidden bg-[#050507]"
          style={dynamicFrameStyle}
          data-video-display-mode={displayMode}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocalVideo && !isRelay}
            onLoadedMetadata={updateMeasuredAspectRatio}
            onResize={updateMeasuredAspectRatio}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-300",
              stream && isVideoEnabled ? "opacity-100" : "opacity-0"
            )}
            style={{
              objectPosition: 'center',
              transform: shouldMirrorLocalVideo ? 'scaleX(-1)' : undefined,
            }}
          />
        </div>
      ) : shouldUseMeetStyleReframe ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocalVideo && !isRelay}
          onLoadedMetadata={updateMeasuredAspectRatio}
          onResize={updateMeasuredAspectRatio}
          className={cn(
            "relative z-10 h-full w-full transition-all duration-300",
            stream && isVideoEnabled ? "opacity-100" : "opacity-0"
          )}
          data-video-display-mode={displayMode}
          style={{
            objectFit: 'contain',
            objectPosition: `${reframePosition.x}% ${reframePosition.y}%`,
            transform: shouldMirrorLocalVideo ? 'scaleX(-1)' : undefined,
          }}
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocalVideo && !isRelay}
          onLoadedMetadata={updateMeasuredAspectRatio}
          onResize={updateMeasuredAspectRatio}
          className={cn(
            "transition-all duration-300",
            isFullscreen ? "w-full h-full" : "w-full h-full",
            stream && isVideoEnabled ? "opacity-100" : "opacity-0"
          )}
          data-video-display-mode={displayMode}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit,
            objectPosition: displayMode === 'reframe'
              ? `${reframePosition.x}% ${reframePosition.y}%`
              : 'center',
            transform: shouldMirrorLocalVideo ? 'scaleX(-1)' : undefined,
          }}
        />
      )}

      {/* 자막 표시 */}
      {shouldShowSubtitles && (
        <SubtitleDisplay videoRef={videoRef} />
      )}

      {/* 릴레이 스트림 표시 */}
      {isRelay && (
        <div className="absolute left-2 top-2 rounded-full border border-indigo-300/20 bg-indigo-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-100 shadow backdrop-blur-md">
          Relaying
        </div>
      )}

      {cameraPrivacyLabel && !isScreenShare && !isFileStreaming && (
        <div
          aria-label={`Camera status: ${cameraPrivacyLabel}`}
          className={cn(
            "absolute left-2 z-20 rounded-full border border-violet-200/15 bg-violet-400/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-100 shadow backdrop-blur-md",
            isRelay ? "top-10" : "top-2"
          )}
        >
          {cameraPrivacyLabel}
        </div>
      )}

      {/* 비디오 꺼짐 상태 */}
      {(!stream || !isVideoEnabled) && !isFullscreen && (
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.16),transparent_38%),linear-gradient(180deg,rgba(17,17,22,0.92),rgba(5,5,7,0.98))]">
          {avatarUrl ? (
            <img src={avatarUrl} alt={nickname} className="h-20 w-20 rounded-full object-cover ring-1 ring-white/[0.12] lg:h-24 lg:w-24" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-400/10 ring-1 ring-indigo-400/20 lg:h-24 lg:w-24">
              <span className="text-3xl font-bold text-indigo-200 lg:text-4xl">
                {nickname.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 하단 닉네임 표시 */}
      <div className={cn(
        "absolute bottom-2 left-2 z-20 rounded-full bg-black/55 px-3 py-1 text-xs text-white backdrop-blur-md ring-1 ring-white/[0.08]",
        isFullscreen && "bottom-4 left-4 text-sm px-4 py-2"
      )}>
        {nickname} {isLocalVideo && "(You)"}
      </div>

      {/* 컨트롤 버튼들 */}
      {!isFullscreen && (
        <div className="absolute right-2 top-2 z-30 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {shouldShowReframeControl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 w-9 rounded-lg bg-black/55 p-0 backdrop-blur-md hover:bg-black/75 focus-visible:ring-indigo-300",
                displayMode === 'reframe' && "bg-violet-400/18 text-violet-100 ring-1 ring-violet-200/20"
              )}
              aria-label="Reframe camera / 얼굴 중앙 맞춤"
              onClick={handleReframeClick}
            >
              <Focus className="h-4 w-4 text-white" />
            </Button>
          )}

          {/* Object-Fit 설정 (로컬 비디오만) */}
          {isLocalVideo && !isScreenShare && !isFileStreaming && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Video display settings"
                  className="h-9 w-9 rounded-lg bg-black/55 p-0 backdrop-blur-md hover:bg-black/75"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Settings className="w-4 h-4 text-white" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Camera Framing</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {VIDEO_DISPLAY_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreferredObjectFit(option.value);
                    }}
                    className={cn(
                      "flex flex-col items-start gap-1 cursor-pointer",
                      displayMode === option.value && "bg-indigo-400/10"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{option.label}</span>
                      {displayMode === option.value && (
                        <span className="text-xs text-indigo-300">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-zinc-500">
                      {option.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* 전체화면 버튼 */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 rounded-lg bg-black/55 p-0 backdrop-blur-md hover:bg-black/75 focus-visible:ring-indigo-300"
            aria-label="Enter fullscreen / 전체화면으로 보기"
            onClick={(e) => {
              e.stopPropagation();
              handleDoubleClick();
            }}
          >
            <Maximize2 className="w-4 h-4 text-white" />
          </Button>
        </div>
      )}

      {/* 전체화면 안내 */}
      {!isFullscreen && (
        <div className="absolute bottom-2 right-2 hidden rounded bg-black/55 px-2 py-1 text-xs text-white/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:block">
          더블클릭 또는 F 키로 전체화면
        </div>
      )}

      {/* 전체화면 종료 안내 */}
      {isFullscreen && (
        <div className="absolute right-4 top-4 rounded bg-black/55 px-3 py-2 text-sm text-white/70">
          ESC 키로 전체화면 종료
        </div>
      )}
    </div>
  );
});

VideoPreview.displayName = 'VideoPreview';
