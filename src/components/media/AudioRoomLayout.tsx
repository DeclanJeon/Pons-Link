import { useMemo } from 'react';
import { Radio, Sparkles, Users } from 'lucide-react';
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
  const connectedCount = participants.filter((participant) => participant.connectionState === 'connected').length;

  return (
    <div className="h-full w-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(var(--primary),0.14),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.04),transparent_28%)] px-4 py-5 sm:px-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5">
        <section className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/85 p-6 shadow-sm backdrop-blur-sm">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.14),transparent_34%)] opacity-80" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                <Radio className="h-3.5 w-3.5" />
                Voice lounge
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                화면보다 목소리에 집중하는 오디오 룸
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                누가 들어와 있는지, 누가 말하고 있는지, 어떤 공유가 진행 중인지 한눈에 보이도록 정리된 오디오 전용 공간입니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground/80 border border-border/60">
                <Users className="h-3.5 w-3.5 text-primary" />
                {connectedCount}/{participants.length} connected
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground/80 border border-border/60">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Avatar-first presence
              </span>
            </div>
          </div>
        </section>

        {sharedParticipant && sharedParticipant.stream && (
          <div className="min-h-[260px] overflow-hidden rounded-[28px] border border-border/60 bg-black shadow-sm">
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
