import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, Sparkles, Users } from 'lucide-react';
import { useParticipants } from '@/hooks/useParticipants';
import { getStoredAvatarPreset } from '@/lib/avatar/dicebear';
import { AudioParticipantCard } from './AudioParticipantCard';
import { VideoPreview } from './VideoPreview';
import { useUIManagementStore } from '@/stores/useUIManagementStore';

export const AudioRoomLayout = () => {
  const { t } = useTranslation();
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
        <section aria-label={t('room.audio.summaryAria')} className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#111116]/88 p-6 shadow-[0_30px_120px_-65px_rgba(0,0,0,0.95)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.18),transparent_34%)] opacity-80" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200">
                <Radio className="h-3.5 w-3.5" />
                {t('room.audio.eyebrow')}
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {t('room.audio.title')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
                {t('room.audio.description')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">
                <Users className="h-3.5 w-3.5 text-indigo-300" />
                {t('room.audio.connected', { connected: connectedCount, total: participants.length })}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">
                <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                {t('room.audio.avatarPresence')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300">
                <Radio className="h-3.5 w-3.5 text-indigo-300" />
                {t('room.audio.audioFocus')}
              </span>
            </div>
          </div>
          <div className="relative mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">{t('room.audio.peoplePresent')}</p>
              <p className="mt-2 text-sm text-zinc-400">{t('room.audio.peoplePresentDesc')}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">{t('room.audio.speakingCues')}</p>
              <p className="mt-2 text-sm text-zinc-400">{t('room.audio.speakingCuesDesc')}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/[0.08] md:col-span-2 xl:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">{t('room.audio.sharedSurface')}</p>
              <p className="mt-2 text-sm text-zinc-400">{t('room.audio.sharedSurfaceDesc')}</p>
            </div>
          </div>
        </section>

        {sharedParticipant && sharedParticipant.stream && (
          <section aria-label={t('room.audio.sharedStageAria')} className="min-h-[260px] overflow-hidden rounded-[28px] bg-black ring-1 ring-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0b0b10]/88 px-4 py-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">{t('room.audio.sharedSurfaceLive')}</p>
                <p className="mt-1 text-sm text-zinc-400">{t('room.audio.sharedParticipant', { nickname: sharedParticipant.nickname })}</p>
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

        <section aria-label={t('room.audio.participantGridAria')} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
