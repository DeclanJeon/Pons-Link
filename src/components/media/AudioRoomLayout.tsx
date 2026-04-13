import { useMemo } from 'react';
import { useParticipants } from '@/hooks/useParticipants';
import { getStoredAvatarPreset } from '@/lib/avatar/dicebear';
import { AudioParticipantCard } from './AudioParticipantCard';
import { VideoPreview } from './VideoPreview';
import { useUIManagementStore } from '@/stores/useUIManagementStore';

export const AudioRoomLayout = () => {
  const participants = useParticipants();
  const localAvatar = useMemo(() => getStoredAvatarPreset(), []);
  const { mainContentParticipantId } = useUIManagementStore();

  const mainParticipant = participants.find((participant) => participant.userId === mainContentParticipantId);
  const sharedParticipant = mainParticipant || participants.find((participant) => participant.isSharingScreen || participant.isStreamingFile);
  const cardParticipants = sharedParticipant
    ? participants.filter((participant) => participant.userId !== sharedParticipant.userId)
    : participants;

  return (
    <div className="h-full w-full overflow-y-auto bg-background px-4 py-5 sm:px-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4">
        {sharedParticipant && sharedParticipant.stream && (
          <div className="min-h-[260px] overflow-hidden rounded-2xl border border-border/60 bg-black shadow-sm">
            <VideoPreview
              stream={sharedParticipant.stream}
              isVideoEnabled
              nickname={sharedParticipant.nickname}
              isLocalVideo={sharedParticipant.isLocal}
              showSubtitles
              isScreenShare={sharedParticipant.isSharingScreen}
              isFileStreaming={sharedParticipant.isStreamingFile}
              isRelay={sharedParticipant.isRelay}
              userId={sharedParticipant.userId}
            />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cardParticipants.map((participant) => (
            <AudioParticipantCard
              key={participant.userId}
              participant={participant}
              localAvatar={localAvatar}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
