import { Button } from '@/components/ui/button';
import { ShieldCheck, Users, Waves } from 'lucide-react';

interface LobbyJoinFooterProps {
  audioOnlyRoom: boolean;
  isMobile: boolean;
  onJoinRoom: () => void;
}

export function LobbyJoinFooter({ audioOnlyRoom, isMobile, onJoinRoom }: LobbyJoinFooterProps) {
  const ctaLabel = audioOnlyRoom ? 'Enter Voice Room' : 'Join Room';

  return (
    <section
      aria-label="Join footer"
      className={
        audioOnlyRoom && isMobile
          ? 'sticky bottom-0 z-10 rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,hsl(228_19%_12%_/_0.96),hsl(225_24%_8%_/_0.98))] p-4 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl'
          : 'rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,hsl(228_19%_12%_/_0.96),hsl(225_24%_8%_/_0.98))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5'
      }
    >
      {audioOnlyRoom && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-300/[0.72]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary-subtle" />
            Camera stays off
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-primary-subtle" />
            Voice-first entry
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
            <Waves className="h-3.5 w-3.5 text-primary-subtle" />
            Mic test ready
          </span>
        </div>
      )}

      <Button
        onClick={onJoinRoom}
        className="w-full rounded-[22px] border border-primary/[0.15] bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary-glow)))] text-base text-primary-foreground shadow-[0_20px_44px_-20px_hsl(var(--primary)_/_0.95)] transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-95 sm:h-12 sm:text-lg"
        aria-label={ctaLabel}
      >
        {ctaLabel}
      </Button>
    </section>
  );
}
