import { useVideoFullscreen } from "@/hooks/useVideoFullscreen";
import { cn } from "@/lib/utils";
import { useSubtitleStore } from "@/stores/useSubtitleStore";
import { useDeviceMetadataStore, ObjectFitOption } from "@/stores/useDeviceMetadataStore";
import { Maximize2, Settings } from "lucide-react";
import { useEffect, useRef, useState, memo, useCallback } from "react";
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
  const [showFullName, setShowFullName] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const { isFullscreen, handleDoubleClick } = useVideoFullscreen(containerRef, videoRef);
 const { isEnabled: localSubtitlesEnabled } = useSubtitleStore();
  
  // 디바이스 메타데이터 가져오기
  const { localMetadata, getRemoteMetadata, setPreferredObjectFit } = useDeviceMetadataStore();
  
  // Object-fit 결정 로직
  const determineObjectFit = useCallback((): ObjectFitOption => {
    // 화면 공유나 파일 스트리밍은 항상 contain
    if (isScreenShare || isFileStreaming) return 'contain';
    
    // 로컬 비디오인 경우
    if (isLocalVideo) {
      return localMetadata.preferredObjectFit;
    }
    
    // 원격 비디오인 경우 - 원격 피어의 메타데이터 사용
    if (userId) {
      const remoteMetadata = getRemoteMetadata(userId);
      if (remoteMetadata) {
        return remoteMetadata.preferredObjectFit;
      }
    }
    
    // 기본값
    return 'cover';
  }, [isScreenShare, isFileStreaming, isLocalVideo, userId, localMetadata, getRemoteMetadata]);
  
  const [currentObjectFit, setCurrentObjectFit] = useState<ObjectFitOption>(determineObjectFit());
  
  // Object-fit 변경 핸들러
  const handleObjectFitChange = useCallback((newFit: ObjectFitOption) => {
    if (isLocalVideo) {
      setPreferredObjectFit(newFit);
      setCurrentObjectFit(newFit);
    }
  }, [isLocalVideo, setPreferredObjectFit]);
  
  // 메타데이터 변경 시 object-fit 업데이트
 useEffect(() => {
    setCurrentObjectFit(determineObjectFit());
  }, [determineObjectFit, localMetadata, userId]);
  
  // 비디오 스트림 설정
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
  
  const shouldShowSubtitles = showSubtitles && isLocalVideo && localSubtitlesEnabled;

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
      onMouseLeave={() => {
        setShowFullName(false);
        setShowSettings(false);
      }}
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
          objectFit: currentObjectFit,
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
            <DropdownMenu open={showSettings} onOpenChange={setShowSettings}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="bg-black/60 backdrop-blur-sm p-2 rounded-lg hover:bg-black/80"
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
                    onClick={() => handleObjectFitChange(option.value)}
                    className={cn(
                      "flex flex-col items-start gap-1 cursor-pointer",
                      currentObjectFit === option.value && "bg-primary/10"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">{option.label}</span>
                      {currentObjectFit === option.value && (
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
