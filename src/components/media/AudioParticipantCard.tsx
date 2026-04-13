import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Participant } from '@/hooks/useParticipants';
import type { AvatarPreset } from '@/lib/avatar/dicebear';
import { Mic, MicOff, Radio, ScreenShare, Sparkles } from 'lucide-react';

interface AudioParticipantCardProps {
  participant: Participant;
  localAvatar?: AvatarPreset | null;
}

export const AudioParticipantCard = ({ participant, localAvatar }: AudioParticipantCardProps) => {
  const fallbackText = participant.nickname.slice(0, 2).toUpperCase();
  const avatarUrl = participant.isLocal ? (participant.avatarUrl || localAvatar?.url) : participant.avatarUrl;
  const activeSpeaking = participant.audioEnabled && participant.connectionState === 'connected';

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[28px] border p-5 shadow-sm transition-all duration-300',
        activeSpeaking
          ? 'border-primary/40 bg-gradient-to-br from-primary/12 via-card to-card ring-1 ring-primary/20 shadow-lg shadow-primary/10'
          : 'border-border/60 bg-card/80 backdrop-blur-sm hover:border-primary/20 hover:shadow-md'
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.12),transparent_35%)] opacity-70" />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-16 w-16 border border-border/70 shadow-md shadow-black/5">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={participant.nickname} /> : null}
              <AvatarFallback className="text-lg font-semibold">{fallbackText}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">
                {participant.nickname} {participant.isLocal ? '(You)' : ''}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  activeSpeaking ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  <Radio className="h-3.5 w-3.5" />
                  {activeSpeaking ? 'Speaking now' : participant.connectionState}
                </span>
                {participant.isLocal && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] font-medium text-foreground/70">
                    <Sparkles className="h-3.5 w-3.5" />
                    Local profile
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {participant.isSharingScreen && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                <ScreenShare className="h-3.5 w-3.5" />
                Screen
              </span>
            )}
            <span className={cn(
              'inline-flex items-center justify-center rounded-full p-2',
              participant.audioEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'
            )}>
              {participant.audioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-background/70 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {activeSpeaking
            ? '음성이 안정적으로 연결되어 있어요. 지금 이 참여자의 목소리를 또렷하게 들을 수 있습니다.'
            : '아직 말하고 있지 않더라도, 아바타와 상태 배지로 누가 방에 있는지 편하게 확인할 수 있습니다.'}
        </div>
      </div>
    </div>
  );
};
