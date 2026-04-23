import DraggableControlBar from '@/components/navigator/DraggableControlBar';
import { Button } from '@/components/ui/button';
import { DoorOpen } from 'lucide-react';

interface RoomBottomDockProps {
  onLeaveRoom: () => void;
}

export function RoomBottomDock({ onLeaveRoom }: RoomBottomDockProps) {
  return (
    <section
      aria-label="Room bottom dock"
      className="relative overflow-hidden rounded-[28px] border border-border/60 bg-card/75 px-4 py-3 shadow-sm backdrop-blur-sm"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(var(--primary),0.08),transparent_48%)] opacity-80" />
      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">Session controls</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Core room actions stay reachable while the shell grows around the existing feature set.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onLeaveRoom} aria-label="Leave room" className="rounded-full">
            <DoorOpen className="mr-2 h-4 w-4" />
            Leave room
          </Button>
          <div className="min-w-0 flex-1 lg:flex-none">
            <DraggableControlBar />
          </div>
        </div>
      </div>
    </section>
  );
}
