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
      className={audioOnlyRoom && isMobile ? 'sticky bottom-0 z-10 rounded-[28px] border border-border/60 bg-background/95 p-4 shadow-lg backdrop-blur-xl' : 'rounded-[32px] border border-border/60 bg-card/80 p-5 shadow-sm sm:p-6'}
    >
      {audioOnlyRoom && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Camera stays off
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            Voice-first entry
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5">
            <Waves className="h-3.5 w-3.5 text-primary" />
            Mic test ready
          </span>
        </div>
      )}

      <Button onClick={onJoinRoom} className="w-full rounded-2xl text-base shadow-lg shadow-primary/20 sm:h-12 sm:text-lg" aria-label={ctaLabel}>
        {ctaLabel}
      </Button>
    </section>
  );
}
