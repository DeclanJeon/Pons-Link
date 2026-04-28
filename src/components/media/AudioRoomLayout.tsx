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
    <div className="h-full w-full overflow-y-auto bg-[#050507] px-4 py-5 text-white sm:px-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-5">
        <section aria-label="Audio room summary" className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#111116]/88 p-6 shadow-[0_30px_120px_-65px_rgba(0,0,0,0.95)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_34%)] opacity-80" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200">
                <Radio className="h-3.5 w-3.5" />
                Voice lounge
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Audio room focused on voice
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                Participants stay visible while shared media takes the stage only when someone starts presenting.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">
                <Users className="h-3.5 w-3.5 text-indigo-300" />
                {connectedCount}/{participants.length} connected
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">
                <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                Avatar-first presence
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">
                <Radio className="h-3.5 w-3.5 text-indigo-300" />
                Audio room focus
              </span>
            </div>
          </div>
          <div className="relative mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">People present</p>
              <p className="mt-2 text-sm text-zinc-400">Everyone stays visible through lightweight presence tiles.</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">Speaking cues</p>
              <p className="mt-2 text-sm text-zinc-400">Voice activity remains the primary motion language.</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08] md:col-span-2 xl:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">Shared surface</p>
              <p className="mt-2 text-sm text-zinc-400">Shared media takes over only when it is active.</p>
            </div>
          </div>
        </section>

        {sharedParticipant && sharedParticipant.stream && (
          <section aria-label="Audio shared stage" className="min-h-[260px] overflow-hidden rounded-[28px] bg-black ring-1 ring-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0b0b10]/88 px-4 py-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">Shared surface live</p>
                <p className="mt-1 text-sm text-zinc-400">{sharedParticipant.nickname} is currently carrying the room surface.</p>
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
