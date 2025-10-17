// 📁 src/components/functions/Whiteboard/WhiteboardPanel.tsx

import { WhiteboardProvider } from '@/contexts/WhiteboardContext';
import { WhiteboardCanvas } from './WhiteboardCanvas';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface WhiteboardPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * @component WhiteboardPanel
 * @description 화이트보드 전체 기능을 감싸는 최상위 컨테이너 컴포넌트.
 *              WhiteboardProvider를 통해 모든 하위 컴포넌트에 Context를 제공합니다.
 */
export const WhiteboardPanel = ({ isOpen, onClose }: WhiteboardPanelProps) => {
  if (!isOpen) return null;

  return (
    // WhiteboardProvider가 모든 것을 감쌉니다!
    <WhiteboardProvider>
      <div className="fixed left-0 top-0 h-full w-96 bg-card/95 backdrop-blur-xl border-r border-border/50 shadow-[var(--shadow-elegant)] z-40 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/30 flex-shrink-0">
          <h3 className="font-semibold text-foreground">Collaborative Whiteboard</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Toolbar 컴포넌트 */}
        <WhiteboardToolbar />

        {/* Canvas 컴포넌트 */}
        <WhiteboardCanvas />
        
        {/* StatusBar 등 다른 컴포넌트가 추가될 위치 */}
      </div>
    </WhiteboardProvider>
  );
};
