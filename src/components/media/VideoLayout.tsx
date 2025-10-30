import { DraggableVideo } from "@/components/media/DraggableVideo";
import { VideoPreview } from "@/components/media/VideoPreview";
import { Participant, useParticipants } from '@/hooks/useParticipants';
import { useResponsiveVideoGrid } from '@/hooks/useResponsiveGrid';
import { useScreenOrientation } from "@/hooks/useScreenOrientation";
import { cn } from "@/lib/utils";
import { useMediaDeviceStore } from "@/stores/useMediaDeviceStore";
import { useSubtitleStore } from "@/stores/useSubtitleStore";
import { useTranscriptionStore } from "@/stores/useTranscriptionStore";
import { useUIManagementStore } from "@/stores/useUIManagementStore";
import { Loader2, RotateCw } from "lucide-react";
import { useCallback, useMemo, useState } from 'react';
import { SubtitleOverlay } from './SubtitleOverlay';
import { Button } from '../ui/button';
import MobileSpeakerStrip from './MobileSpeakerStrip';

const LocalVideoTile = ({ participant, isMobile }: { participant: Participant; isMobile: boolean; }) => {
  const { switchCamera, isMobile: isDeviceMobile, hasMultipleCameras } = useMediaDeviceStore();
  const shouldShowCameraSwitch = isMobile && isDeviceMobile && hasMultipleCameras;
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
        isRelay={participant.isRelay}
      />
      {shouldShowCameraSwitch && (
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

const RemoteVideoTile = ({ participant, showAudioVisualizer = false }: { participant: Participant; showAudioVisualizer?: boolean; }) => {
  const { isRemoteSubtitleEnabled, remoteSubtitleCue } = useSubtitleStore();
  const { translationTargetLanguage } = useTranscriptionStore();
  const shouldShowFileSubtitle = participant.isStreamingFile && isRemoteSubtitleEnabled && remoteSubtitleCue;
  const shouldShowTranscript = !participant.isStreamingFile && participant.transcript;
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
        isRelay={participant.isRelay}
      />
      {shouldShowFileSubtitle && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-fit max-w-[90%] p-2.5 rounded-lg bg-black/60 backdrop-blur-md text-center pointer-events-none z-20">
          <p className="text-base sm:text-lg lg:text-xl font-semibold text-white leading-tight">
            {remoteSubtitleCue.text}
          </p>
        </div>
      )}
      {shouldShowTranscript && (
        <SubtitleOverlay transcript={participant.transcript} targetLang={translationTargetLanguage} />
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

const ViewerGallery = ({
  participants,
  mainParticipantId,
  onSelect,
}: {
  participants: Participant[];
  mainParticipantId: string | null;
  onSelect?: (userId: string) => void;
}) => {
  const { isPortrait } = useScreenOrientation();
  const galleryHeight = isPortrait
    ? "h-[12vh] min-h-[70px] max-h-[100px]"
    : "h-[20vh] min-h-[120px] max-h-[180px]";
  const spacing = isPortrait ? "space-x-1.5" : "space-x-2 sm:space-x-3";
  const padding = isPortrait ? "p-1.5" : "p-2 sm:p-3";
  if (participants.length === 0) return null;
  return (
    <div
      className={cn(
        "bg-background/80 backdrop-blur-sm flex items-center overflow-x-auto overflow-y-hidden",
        "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
        galleryHeight,
        padding
      )}
    >
      <div className={cn("flex items-center h-full", spacing)}>
        {participants.map((p) => {
          const isMainParticipant = p.userId === mainParticipantId;
          return (
            <div
              key={p.userId}
              className={cn(
                "h-full flex-shrink-0 rounded-md overflow-hidden relative group transition-all duration-200",
                "aspect-video cursor-pointer",
                isMainParticipant && "ring-2 ring-blue-500 ring-offset-2 ring-offset-background shadow-lg scale-105"
              )}
              onClick={() => onSelect?.(p.userId)}
              role="button"
              tabIndex={0}
              aria-label={`Switch to ${p.nickname}'s video`}
              aria-pressed={isMainParticipant}
            >
              <VideoPreview
                stream={p.stream}
                isVideoEnabled={p.videoEnabled}
                nickname={p.nickname}
                isLocalVideo={p.isLocal}
                showSubtitles={true}
                isScreenShare={p.isSharingScreen}
                isFileStreaming={p.isStreamingFile}
                isRelay={p.isRelay}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const VideoTile = ({ participant, isMobile }: { participant?: Participant | null; isMobile: boolean; }) => {
  if (!participant) return null;
  return participant.isLocal ? (
    <LocalVideoTile participant={participant} isMobile={isMobile} />
  ) : (
    <RemoteVideoTile participant={participant} showAudioVisualizer={false} />
  );
};

const WaitingScreen = ({ mode }: { mode: 'speaker' | 'viewer' }) => {
  const messages = {
    speaker: {
      title: "Waiting for another participant to join...",
      subtitle: "Your video will appear in the corner once someone joins"
    },
    viewer: {
      title: "Waiting for participants...",
      subtitle: "Select a participant from the gallery below"
    }
  };
  const message = messages[mode];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 rounded-lg gap-4 m-4">
      <Loader2 className="w-12 h-12 text-muted-foreground animate-spin" />
      <div className="text-center px-4">
        <p className="text-muted-foreground text-base sm:text-lg font-medium mb-2">
          {message.title}
        </p>
        <p className="text-muted-foreground/70 text-sm">
          {message.subtitle}
        </p>
      </div>
    </div>
  );
};

export const VideoLayout = () => {
  const { viewMode, mainContentParticipantId, setMainContentParticipant } = useUIManagementStore();
  const participants = useParticipants();
  const { isPortrait } = useScreenOrientation();

  const [showLocalVideo, setShowLocalVideo] = useState(true);
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);

  const gridConfig = useResponsiveVideoGrid(participants.length);

  const { localParticipant, remoteParticipants, hasRemoteParticipant } = useMemo(() => {
    const local = participants.find(p => p.isLocal);
    const remote = participants.filter(p => !p.isLocal);
    return { localParticipant: local, remoteParticipants: remote, hasRemoteParticipant: remote.length > 0 };
  }, [participants]);

  const getMainParticipant = useCallback((): Participant | null => {
    if (!hasRemoteParticipant) return null;
    if (viewMode === 'viewer' && mainContentParticipantId) {
      const viewerParticipant = participants.find(p => p.userId === mainContentParticipantId);
      return viewerParticipant || remoteParticipants[0];
    }
    if (focusedParticipantId) {
      const focused = participants.find(p => p.userId === focusedParticipantId);
      return focused || remoteParticipants[0];
    }
    return remoteParticipants[0];
  }, [
    hasRemoteParticipant,
    viewMode,
    mainContentParticipantId,
    focusedParticipantId,
    participants,
    remoteParticipants
  ]);

  const getPIPParticipants = useCallback((): Participant[] => {
    if (!localParticipant) return [];
    if (!hasRemoteParticipant) return [localParticipant];
    const mainParticipant = getMainParticipant();
    return participants.filter(p => p.userId !== mainParticipant?.userId);
  }, [localParticipant, hasRemoteParticipant, participants, getMainParticipant]);

  const handleFocusParticipant = useCallback((userId: string) => {
    if (viewMode === 'viewer') {
      setMainContentParticipant(userId);
    } else {
      setFocusedParticipantId(userId);
    }
  }, [viewMode, setMainContentParticipant]);

  const handleHidePIP = useCallback(() => {
    setShowLocalVideo(false);
  }, []);

  const handleShowPIP = useCallback(() => {
    setShowLocalVideo(true);
  }, []);

  if (!localParticipant) return null;

  const mainParticipant = getMainParticipant();
  const pipParticipants = getPIPParticipants();

  const renderGrid = () => (
    <div className={cn(
      gridConfig.containerClass,
      gridConfig.gridClass,
      gridConfig.gap,
      "overflow-hidden"
    )}>
      {participants.map(p => (
        <div key={p.userId} className={cn(gridConfig.itemClass, "overflow-hidden")}>
          <VideoTile participant={p} isMobile={gridConfig.isMobile} />
        </div>
      ))}
    </div>
  );

  if (viewMode === 'speaker') {
    return (
      <div className="relative h-full">
        {mainParticipant ? (
          <div className="absolute inset-0">
            <VideoTile participant={mainParticipant} isMobile={gridConfig.isMobile} />
          </div>
        ) : (
          <WaitingScreen mode="speaker" />
        )}
        {gridConfig.isMobile ? (
          <>
            {showLocalVideo && (
              <MobileSpeakerStrip
                participants={pipParticipants}
                mainParticipantId={mainParticipant?.userId || null}
                onSelect={handleFocusParticipant}
                onHide={handleHidePIP}
              />
            )}
            {!showLocalVideo && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShowPIP}
                className="fixed top-4 right-4 z-40 shadow-lg"
                aria-label="Show videos"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Show videos
              </Button>
            )}
          </>
        ) : (
          <>
            {showLocalVideo && pipParticipants.map((participant, index) => (
              <DraggableVideo
                key={participant.userId}
                userId={participant.userId}
                stream={participant.stream}
                nickname={participant.nickname}
                isVideoEnabled={participant.videoEnabled}
                isLocalVideo={participant.isLocal}
                onHide={handleHidePIP}
                onFocus={() => handleFocusParticipant(participant.userId)}
                canFocus={hasRemoteParticipant}
                isFocused={focusedParticipantId === participant.userId}
                stackIndex={index}
                stackGap={12}
                isRelay={participant.isRelay}
              />
            ))}
            {!showLocalVideo && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleShowPIP}
                className="fixed bottom-20 right-4 z-40 shadow-lg"
                aria-label="Show hidden videos"
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Show videos
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  if (viewMode === 'viewer') {
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 relative overflow-hidden min-h-0">
          {mainParticipant ? (
            <div className="absolute inset-0">
              <VideoTile participant={mainParticipant} isMobile={gridConfig.isMobile} />
            </div>
          ) : (
            <WaitingScreen mode="viewer" />
          )}
        </div>
        
        <ViewerGallery
          participants={
            mainParticipant
              ? participants.filter(p => p.userId !== mainParticipant.userId)
              : participants
          }
          mainParticipantId={mainParticipant?.userId || null}
          onSelect={setMainContentParticipant}
        />
      </div>
    );
  }

  if (gridConfig.layout === 'custom-3' && participants.length < 3) {
    return renderGrid();
  }

  if (gridConfig.layout === 'custom-3') {
    if (isPortrait) {
      return (
        <div className="flex flex-col h-full w-full p-2 gap-2 overflow-hidden">
          <div className="w-full overflow-hidden" style={{ height: 'calc(50% - 4px)' }}>
            <VideoTile participant={participants[0]} isMobile={true} />
          </div>
          <div className="w-full grid grid-cols-2 gap-2 overflow-hidden" style={{ height: 'calc(50% - 4px)' }}>
            {participants.slice(1).map(participant => (
              <div key={participant.userId} className="w-full h-full overflow-hidden">
                <VideoTile participant={participant} isMobile={true} />
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
        <div className="w-full grid grid-cols-2 gap-2 sm:gap-4 overflow-hidden" style={{ height: 'calc(50% - 4px)' }}>
          {participants.slice(0, 2).map(participant => (
            <div key={participant.userId} className="w-full h-full overflow-hidden">
              <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
            </div>
          ))}
        </div>
        <div className="w-full flex items-center justify-center overflow-hidden" style={{ height: 'calc(50% - 4px)' }}>
          <div className="w-full max-w-[50%] h-full overflow-hidden">
            <VideoTile participant={participants[2]} isMobile={gridConfig.isMobile} />
          </div>
        </div>
      </div>
    );
  }

  if (gridConfig.layout === 'custom-4' && participants.length < 4) {
    return renderGrid();
  }

  if (gridConfig.layout === 'custom-4') {
    return (
      <div className="flex flex-col h-full w-full p-2 sm:p-4 gap-2 sm:gap-4 overflow-hidden">
        <div className="w-full grid grid-cols-2 gap-2 sm:gap-4 overflow-hidden" style={{ height: 'calc(50% - 4px)' }}>
          {participants.slice(0, 2).map(participant => (
            <div key={participant.userId} className="w-full h-full overflow-hidden">
              <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
            </div>
          ))}
        </div>
        <div className="w-full grid grid-cols-2 gap-2 sm:gap-4 overflow-hidden" style={{ height: 'calc(50% - 4px)' }}>
          {participants.slice(2, 4).map(participant => (
            <div key={participant.userId} className="w-full h-full overflow-hidden">
              <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      gridConfig.containerClass,
      gridConfig.gridClass,
      gridConfig.gap,
      "overflow-hidden"
    )}>
      {participants.map(participant => (
        <div key={participant.userId} className={cn(gridConfig.itemClass, "overflow-hidden")}>
          <VideoTile participant={participant} isMobile={gridConfig.isMobile} />
        </div>
      ))}
    </div>
  );
};
