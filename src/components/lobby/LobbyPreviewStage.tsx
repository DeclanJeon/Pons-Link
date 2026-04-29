import { AvatarPicker } from '@/components/lobby/AvatarPicker';
import { VideoPreview } from '@/components/media/VideoPreview';
import { Radio, ShieldCheck, Sparkles } from 'lucide-react';
import type { AvatarPreset } from '@/lib/avatar/dicebear';

interface LobbyPreviewStageProps {
  audioOnlyRoom: boolean;
  localStream: MediaStream | null;
  isVideoEnabled: boolean;
  nickname: string;
  avatarPresets: AvatarPreset[];
  selectedAvatar: AvatarPreset;
  onAvatarSelect: (preset: AvatarPreset) => void;
}

export function LobbyPreviewStage({
  audioOnlyRoom,
  localStream,
  isVideoEnabled,
  nickname,
  avatarPresets,
  selectedAvatar,
  onAvatarSelect,
}: LobbyPreviewStageProps) {
  return (
    <section
      aria-label="Preview stage"
      className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,hsl(229_22%_10%_/_0.98),hsl(224_26%_7%_/_0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)_/_0.14),transparent_42%),radial-gradient(circle_at_bottom_right,hsl(var(--primary-glow)_/_0.1),transparent_30%)]" />
      <div className="relative space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary-subtle/75">Presence preview</p>
          <div className="flex flex-col gap-3 rounded-[24px] border border-white/[0.08] bg-black/20 px-4 py-4 text-sm text-slate-300/75 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              {audioOnlyRoom ? <Radio className="h-4 w-4 text-primary" /> : <ShieldCheck className="h-4 w-4 text-primary" />}
              {nickname}
            </span>
            <span>{audioOnlyRoom ? 'Voice-first presence' : 'Camera preview ready'}</span>
          </div>
        </div>

        {audioOnlyRoom ? (
          <div className="rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,hsl(230_20%_12%_/_0.94),hsl(226_20%_9%_/_0.98))] p-5">
            <div className="mb-3 flex items-center gap-2 text-primary-subtle">
              <Sparkles className="h-4 w-4" />
              <h2 className="text-base font-semibold text-foreground">Audio-first preview</h2>
            </div>
            <p className="mb-4 text-sm leading-6 text-slate-300/[0.74]">
              Camera stays off here — voice and profile lead the room.
            </p>
            <AvatarPicker
              presets={avatarPresets}
              selectedAvatar={selectedAvatar}
              onSelect={onAvatarSelect}
            />
          </div>
        ) : (
          <div className="min-h-[320px] overflow-hidden rounded-[26px] border border-white/[0.08] bg-black/[0.45] sm:min-h-[380px]">
            <VideoPreview
              stream={localStream}
              isVideoEnabled={isVideoEnabled}
              nickname={nickname}
              isLocalVideo={true}
            />
          </div>
        )}
      </div>
    </section>
  );
}
