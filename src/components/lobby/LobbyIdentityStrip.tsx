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
    <section
      aria-label="Lobby identity"
      className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,hsl(228_20%_11%_/_0.98),hsl(225_24%_8%_/_0.98))] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:px-5 sm:py-6 lg:px-6"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)_/_0.18),transparent_34%),linear-gradient(135deg,transparent_58%,hsl(var(--primary-glow)_/_0.08)_100%)]" />
      <div className="relative space-y-5 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.12] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-subtle">
            {audioOnlyRoom ? <Radio className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {audioOnlyRoom ? 'Audio lounge' : 'Open room'}
          </span>
          <span className="inline-flex items-center rounded-full border border-primary-glow/20 bg-primary-glow/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary-glow">
            {roomType}
          </span>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-primary-subtle/75">Your space is ready</p>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl lg:text-[2.7rem]">
            {audioOnlyRoom ? 'Voice Lobby' : 'Lobby'}
          </h1>
          <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-300/[0.78] sm:mx-0 sm:max-w-3xl sm:text-base">
            Set your identity, check your signal, and step into the room without friction.
          </p>
        </div>

        <div className="grid gap-4 rounded-[24px] border border-white/[0.08] bg-black/20 px-4 py-4 backdrop-blur-sm sm:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] sm:items-end sm:px-5">
          <div className="space-y-2 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Room title</p>
            <p className="text-lg font-semibold tracking-[-0.02em] text-foreground sm:text-[1.15rem]">{roomTitle}</p>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-right">Display name</p>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={localNickname}
                onChange={(event) => onNicknameInputChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && onNicknameSubmit()}
                onFocus={onNicknameFocus}
                className="h-11 rounded-2xl border-white/10 bg-white/[0.04] px-4 text-foreground placeholder:text-slate-500 focus-visible:ring-primary/60 focus-visible:ring-offset-0"
                placeholder="Enter nickname"
                aria-label="Nickname input"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={onNicknameSubmit}
                className="h-11 w-11 shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-0 text-slate-200 transition-colors hover:bg-primary/[0.12] hover:text-primary-subtle"
                aria-label="Save nickname"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {showParticipantGuidance && (
          <p className="rounded-2xl border border-primary-glow/[0.15] bg-primary-glow/10 px-4 py-3 text-sm leading-6 text-primary-subtle/[0.85]">
            Audio group rooms allow up to 8 participants. On mobile, 6 or fewer is recommended for more stable calls.
          </p>
        )}
      </div>
    </section>
  );
}
