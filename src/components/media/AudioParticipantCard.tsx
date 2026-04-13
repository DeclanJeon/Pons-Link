import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Participant } from '@/hooks/useParticipants';
import type { AvatarPreset } from '@/lib/avatar/dicebear';
import { Mic, MicOff, ScreenShare } from 'lucide-react';

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
        'rounded-2xl border bg-card/70 backdrop-blur-sm p-5 shadow-sm transition-all',
        activeSpeaking ? 'border-primary/60 ring-2 ring-primary/20 shadow-primary/10' : 'border-border/60'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="h-16 w-16 border border-border/70 shadow-sm">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={participant.nickname} /> : null}
            <AvatarFallback className="text-lg font-semibold">{fallbackText}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {participant.nickname} {participant.isLocal ? '(You)' : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {activeSpeaking ? 'Speaking / connected' : participant.connectionState}
            </p>
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
    </div>
  );
};
