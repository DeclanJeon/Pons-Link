import { useVideoFullscreen } from "@/hooks/useVideoFullscreen";
import { cn } from "@/lib/utils";
import { useSubtitleStore } from "@/stores/useSubtitleStore";
import { useDeviceMetadataStore, ObjectFitOption } from "@/stores/useDeviceMetadataStore";
import { Maximize2, Settings } from "lucide-react";
import { useEffect, useRef, memo, useMemo } from "react";
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
  audioLevel?: number;
  showVoiceFrame?: boolean;
  isLocalVideo?: boolean;
  showSubtitles?: boolean;
  isScreenShare?: boolean;
  isFileStreaming?: boolean;
  isRelay?: boolean;
  userId?: string; // 원격 피어 식별용
}

const OBJECT_FIT_OPTIONS: { value: ObjectFitOption; label: string; description: string }[] = [
  { value: 'contain', label: 'Fit to Screen', description: 'Show entire video, may have black bars' },
  { value: 'cover', label: 'Fill Screen', description: 'Fill entire area, may crop video' },
  { value: 'fill', label: 'Stretch', description: 'Stretch to fill, may distort' },
  { value: 'scale-down', label: 'Scale Down', description: 'Never enlarge, only shrink' }
];

export const VideoPreview = memo(({
  stream,
  isVideoEnabled,
  nickname,
  isLocalVideo = false,
 showSubtitles = false,
  isScreenShare = false,
  isFileStreaming = false,
  isRelay = false,
  userId
}: VideoPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { isFullscreen, handleDoubleClick } = useVideoFullscreen(containerRef, videoRef);
 const { isEnabled: localSubtitlesEnabled } = useSubtitleStore();
  
  // 로컬 비디오가 아니고 파일 스트리밍 중인데 스트림이 없는 경우 (PonsCast 바이너리 스트리밍)
  const isBinaryStreaming = isFileStreaming && !isLocalVideo && !stream && userId;
  
  // ✅ Local Metadata 구독
  const { localMetadata, setPreferredObjectFit } = useDeviceMetadataStore();
  
  // ✅ Remote Metadata 구독 (userId가 있을 때만)
  // Zustand selector가 Map 내부 값 변경을 감지하여 리렌더링을 트리거합니다.
  const remoteMetadata = useDeviceMetadataStore(
    (state) => userId ? state.remoteMetadata.get(userId) : undefined
  );
  
  // ✅ Object-fit 결정 로직 (Derived State)
  // useEffect/useState를 제거하고 렌더링 시점에 즉시 계산하여 동기화 문제 해결
  const objectFit: ObjectFitOption = useMemo(() => {
    // 화면 공유나 파일 스트리밍은 항상 contain
    if (isScreenShare || isFileStreaming) return 'contain';
    
    // 로컬 비디오인 경우 로컬 설정 사용
    if (isLocalVideo) {
      return localMetadata.preferredObjectFit;
    }
    
    // 원격 비디오인 경우 수신된 메타데이터 사용
    if (remoteMetadata) {
      return remoteMetadata.preferredObjectFit;
    }
    
    // 기본값
    return 'cover';
  }, [isScreenShare, isFileStreaming, isLocalVideo, localMetadata.preferredObjectFit, remoteMetadata]);
  
  // 비디오 스트림 설정
  useEffect(() => {
    if (!videoRef.current || isBinaryStreaming) return;
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
  }, [stream, isLocalVideo, nickname, isBinaryStreaming]);
  
  const shouldShowSubtitles = showSubtitles && isLocalVideo && localSubtitlesEnabled;

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
        "relative w-full h-full bg-muted rounded-lg overflow-hidden flex items-center justify-center shadow-md border border-border/20 group",
        isFullscreen && "fixed inset-0 z-50 rounded-none bg-black"
      )}
      onDoubleClick={handleDoubleClick}
      tabIndex={0}
    >
      {/* 비디오 엘리먼트 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocalVideo && !isRelay}
        className={cn(
          "transition-all duration-300",
          isFullscreen ? "w-full h-full" : "w-full h-full",
          stream && isVideoEnabled ? "opacity-100" : "opacity-0"
        )}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: objectFit, // ✅ 계산된 objectFit 직접 적용
          objectPosition: 'center'
        }}
      />

      {/* 자막 표시 */}
      {shouldShowSubtitles && (
        <SubtitleDisplay videoRef={videoRef} />
      )}

      {/* 릴레이 스트림 표시 */}
      {isRelay && (
        <div className="absolute top-2 left-2 bg-purple-600/90 text-white text-xs px-2 py-1 rounded-full shadow">
          Relay Stream
        </div>
      )}

      {/* 비디오 꺼짐 상태 */}
      {(!stream || !isVideoEnabled) && !isFullscreen && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-secondary/50 to-muted">
          <div className="w-20 h-20 lg:w-24 lg:h-24 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-3xl lg:text-4xl font-bold text-primary">
              {nickname.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* 하단 닉네임 표시 */}
      <div className={cn(
        "absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white",
        isFullscreen && "bottom-4 left-4 text-sm px-4 py-2"
      )}>
        {nickname} {isLocalVideo && "(You)"}
      </div>

      {/* 컨트롤 버튼들 */}
      {!isFullscreen && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
          {/* Object-Fit 설정 (로컬 비디오만) */}
          {isLocalVideo && !isScreenShare && !isFileStreaming && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-black/60 backdrop-blur-sm p-2 rounded-lg hover:bg-black/80"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Settings className="w-4 h-4 text-white" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Video Display Mode</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {OBJECT_FIT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreferredObjectFit(option.value); // ✅ 스토어 업데이트
                    }}
                    className={cn(
                      "flex flex-col items-start gap-1 cursor-pointer",
                      objectFit === option.value && "bg-primary/10"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{option.label}</span>
                      {objectFit === option.value && (
                        <span className="text-xs text-primary">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* 전체화면 버튼 */}
          <div className="bg-black/60 backdrop-blur-sm p-2 rounded-lg">
            <Maximize2 className="w-4 h-4 text-white" />
          </div>
        </div>
      )}

      {/* 전체화면 안내 */}
      {!isFullscreen && (
        <div className="absolute bottom-2 right-2 text-xs text-white/50 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-1 rounded">
          Double-click or Press F
        </div>
      )}

      {/* 전체화면 종료 안내 */}
      {isFullscreen && (
        <div className="absolute top-4 right-4 text-sm text-white/70 bg-black/60 px-3 py-2 rounded">
          Press ESC to exit fullscreen
        </div>
      )}
    </div>
  );
});

VideoPreview.displayName = 'VideoPreview';
