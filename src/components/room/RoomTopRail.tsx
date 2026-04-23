import type { RoomType } from '@/types/room.types';
import { Radio, ShieldCheck, Users, Palette, Clapperboard, RadioTower } from 'lucide-react';

interface RoomTopRailProps {
  roomTitle: string;
  roomType: RoomType;
  nickname: string;
  sessionMode?: 'board' | 'watch' | 'cast' | null;
}

const sessionModeMeta = {
  board: {
    label: 'Board mode',
    icon: Palette,
  },
  watch: {
    label: 'Watch mode',
    icon: Clapperboard,
  },
  cast: {
    label: 'Cast mode',
    icon: RadioTower,
  },
} as const;

export function RoomTopRail({ roomTitle, roomType, nickname, sessionMode = null }: RoomTopRailProps) {
  const audioOnlyRoom = roomType.startsWith('audio');

  return (
    <section
      aria-label="Room top rail"
      className="relative overflow-hidden rounded-[28px] border border-border/60 bg-card/75 px-4 py-3 shadow-sm backdrop-blur-sm sm:px-5"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.12),transparent_36%)] opacity-80" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1">
              {audioOnlyRoom ? <Radio className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {audioOnlyRoom ? 'Voice session' : 'Private session'}
            </span>
            <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-muted-foreground">
              {roomType}
            </span>
            {sessionMode ? (() => {
              const meta = sessionModeMeta[sessionMode];
              const Icon = meta.icon;
              return (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </span>
              );
            })() : null}
          </div>
          <h1 className="mt-2 truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {roomTitle}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            Live room
          </span>
          <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1.5">
            {nickname}
          </span>
        </div>
      </div>
    </section>
  );
}
