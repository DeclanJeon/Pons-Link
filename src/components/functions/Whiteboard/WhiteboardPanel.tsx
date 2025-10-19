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

interface WhiteboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhiteboardPanel: React.FC<WhiteboardPanelProps> = ({ isOpen, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      toast.info('Whiteboard opened. Start drawing!', { duration: 2000 });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= 400 && newWidth <= window.innerWidth - 100) {
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
  }, [isResizing]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!isOpen) return null;

  const width = isFullscreen ? '100vw' : `${panelWidth}px`;

  return (
    <WhiteboardProvider>
      <div
        ref={panelRef}
        className="whiteboard-panel fixed left-0 top-0 h-full bg-card/95 backdrop-blur-xl border-r border-border/50 shadow-[var(--shadow-elegant)] flex flex-col" // ✅ 클래스 추가
        style={{ 
          width,
          zIndex: 100
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Collaborative Whiteboard v3.6</h3>
            <Button variant="ghost" size="icon" className="w-6 h-6" title="Help">
              <Info className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} title="Close (Esc)">
              <X className="w-4 h-4" />
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
        <div className="p-2 border-t border-border/30 flex-shrink-0 text-xs text-muted-foreground">
          <div className="flex justify-between items-center">
            <span>Use mouse/touch to draw. Scroll to zoom. Space to pan.</span>
            <span>Shortcuts: V(Select), P(Pen), E(Eraser), T(Text), Ctrl+Z(Undo)</span>
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
