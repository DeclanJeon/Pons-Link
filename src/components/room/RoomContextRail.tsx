import type { PanelType, ViewMode } from '@/stores/useUIManagementStore';
import { Clapperboard, Files, LayoutPanelTop, MessageSquareText, Palette, RadioTower, Users } from 'lucide-react';
import { useChatStore } from '@/stores/useChatStore';

interface RoomContextRailProps {
  activePanel: PanelType;
  viewMode: ViewMode;
}

const panelLabels: Record<PanelType, string> = {
  none: 'Chat',
  chat: 'Chat',
  whiteboard: 'Whiteboard',
  settings: 'Settings',
  fileStreaming: 'PonsCast',
  relay: 'Media Relay',
  cowatch: 'CoWatch',
};

const viewLabels: Record<ViewMode, string> = {
  grid: 'Group view',
  speaker: 'Focus view',
  viewer: 'Content view',
};

export function RoomContextRail({ activePanel, viewMode }: RoomContextRailProps) {
  const activeLabel = panelLabels[activePanel];
  const unreadCount = useChatStore((state) => state.unreadCount);
  const activeTransfers = useChatStore((state) => state.fileTransfers.size);

  const tabs = [
    { label: 'Chat', icon: MessageSquareText },
    { label: 'People', icon: Users },
    { label: 'Shared', icon: Files },
    { label: 'Collaborate', icon: Palette },
  ] as const;

  return (
    <aside
      role="region"
      aria-label="Room context rail"
      className="flex min-h-[420px] flex-col gap-4 rounded-[32px] border border-border/60 bg-card/75 p-4 shadow-sm backdrop-blur-sm"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">Context</p>
        <h2 className="mt-2 text-lg font-semibold text-foreground">Keep the session in flow</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The shell keeps people, chat, and collaboration surfaces in one system instead of hiding them behind disconnected popups.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {tabs.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={(label === 'Chat' && activePanel === 'chat') || (label === 'Collaborate' && ['whiteboard', 'fileStreaming', 'relay', 'cowatch'].includes(activePanel)) || (label === 'Shared' && activePanel === 'fileStreaming') || (label === 'People' && activePanel === 'none')}
            className="flex items-center justify-between rounded-2xl border border-border/50 bg-background/60 px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-primary/30"
          >
            <span className="inline-flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {label}
            </span>
            {label === 'Chat' && unreadCount > 0 ? (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {unreadCount} unread
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <LayoutPanelTop className="h-4 w-4 text-primary" />
            Current mode
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{viewLabels[viewMode]}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MessageSquareText className="h-4 w-4 text-primary" />
            Active surface
          </div>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="active-surface-label">{activeLabel}</p>
        </div>
      </div>

      <div className="grid flex-1 gap-2">
        <div className="rounded-2xl border border-border/50 bg-background/60 p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <MessageSquareText className="h-4 w-4 text-primary" />
            Chat
          </div>
          Room-native messages, replies, and unread context stay visible here.
        </div>
        <div className="rounded-2xl border border-border/50 bg-background/60 p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <Users className="h-4 w-4 text-primary" />
            People
          </div>
          Participants, presence, and session state summaries live in the rail.
        </div>
        <div className="rounded-2xl border border-border/50 bg-background/60 p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <Files className="h-4 w-4 text-primary" />
            Shared
          </div>
          {activeTransfers > 0 ? `${activeTransfers} active transfers` : 'Shared files, media, and transfer activity stay visible here.'}
        </div>
        <div className="rounded-2xl border border-border/50 bg-background/60 p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
            <Palette className="h-4 w-4 text-primary" />
            Collaborate
          </div>
          Whiteboard, CoWatch, PonsCast, and Relay shift the room into purpose-built session modes.
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1"><Palette className="h-3.5 w-3.5" />Whiteboard</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1"><Clapperboard className="h-3.5 w-3.5" />CoWatch</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1"><RadioTower className="h-3.5 w-3.5" />PonsCast</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
