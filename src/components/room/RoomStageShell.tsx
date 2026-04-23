import type { ReactNode } from 'react';

interface RoomStageShellProps {
  children: ReactNode;
  sessionMode?: 'board' | 'watch' | 'cast' | null;
}

const stageModeMeta = {
  board: {
    label: 'Board mode',
    description: 'Collaborative whiteboard is steering the session right now.',
  },
  watch: {
    label: 'Watch mode',
    description: 'Shared watching is the active stage while people and chat stay attached.',
  },
  cast: {
    label: 'Cast mode',
    description: 'PonsCast takes the stage while files and playback stay visible as room context.',
  },
} as const;

export function RoomStageShell({ children, sessionMode = null }: RoomStageShellProps) {
  return (
    <section
      aria-label="Room stage shell"
      className="relative min-h-0 overflow-hidden rounded-[32px] border border-border/60 bg-card/65 shadow-sm backdrop-blur-sm"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--primary),0.10),transparent_42%)] opacity-80" />
      {sessionMode ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 border-b border-white/10 bg-[linear-gradient(180deg,rgba(9,12,22,0.92),rgba(9,12,22,0.55),rgba(9,12,22,0))] px-4 py-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            {stageModeMeta[sessionMode].label}
          </div>
          <p className="mt-2 text-sm text-slate-300">{stageModeMeta[sessionMode].description}</p>
        </div>
      ) : null}
      <div className={`relative h-full min-h-[420px] w-full overflow-hidden ${sessionMode ? 'pt-20' : ''}`}>
        {children}
      </div>
    </section>
  );
}
