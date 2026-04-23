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
    <section aria-label="Preview stage" className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/80 p-4 shadow-sm sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--primary),0.12),transparent_45%)] opacity-90" />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            {audioOnlyRoom ? <Radio className="h-4 w-4 text-primary" /> : <ShieldCheck className="h-4 w-4 text-primary" />}
            {nickname}
          </span>
          <span>{audioOnlyRoom ? 'Voice-first presence' : 'Camera preview ready'}</span>
        </div>

        {audioOnlyRoom ? (
          <div className="rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-card p-5">
            <div className="mb-3 flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <h2 className="text-base font-semibold text-foreground">Audio-first preview</h2>
            </div>
            <p className="mb-4 text-sm leading-6 text-muted-foreground">
              Camera stays off here — voice and profile lead the room.
            </p>
            <AvatarPicker
              presets={avatarPresets}
              selectedAvatar={selectedAvatar}
              onSelect={onAvatarSelect}
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] bg-muted">
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
