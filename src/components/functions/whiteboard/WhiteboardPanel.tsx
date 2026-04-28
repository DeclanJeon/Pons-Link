/**
 * @fileoverview 화이트보드 패널 컴포넌트 (v3.6 - Z-index 클래스 추가)
 * @module components/functions/Whiteboard/WhiteboardPanel
 */

import React, { useEffect, useState, useRef } from "react";
import { WhiteboardProvider } from "@/contexts/WhiteboardContext";
import { WhiteboardCanvas } from "./WhiteboardCanvas";
import { WhiteboardToolbar } from "./WhiteboardToolbar";
import { WhiteboardTextEditor } from "./WhiteboardTextEditor";
import { Button } from "@/components/ui/button";
import { X, Info, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { useDeviceType } from "@/hooks/useDeviceType";
import { useWhiteboardCollaboration } from "@/hooks/whiteboard/useWhiteboardCollaboration";
import { cn } from "@/lib/utils";

interface WhiteboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhiteboardPanel: React.FC<WhiteboardPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  const { broadcastWhiteboardOpen } = useWhiteboardCollaboration();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(
    isMobile ? window.innerWidth : 520,
  );
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasBroadcastedOpen = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!hasBroadcastedOpen.current) {
        broadcastWhiteboardOpen();
        hasBroadcastedOpen.current = true;
      }
      toast.info("Whiteboard opened. Start drawing!", { duration: 2000 });
    } else {
      hasBroadcastedOpen.current = false;
    }
  }, [isOpen, broadcastWhiteboardOpen]);

  useEffect(() => {
    if (!isResizing || isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      const minWidth = isMobile ? window.innerWidth - 50 : 400;
      const maxWidth = isMobile ? window.innerWidth - 50 : Math.min(window.innerWidth * 0.62, window.innerWidth - 160);
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, isMobile]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!isOpen) return null;

  // 모바일과 데스크톱에 따른 다른 스타일 적용
  if (isMobile) {
    return (
      <WhiteboardProvider>
        <div className="room-noir-surface fixed inset-0 z-[60] flex flex-col text-foreground">
          {/* Mobile Header */}
          <div
            className={cn(
              "room-panel-header flex items-center justify-between flex-shrink-0 border-b",
              isMobile ? "p-2" : "p-3",
            )}
          >
            <div className={cn("flex items-center gap-2", isMobile && "gap-1")}>
              <h3
                className={cn(
                  "room-panel-title font-semibold",
                  isMobile ? "text-xs" : "text-sm",
                )}
              >
                Whiteboard
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className={cn("title-help", isMobile ? "w-5 h-5" : "w-6 h-6")}
                title="Help"
              >
                <Info className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
              </Button>
            </div>
            <Button
              variant="ghost"
              size={isMobile ? "sm" : "sm"}
              onClick={onClose}
              className={cn(isMobile && "h-7 w-7")}
              title="Close"
            >
              <X className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
            </Button>
          </div>

          {/* Mobile Toolbar */}
          <div className="room-panel-header flex-shrink-0 border-b">
            <WhiteboardToolbar />
          </div>

          {/* Canvas */}
          <div className="flex-1 relative bg-[#050507]">
            <WhiteboardCanvas />
          </div>

          {/* Text Editor Overlay */}
          <WhiteboardTextEditor />

          {/* Mobile Footer - Simplified */}
          <div
            className={cn(
              "room-panel-header border-t flex-shrink-0",
              isMobile ? "p-1.5" : "p-2",
            )}
          >
            <div
              className={cn(
                "text-muted-foreground text-center",
                isMobile ? "text-[10px]" : "text-xs",
              )}
            >
              Touch to draw • Pinch to zoom • Two fingers to pan
            </div>
          </div>
        </div>
      </WhiteboardProvider>
    );
  }

  // Desktop view
  const width = isFullscreen ? "100vw" : `${Math.min(panelWidth, Math.max(400, window.innerWidth * 0.62))}px`;

  return (
    <WhiteboardProvider>
      <div
        ref={panelRef}
        className="whiteboard-panel room-noir-panel room-soft-edge fixed left-0 top-0 h-full border-r flex flex-col text-foreground"
        style={{
          width,
          zIndex: 100,
        }}
      >
        {/* Header */}
        <div
          className={cn(
            "room-panel-header flex items-center justify-between flex-shrink-0 border-b",
            isTablet ? "p-3" : "p-4",
          )}
        >
          <div className={cn("flex items-center gap-2", isTablet && "gap-1")}>
            <h3
              className={cn(
                "room-panel-title font-semibold",
                isTablet ? "text-sm" : "text-base",
              )}
            >
              {isTablet ? "Whiteboard" : "Collaborative Whiteboard"}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className={cn(isTablet ? "w-5 h-5" : "w-6 h-6")}
              title="Help"
            >
              <Info className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
            </Button>
          </div>
          <div className={cn("flex items-center gap-2", isTablet && "gap-1")}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className={cn("room-icon-button", isTablet && "h-7 w-7")}
            >
              {isFullscreen ? (
                <Minimize2 className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
              ) : (
                <Maximize2 className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
              )}
            </Button>
            <Button
              variant="ghost"
              size={isTablet ? "sm" : "sm"}
              onClick={onClose}
              className={cn("room-icon-button", isTablet && "h-7 w-7")}
              title="Close (Esc)"
            >
              <X className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <WhiteboardToolbar />

        {/* Canvas */}
        <div className="flex-1 relative">
          <WhiteboardCanvas />
        </div>

        {/* Text Editor Overlay */}
        <WhiteboardTextEditor />

        {/* Footer */}
        <div
          className={cn(
            "border-t border-border/30 flex-shrink-0 text-muted-foreground",
            isTablet ? "p-1.5 text-[10px]" : "p-2 text-xs",
          )}
        >
          <div
            className={cn(
              "flex justify-between items-center",
              isTablet ? "flex-col gap-1 text-center" : "",
            )}
          >
            <span>
              {isTablet
                ? "Touch to draw. Scroll to zoom."
                : "Use mouse/touch to draw. Scroll to zoom. Space to pan."}
            </span>
            {!isTablet && (
              <span>
                Shortcuts: V(Select), P(Pen), E(Eraser), T(Text), Ctrl+Z(Undo)
              </span>
            )}
          </div>
        </div>

        {/* Resizer */}
        {!isFullscreen && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize whiteboard panel"
            className="absolute right-0 top-0 w-1 h-full cursor-ew-resize hover:bg-primary/50 focus-visible:bg-primary/60 transition-colors"
            onMouseDown={() => setIsResizing(true)}
            style={{ zIndex: 101 }}
          />
        )}
      </div>
    </WhiteboardProvider>
  );
};
