// 📁 src/components/functions/Whiteboard/WhiteboardToolbar.tsx

import { useWhiteboard } from '@/contexts/WhiteboardContext';
import { Button } from '@/components/ui/button';
import { Pen, Eraser, MousePointer, Trash2, Undo, Redo } from 'lucide-react';

/**
 * @component WhiteboardToolbar
 * @description 도구 선택 및 실행 취소/다시 실행 버튼을 포함하는 툴바입니다.
 *              `useWhiteboard` 훅을 통해 상태를 읽고 액션을 호출합니다.
 */
export const WhiteboardToolbar = () => {
  // Context를 통해 상태와 함수를 직접 가져옵니다.
  const {
    currentTool,
    setTool,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
  } = useWhiteboard();

  return (
    <div className="p-4 border-b border-border/30 flex-shrink-0 space-y-4">
      {/* 도구 선택 버튼 */}
      <div className="flex gap-2">
        <Button
          variant={currentTool === 'pen' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setTool('pen')}
          title="Pen Tool"
        >
          <Pen className="w-4 h-4" />
        </Button>
        <Button
          variant={currentTool === 'eraser' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setTool('eraser')}
          title="Eraser Tool"
        >
          <Eraser className="w-4 h-4" />
        </Button>
        <Button
          variant={currentTool === 'select' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => setTool('select')}
          title="Select Tool"
        >
          <MousePointer className="w-4 h-4" />
        </Button>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <Undo className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <Redo className="w-4 h-4" />
        </Button>
        <Button variant="destructive" size="sm" onClick={clearCanvas} title="Clear Canvas">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
