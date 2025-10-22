// components/media/VideoLayout.tsx
import { DraggableVideo } from "@/components/media/DraggableVideo";
import { VideoPreview } from "@/components/media/VideoPreview";
import { Participant, useParticipants } from '@/hooks/useParticipants';
import { useResponsiveVideoGrid } from '@/hooks/useResponsiveGrid';
import { cn } from "@/lib/utils";
import { useMediaDeviceStore } from "@/stores/useMediaDeviceStore";
import { useSubtitleStore } from "@/stores/useSubtitleStore";
import { useTranscriptionStore } from "@/stores/useTranscriptionStore";
import { useUIManagementStore } from "@/stores/useUIManagementStore";
import { Eye, Loader2, RotateCw } from "lucide-react";
import { useState } from 'react';
import { SubtitleOverlay } from '../functions/SubtitleOverlay';
import { Button } from '../ui/button';

const LocalVideoTile = ({ participant, isMobile }: { participant: Participant; isMobile: boolean }) => {
  const { switchCamera, isMobile: isDeviceMobile, hasMultipleCameras } = useMediaDeviceStore();

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg bg-muted">
      <VideoPreview
        stream={participant.stream}
        nickname={participant.nickname}
        isVideoEnabled={participant.videoEnabled}
        isLocalVideo={true}
        audioLevel={0}
        showSubtitles={false}
        isScreenShare={participant.isSharingScreen}
        isFileStreaming={participant.isStreamingFile}
      />

      {isMobile && isDeviceMobile && hasMultipleCameras && (
        <Button
          variant="ghost"
          size="sm"
          onClick={switchCamera}
          className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm p-0 hover:bg-black/50 transition-colors"
          aria-label="Switch camera"
        >
          <RotateCw className="w-5 h-5 text-white" />
        </Button>
      )}
    </div>
  );
};

const RemoteVideoTile = ({
  participant,
  showAudioVisualizer
}: {
  participant: Participant;
  showAudioVisualizer: boolean;
}) => {
  const { isRemoteSubtitleEnabled } = useSubtitleStore();
  const { translationTargetLanguage } = useTranscriptionStore();
  const { remoteSubtitleCue } = useSubtitleStore();

  return (
    <div className="relative w-full h-full overflow-hidden rounded-lg bg-muted">
      <VideoPreview
        stream={participant.stream}
        nickname={participant.nickname}
        isVideoEnabled={participant.videoEnabled}
        isLocalVideo={false}
        audioLevel={0}
        showSubtitles={false}
        showVoiceFrame={false}
        isScreenShare={participant.isSharingScreen}
        isFileStreaming={participant.isStreamingFile}
      />

      {participant.isStreamingFile && isRemoteSubtitleEnabled && remoteSubtitleCue && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-fit max-w-[90%] p-2.5 rounded-lg bg-black/60 backdrop-blur-md text-center pointer-events-none z-20">
          <p className="text-base sm:text-lg lg:text-xl font-semibold text-white leading-tight">
            {remoteSubtitleCue.text}
          </p>
        </div>
      )}

      {!participant.isStreamingFile && participant.transcript && (
        <SubtitleOverlay
          transcript={participant.transcript}
          targetLang={translationTargetLanguage}
        />
      )}

      {participant.connectionState === 'connecting' && (
        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center rounded-lg gap-4">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white text-base sm:text-lg font-medium px-4 text-center">
            Connecting to {participant.nickname}...
          </p>
        </div>
      )}

      {(participant.connectionState === 'disconnected' || participant.connectionState === 'failed') && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
          <p className="text-white text-base sm:text-lg font-medium px-4 text-center">
            Connection to {participant.nickname} lost.
          </p>
        </div>
      )}
    </div>
  );
};

const VideoTile = ({ participant, isMobile }: { participant: Participant; isMobile: boolean }) => {
  return participant.isLocal ? (
    <LocalVideoTile participant={participant} isMobile={isMobile} />
  ) : (
    <RemoteVideoTile participant={participant} showAudioVisualizer={false} />
  );
};

export const VideoLayout = () => {
  const { viewMode, viewerModeParticipantId, setViewerModeParticipant } = useUIManagementStore();
  const participants = useParticipants();
  const localParticipant = participants.find(p => p.isLocal);
  const remoteParticipants = participants.filter(p => !p.isLocal);

  const [showLocalVideo, setShowLocalVideo] = useState(true);
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);

  const gridConfig = useResponsiveVideoGrid(participants.length);

  if (!localParticipant) return null;

  const hasRemoteParticipant = remoteParticipants.length > 0;

  const getMainParticipant = (): Participant | null => {
    if (!hasRemoteParticipant) return null;

    if (viewMode === 'viewer' && viewerModeParticipantId) {
      const viewerParticipant = participants.find(p => p.userId === viewerModeParticipantId);
      return viewerParticipant || remoteParticipants[0];
    }

    if (focusedParticipantId) {
      const focused = participants.find(p => p.userId === focusedParticipantId);
      return focused || remoteParticipants[0];
    }

    return remoteParticipants[0];
  };

  const getPIPParticipants = (): Participant[] => {
    if (!hasRemoteParticipant) return [localParticipant];
    const mainParticipant = getMainParticipant();
    return participants.filter(p => p.userId !== mainParticipant?.userId);
  };

  const handleFocusParticipant = (userId: string) => {
    if (viewMode === 'viewer') {
      setViewerModeParticipant(userId);
    } else {
      setFocusedParticipantId(userId);
    }
  };

  const mainParticipant = getMainParticipant();
  const pipParticipants = getPIPParticipants();

  // ============================================================
  // 스피커/뷰어 모드
  // ============================================================
  if (viewMode === 'speaker' || viewMode === 'viewer') {
    return (
      <div className="relative h-full">
        {mainParticipant ? (
          <div className="absolute inset-0">
            <VideoTile participant={mainParticipant} isMobile={gridConfig.isMobile} />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 rounded-lg gap-4 m-4">
            <Loader2 className="w-12 h-12 text-muted-foreground animate-spin" />
            <div className="text-center px-4">
              <p className="text-muted-foreground text-base sm:text-lg font-medium mb-2">
                Waiting for another participant to join...
              </p>
              <p className="text-muted-foreground/70 text-sm">
                Your video will appear in the corner once someone joins
              </p>
            </div>
          </div>
        )}

        {showLocalVideo && pipParticipants.map((participant, index) => (
          <DraggableVideo
            key={participant.userId}
            stream={participant.stream}
            nickname={participant.nickname}
            isVideoEnabled={participant.videoEnabled}
            isLocalVideo={participant.isLocal}
            onHide={() => setShowLocalVideo(false)}
            onFocus={() => handleFocusParticipant(participant.userId)}
            canFocus={hasRemoteParticipant}
            isFocused={focusedParticipantId === participant.userId}
            stackIndex={viewMode === 'viewer' ? index : undefined}
            stackGap={viewMode === 'viewer' ? 12 : undefined}
          />
        ))}

        {!showLocalVideo && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowLocalVideo(true)}
            className="fixed bottom-20 right-4 z-40 shadow-lg"
          >
            <Eye className="w-4 h-4 mr-2" />
            Show videos
          </Button>
        )}
      </div>
    );
  }

  // ============================================================
  // 그리드 모드: 3명 커스텀 레이아웃
  // ============================================================
  if (gridConfig.layout === 'custom-3') {
    // 모바일 세로: 상단 1개, 하단 2개
    if (gridConfig.isPortrait) {
      return (
        <div className="flex flex-col h-full w-full p-2 gap-2 overflow-hidden">
          {/* ✅ 상단 1개 - 높이 50% */}
          <div
            className="w-full overflow-hidden"
            style={{ height: 'calc(50% - 4px)' }}
          >
            <VideoTile participant={participants[0]} isMobile={true} />
          </div>

          {/* ✅ 하단 2개 - 높이 50% */}
          <div
            className="w-full grid grid-cols-2 gap-2 overflow-hidden"
            style={{ height: 'calc(50% - 4px)' }}
          >
            {participants.slice(1).map(participant => (
              <div key={participant.userId} className="w-full h-full overflow-hidden">
                <VideoTile participant={participant} isMobile={true} />
              </div>
            ))}
          </div>
        </div>
      );
    }

    // 데스크톱/모바일 가로: 상단 2개, 하단 중앙 1개
    return (
      <div className="flex flex-col h-full w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
        {/* 상단 2개 */}
        <div
          className="w-full grid grid-cols-2 gap-2 sm:gap-4 overflow-hidden"
          style={{ height: 'calc(50% - 4px)' }}
        >
          {participants.slice(0, 2).map(participant => (
            <div key={participant.userId} className="w-full h-full overflow-hidden">
              <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
            </div>
          ))}
        </div>

        {/* 하단 중앙 1개 */}
        <div
          className="w-full flex items-center justify-center overflow-hidden"
          style={{ height: 'calc(50% - 4px)' }}
        >
          <div className="w-full max-w-[50%] h-full overflow-hidden">
            <VideoTile participant={participants[2]} isMobile={gridConfig.isMobile} />
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // 그리드 모드: 4명 커스텀 레이아웃
  // ============================================================
  if (gridConfig.layout === 'custom-4') {
    return (
      <div className="flex flex-col h-full w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
        {/* 상단 2개 - 높이 50% */}
        <div
          className="w-full grid grid-cols-2 gap-2 sm:gap-4 overflow-hidden"
          style={{ height: 'calc(50% - 4px)' }}
        >
          {participants.slice(0, 2).map(participant => (
            <div key={participant.userId} className="w-full h-full overflow-hidden">
              <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
            </div>
          ))}
        </div>

        {/* 하단 2개 - 높이 50% */}
        <div
          className="w-full grid grid-cols-2 gap-2 sm:gap-4 overflow-hidden"
          style={{ height: 'calc(50% - 4px)' }}
        >
          {participants.slice(2, 4).map(participant => (
            <div key={participant.userId} className="w-full h-full overflow-hidden">
              <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================
  // 기본 그리드 레이아웃
  // ============================================================
  return (
    <div className={cn(
      gridConfig.containerClass,
      gridConfig.gridClass,
      gridConfig.gap,
      "overflow-hidden"
    )}>
      {participants.map(participant => (
        <div
          key={participant.userId}
          className={cn(gridConfig.itemClass, "overflow-hidden")}
        >
          <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
        </div>
      ))}
    </div>
  );
};
