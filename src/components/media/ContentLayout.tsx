import { useIsMobile } from '@/hooks/use-mobile';
import { Participant, useParticipants } from '@/hooks/useParticipants';
import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { ScreenShare } from 'lucide-react';
import { useMemo } from 'react';
import { isAudioRoom } from '@/types/roomCapabilities';
import { AudioRoomLayout } from './AudioRoomLayout';
import { VideoLayout } from './VideoLayout';
import { VideoPreview } from './VideoPreview';

const MainContentViewer = ({ participant }: { participant: Participant }) => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <VideoPreview
        stream={participant.stream}
        isVideoEnabled={true}
        nickname={participant.nickname}
        isLocalVideo={participant.isLocal}
        showSubtitles={true}
        isScreenShare={participant.isSharingScreen}
        isFileStreaming={participant.isStreamingFile}
        isRelay={participant.isRelay}
        userId={participant.userId}
      />
    </div>
  );
};

const ParticipantGallery = ({
  participants,
  mainParticipantId,
  onSelect,
}: {
  participants: Participant[],
  mainParticipantId: string | null;
  onSelect: (userId: string) => void;
}) => {
  const { isPortrait } = useScreenOrientation();
  const isMobile = useIsMobile();
  const galleryHeight = isPortrait
    ? 'h-[12vh] min-h-[70px] max-h-[100px]'
    : 'h-[20vh] min-h-[120px] max-h-[180px]';
  if (participants.length === 0) return null;
  return (
    <div className={cn(
      "flex items-center overflow-x-auto overflow-y-hidden border-t border-white/[0.06] bg-[#0b0b10]/88 backdrop-blur-xl",
      "scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent",
      galleryHeight,
      isPortrait ? "p-1.5" : "p-2 sm:p-3"
    )}>
      <div className={cn(
        "flex items-center h-full",
        isPortrait ? "space-x-1.5" : "space-x-2 sm:space-x-3"
      )}>
        {participants.map(p => (
          <button
            type="button"
            key={p.userId}
            className={cn(
              "h-full flex-shrink-0 overflow-hidden rounded-xl relative group transition-all duration-200",
              "aspect-video cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b10]",
              p.userId === mainParticipantId && "ring-2 ring-indigo-400/70 ring-offset-2 ring-offset-[#0b0b10] shadow-[0_18px_45px_-28px_rgba(99,102,241,0.9)] scale-105"
            )}
            onClick={() => onSelect(p.userId)}
            aria-label={`${p.nickname} on the main screen`}
            aria-pressed={p.userId === mainParticipantId}
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
              userId={p.userId}
            />
            {p.userId === mainParticipantId && (
              <div className="absolute top-1 left-1 bg-blue-500/90 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 opacity-100 transition-opacity shadow-md">
                <ScreenShare size={10} />
                <span className="hidden sm:inline text-[10px]">Sharing</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export const ContentLayout = () => {
  const { mainContentParticipantId, setMainContentParticipant } = useUIManagementStore();
  const participants = useParticipants();
  const localUserId = useSessionStore(state => state.userId);
  const roomType = useSessionStore(state => state.roomType);
  const mainParticipant = participants.find(p => p.userId === mainContentParticipantId);

  const galleryParticipants = useMemo(() => {
    if (!mainParticipant) {
      return participants;
    }
    const otherParticipants = participants.filter(p => p.userId !== mainParticipant.userId);
    if (mainParticipant.isLocal) {
      return otherParticipants;
    }
    const isLocalInGallery = otherParticipants.some(p => p.isLocal);
    if (!isLocalInGallery) {
      const localUser = participants.find(p => p.isLocal);
      if (localUser) {
        return [localUser, ...otherParticipants];
      }
    }
    return otherParticipants;
  }, [participants, mainParticipant]);

  if (roomType && isAudioRoom(roomType)) {
    return <AudioRoomLayout />;
  }

  if (mainParticipant) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex-1 relative overflow-hidden min-h-0">
          <MainContentViewer participant={mainParticipant} />
        </div>
        <ParticipantGallery
          participants={galleryParticipants}
          mainParticipantId={mainParticipant.userId}
          onSelect={setMainContentParticipant}
        />
      </div>
    );
  }

  return <VideoLayout />;
};
