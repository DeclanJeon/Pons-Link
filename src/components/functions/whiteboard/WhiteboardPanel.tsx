/**
 * @fileoverview 화이트보드 패널 컴포넌트 (v3.6 - Z-index 클래스 추가)
 * @module components/functions/Whiteboard/WhiteboardPanel
 */

import React, { useEffect, useState, useRef } from 'react';
import { WhiteboardProvider } from '@/contexts/WhiteboardContext';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { WhiteboardTextEditor } from './WhiteboardTextEditor';
import { Button } from '@/components/ui/button';
import { X, Info, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDeviceType } from '@/hooks/useDeviceType';
import { cn } from '@/lib/utils';

interface WhiteboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhiteboardPanel: React.FC<WhiteboardPanelProps> = ({ isOpen, onClose }) => {
  const { isMobile, isTablet, isDesktop } = useDeviceType();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(isMobile ? window.innerWidth : 600);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      toast.info('Whiteboard opened. Start drawing!', { duration: 2000 });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isResizing || isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      const minWidth = isMobile ? window.innerWidth - 50 : 400;
      const maxWidth = window.innerWidth - (isMobile ? 50 : 100);
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
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
        <div className="fixed inset-0 z-[60] bg-background flex flex-col">
          {/* Mobile Header */}
          <div className={cn(
            "flex items-center justify-between flex-shrink-0 bg-card/95 backdrop-blur-xl border-b border-border/30",
            isMobile ? "p-2" : "p-3"
          )}>
            <div className={cn("flex items-center gap-2",
              isMobile && "gap-1")}>
              <h3 className={cn("font-semibold text-foreground",
                isMobile ? "text-xs" : "text-sm")}>Whiteboard</h3>
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
          <div className="flex-shrink-0 bg-card/95 backdrop-blur-xl border-b border-border/30">
            <WhiteboardToolbar />
          </div>

          {/* Canvas */}
          <div className="flex-1 relative bg-background">
            <WhiteboardCanvas />
          </div>

          {/* Text Editor Overlay */}
          <WhiteboardTextEditor />

          {/* Mobile Footer - Simplified */}
          <div className={cn(
            "border-t border-border/30 flex-shrink-0 bg-card/95 backdrop-blur-xl",
            isMobile ? "p-1.5" : "p-2"
          )}>
            <div className={cn("text-muted-foreground text-center",
              isMobile ? "text-[10px]" : "text-xs")}>
              Touch to draw • Pinch to zoom • Two fingers to pan
            </div>
          </div>
        </div>
      </WhiteboardProvider>
    );
  }

  // Desktop view
  const width = isFullscreen ? '100vw' : `${panelWidth}px`;

  return (
    <WhiteboardProvider>
      <div
        ref={panelRef}
        className="whiteboard-panel fixed left-0 top-0 h-full bg-card/95 backdrop-blur-xl border-r border-border/50 shadow-[var(--shadow-elegant)] flex flex-col"
        style={{
          width,
          zIndex: 100
        }}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between flex-shrink-0 border-b border-border/30",
          isTablet ? "p-3" : "p-4"
        )}>
          <div className={cn("flex items-center gap-2",
            isTablet && "gap-1")}>
            <h3 className={cn("font-semibold text-foreground",
              isTablet ? "text-sm" : "text-base")}>
              {isTablet ? "Whiteboard v3.6" : "Collaborative Whiteboard v3.6"}
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
          <div className={cn("flex items-center gap-2",
            isTablet && "gap-1")}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className={cn(isTablet && "h-7 w-7")}
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
              className={cn(isTablet && "h-7 w-7")}
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
        <div className={cn(
          "border-t border-border/30 flex-shrink-0 text-muted-foreground",
          isTablet ? "p-1.5 text-[10px]" : "p-2 text-xs"
        )}>
          <div className={cn(
            "flex justify-between items-center",
            isTablet ? "flex-col gap-1 text-center" : ""
          )}>
            <span>{isTablet ? "Touch to draw. Scroll to zoom." : "Use mouse/touch to draw. Scroll to zoom. Space to pan."}</span>
            {!isTablet && (
              <span>Shortcuts: V(Select), P(Pen), E(Eraser), T(Text), Ctrl+Z(Undo)</span>
            )}
          </div>
        </div>

        {/* Resizer */}
        {!isFullscreen && (
          <div
            className="absolute right-0 top-0 w-1 h-full cursor-ew-resize hover:bg-primary/50 transition-colors"
            onMouseDown={() => setIsResizing(true)}
            style={{ zIndex: 101 }}
          />
        )}
      </div>
    </WhiteboardProvider>
  );
};
