import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit3, Radio, ShieldCheck } from 'lucide-react';
import type { RoomType } from '@/types/room.types';

interface LobbyIdentityStripProps {
  roomTitle: string;
  roomType: RoomType;
  audioOnlyRoom: boolean;
  localNickname: string;
  onNicknameInputChange: (value: string) => void;
  onNicknameSubmit: () => void;
  onNicknameFocus: () => void;
  showParticipantGuidance: boolean;
}

export function LobbyIdentityStrip({
  roomTitle,
  roomType,
  audioOnlyRoom,
  localNickname,
  onNicknameInputChange,
  onNicknameSubmit,
  onNicknameFocus,
  showParticipantGuidance,
}: LobbyIdentityStripProps) {
  return (
    <section aria-label="Lobby identity" className="relative overflow-hidden rounded-[32px] border border-border/60 bg-card/80 p-5 shadow-sm sm:p-6 lg:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.14),transparent_34%)] opacity-80" />
      <div className="relative space-y-4 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">
            {audioOnlyRoom ? <Radio className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {audioOnlyRoom ? 'Audio lounge' : 'Private room'}
          </span>
          <span className="inline-flex items-center rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {roomType}
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/70">Your space is ready</p>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            {audioOnlyRoom ? 'Voice Lobby' : 'Lobby'}
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground sm:mx-0 sm:text-base">
            Check your presence, then step in.
          </p>
        </div>

        <div className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-border/50 bg-background/60 p-4 sm:flex-row sm:items-center">
          <div className="space-y-1 text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Room title</p>
            <p className="text-lg font-semibold text-foreground">{roomTitle}</p>
          </div>

          <div className="flex items-center gap-2 sm:min-w-[280px] sm:justify-end">
            <Input
              type="text"
              value={localNickname}
              onChange={(event) => onNicknameInputChange(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && onNicknameSubmit()}
              onFocus={onNicknameFocus}
              className="h-10"
              placeholder="Enter nickname"
              aria-label="Nickname input"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onNicknameSubmit}
              className="h-10 w-10 shrink-0 p-0"
              aria-label="Save nickname"
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showParticipantGuidance && (
          <p className="text-sm text-amber-500/90">
            Audio group rooms allow up to 8 participants. On mobile, 6 or fewer is recommended for more stable calls.
          </p>
        )}
      </div>
    </section>
  );
}
