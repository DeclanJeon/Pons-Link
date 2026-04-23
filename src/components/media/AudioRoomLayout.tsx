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
        <section aria-label="Audio room summary" className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/85 p-6 shadow-sm backdrop-blur-sm">
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
              <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground/80 border border-border/60">
                <Radio className="h-3.5 w-3.5 text-primary" />
                Audio room focus
              </span>
            </div>
          </div>
          <div className="relative mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">People present</p>
              <p className="mt-2 text-sm text-muted-foreground">Everyone stays visible through lounge cards while shared surfaces take the feature stage only when needed.</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">Speaking cues</p>
              <p className="mt-2 text-sm text-muted-foreground">Voice activity and speaking presence remain the main motion language of the room.</p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/70 p-4 md:col-span-2 xl:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">Shared surface policy</p>
              <p className="mt-2 text-sm text-muted-foreground">Only shared media or screen activity takes over the stage; everything else stays lightweight.</p>
            </div>
          </div>
        </section>

        {sharedParticipant && sharedParticipant.stream && (
          <section aria-label="Audio shared stage" className="min-h-[260px] overflow-hidden rounded-[28px] border border-border/60 bg-black shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 bg-background/80 px-4 py-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">Shared surface live</p>
                <p className="mt-1 text-sm text-muted-foreground">{sharedParticipant.nickname} is currently carrying the room surface.</p>
              </div>
            </div>
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
          </section>
        )}

        <section aria-label="Voice lounge participant grid" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cardParticipants.map((participant) => (
            <AudioParticipantCard
              key={participant.userId}
              participant={participant}
              localAvatar={localAvatar}
            />
          ))}
        </section>
      </div>
    </div>
  );
};
