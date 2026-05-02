/**
 * 채팅 패널 헤더 컴포넌트 (전체화면 버튼 추가)
 * @module ChatHeader
 */

import { Button } from '@/components/ui/button';
import { X, Search, Maximize2, Minimize2, Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CHAT_MESSAGES } from '@/constants/chat.constants';

interface ChatHeaderProps {
  messageCount: number;
  searchMode: boolean;
  isFullscreen: boolean;
  meetingMinutesCount?: number;
  meetingMinutesEnabled?: boolean;
  onSearchToggle: () => void;
  onFullscreenToggle: () => void;
  onToggleMeetingMinutes?: () => void;
  onDownloadMeetingMinutes?: () => void;
  onClose: () => void;
}

export const ChatHeader = ({
  messageCount,
  searchMode,
  isFullscreen,
  meetingMinutesCount = 0,
  meetingMinutesEnabled = false,
  onSearchToggle,
  onFullscreenToggle,
  onToggleMeetingMinutes,
  onDownloadMeetingMinutes,
  onClose
}: ChatHeaderProps) => {
  const minutesLabel = meetingMinutesEnabled ? 'Recording' : 'Minutes';

  return (
    <div className="border-b border-white/[0.08] bg-[#09090d]/96 px-4 py-3 shadow-[0_18px_60px_-46px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.65)]" />
            <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">PonsLink room</p>
          </div>
          <div className="mt-1 flex min-w-0 items-baseline gap-2">
            <h3 className="truncate text-[17px] font-semibold tracking-[-0.035em] text-white">Chat</h3>
            <span className="shrink-0 text-[11px] font-medium text-zinc-500">
              {messageCount} messages
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-zinc-500">
            Messages, files, and meeting records stay in one timeline.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {meetingMinutesCount > 0 && onDownloadMeetingMinutes && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownloadMeetingMinutes}
              className="relative h-9 w-9 rounded-full p-0 text-zinc-300 transition-all duration-200 hover:bg-emerald-400/10 hover:text-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-300/50"
              title="Download meeting records"
              aria-label={`Download ${meetingMinutesCount} meeting records`}
            >
              <Download className="w-4 h-4" />
              <span className="absolute -right-1 -top-1 min-w-4 rounded-full border border-[#09090d] bg-emerald-300 px-1 text-[9px] font-black leading-4 text-[#06130d]">
                {meetingMinutesCount > 99 ? '99+' : meetingMinutesCount}
              </span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onSearchToggle}
            className={cn(
              "h-9 w-9 rounded-full p-0 text-zinc-300 transition-all duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-200/45",
              searchMode && "bg-white/[0.10] text-white"
            )}
            title="Search"
            aria-label="Search messages"
            aria-pressed={searchMode}
          >
            <Search className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onFullscreenToggle}
            className="h-9 w-9 rounded-full p-0 text-zinc-300 transition-all duration-200 hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-zinc-200/45"
            title={isFullscreen ? CHAT_MESSAGES.FULLSCREEN_EXIT : CHAT_MESSAGES.FULLSCREEN_ENTER}
            aria-label={isFullscreen ? CHAT_MESSAGES.FULLSCREEN_EXIT : CHAT_MESSAGES.FULLSCREEN_ENTER}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-9 w-9 rounded-full p-0 text-zinc-300 transition-all duration-200 hover:bg-red-500/10 hover:text-red-200 focus-visible:ring-2 focus-visible:ring-red-300/40"
            title="Close"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {onToggleMeetingMinutes && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMeetingMinutes}
            className={cn(
              "h-8 shrink-0 rounded-full px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-emerald-300/50",
              meetingMinutesEnabled
                ? "border border-rose-300/20 bg-rose-300/12 text-rose-100 shadow-[0_0_28px_-18px_rgba(251,113,133,0.9)] hover:bg-rose-300/18"
                : "border border-emerald-300/15 bg-emerald-300/10 text-emerald-100 hover:bg-emerald-300/15"
            )}
            title={meetingMinutesEnabled ? "Stop meeting minutes" : "Start meeting minutes"}
            aria-label={meetingMinutesEnabled ? "Stop meeting minutes" : "Start meeting minutes"}
            aria-pressed={meetingMinutesEnabled}
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            {minutesLabel}
          </Button>
        )}
      </div>
    </div>
  );
};
