/**
 * @fileoverview 화이트보드 툴바 컴포넌트 (v3.1 - Clear All 옵션 추가)
 * @module components/functions/Whiteboard/WhiteboardToolbar
 */

import React, { useState } from 'react';
import { useWhiteboard } from '@/contexts/WhiteboardContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Pen,
  Eraser,
  MousePointer,
  Square,
  Circle,
  ArrowRight,
  Type,
  Trash2,
  Undo,
  Redo,
  Palette,
  ZoomIn,
  ZoomOut,
  Maximize,
  Hand,
  Zap,
  Paintbrush
} from 'lucide-react';
import type { Tool } from '@/types/whiteboard.types';
import { useWhiteboardCollaboration } from '@/hooks/whiteboard/useWhiteboardCollaboration';
import { useSessionStore } from '@/stores/useSessionStore';
import { toast } from 'sonner';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';

const COLORS = [
  '#000000', '#ffffff', '#3b82f6', '#ef4444', '#22c55e',
  '#eab308', '#a855f7', '#ec4899', '#f97316', '#06b6d4'
];

const BACKGROUND_COLORS = [
  { value: '#ffffff', label: 'White' },
  { value: '#000000', label: 'Black' },
  { value: '#1e293b', label: 'Dark' },
  { value: '#f8fafc', label: 'Light Gray' },
  { value: '#dbeafe', label: 'Light Blue' }
];

const GRID_TYPES = [
  { value: 'none', label: 'No Grid' },
  { value: 'dots', label: 'Dots' },
  { value: 'lines', label: 'Lines' }
];

export const WhiteboardToolbar: React.FC = () => {
  const {
    currentTool,
    setTool,
    toolOptions,
    setToolOptions,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
    deleteSelected,
    copySelected,
    cutSelected,
    paste,
    selectedIds,
    viewport,
    setViewport,
    resetViewport,
    background,
    setBackground,
    operations
  } = useWhiteboard();

  const { broadcastBackground, broadcastClear } = useWhiteboardCollaboration();
  const { userId } = useSessionStore();

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  /**
   * 도구 선택 핸들러
   */
  const handleToolSelect = (tool: Tool) => {
    setTool(tool);
  };

  /**
   * 색상 변경 핸들러
   */
  const handleColorChange = (color: string) => {
    setToolOptions({ strokeColor: color });
    setShowColorPicker(false);
  };

  /**
   * 선 두께 변경 핸들러
   */
  const handleStrokeWidthChange = (value: number[]) => {
    setToolOptions({ strokeWidth: value[0] });
  };

  /**
   * 배경 색상 변경
   */
  const handleBackgroundColorChange = (color: string) => {
    const newBackground = { ...background, color };
    setBackground(newBackground);
    broadcastBackground(newBackground);
  };

  /**
   * 그리드 타입 변경
   */
  const handleGridTypeChange = (gridType: 'none' | 'dots' | 'lines') => {
    const newBackground = { ...background, gridType };
    setBackground(newBackground);
    broadcastBackground(newBackground);
  };

  /**
   * 내 작업만 삭제
   */
  const handleClearMyOperations = () => {
    const myOperations = Array.from(operations.values())
      .filter(op => op.userId === userId)
      .map(op => op.id);

    myOperations.forEach(id => {
      useWhiteboardStore.getState().removeOperation(id);
    });

    useWhiteboardStore.getState().pushHistory();
    toast.success(`Cleared ${myOperations.length} of my operations`);
    setShowClearDialog(false);
  };

  /**
   * 전체 삭제
   */
  const handleClearAll = () => {
    clearCanvas();
    broadcastClear();
    toast.success('Cleared all operations');
    setShowClearDialog(false);
  };

  /**
   * 줌 핸들러
   */
  const handleZoomIn = () => {
    const newScale = Math.min(viewport.scale * 1.2, 5);
    setViewport({ ...viewport, scale: newScale });
  };

  const handleZoomOut = () => {
    const newScale = Math.max(viewport.scale / 1.2, 0.1);
    setViewport({ ...viewport, scale: newScale });
  };

  const handleResetZoom = () => {
    resetViewport();
  };

  return (
    <div className="p-4 border-b border-border/30 flex-shrink-0 space-y-4">
      {/* 도구 선택 */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={currentTool === 'select' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => handleToolSelect('select')}
          title="Select Tool (V)"
        >
          <MousePointer className="w-4 h-4" />
        </Button>

        <Button
          variant={currentTool === 'pan' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => handleToolSelect('pan')}
          title="Pan Tool (Space)"
        >
          <Hand className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-8" />

        <Button
          variant={currentTool === 'pen' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => handleToolSelect('pen')}
          title="Pen Tool (P)"
        >
          <Pen className="w-4 h-4" />
        </Button>

        <Button
          variant={currentTool === 'eraser' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => handleToolSelect('eraser')}
          title="Eraser Tool (E)"
        >
          <Eraser className="w-4 h-4" />
        </Button>

        <Button
          variant={currentTool === 'laser' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => handleToolSelect('laser')}
          title="Laser Pointer (L)"
        >
          <Zap className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-8" />

        <Button
          variant={currentTool === 'rectangle' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => handleToolSelect('rectangle')}
          title="Rectangle Tool (R)"
        >
          <Square className="w-4 h-4" />
        </Button>

        <Button
          variant={currentTool === 'circle' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => handleToolSelect('circle')}
          title="Circle Tool (C)"
        >
          <Circle className="w-4 h-4" />
        </Button>

        <Button
          variant={currentTool === 'arrow' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => handleToolSelect('arrow')}
          title="Arrow Tool (A)"
        >
          <ArrowRight className="w-4 h-4" />
        </Button>

        <Button
          variant={currentTool === 'text' ? 'default' : 'secondary'}
          size="sm"
          onClick={() => handleToolSelect('text')}
          title="Text Tool (T)"
        >
          <Type className="w-4 h-4" />
        </Button>
      </div>

      {/* 도구 옵션 */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* 색상 선택 */}
        <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" title="Color">
              <Palette className="w-4 h-4 mr-2" />
              <div
                className="w-4 h-4 rounded border border-border"
                style={{ backgroundColor: toolOptions.strokeColor }}
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="grid grid-cols-5 gap-2">
              {COLORS.map(color => (
                <button
                  key={color}
                  className="w-8 h-8 rounded border-2 border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorChange(color)}
                  title={color}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* 선 두께 */}
        <div className="flex items-center gap-2 px-2">
          <span className="text-xs text-muted-foreground">Width:</span>
          <Slider
            value={[toolOptions.strokeWidth]}
            onValueChange={handleStrokeWidthChange}
            min={1}
            max={50}
            step={1}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground w-8 text-right">
            {toolOptions.strokeWidth}
          </span>
        </div>

        <Separator orientation="vertical" className="h-8" />

        {/* 배경 설정 */}
        <Popover open={showBackgroundSettings} onOpenChange={setShowBackgroundSettings}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" title="Background Settings">
              <Paintbrush className="w-4 h-4 mr-2" />
              Background
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Background Color</label>
              <div className="grid grid-cols-5 gap-2">
                {BACKGROUND_COLORS.map(({ value, label }) => (
                  <button
                    key={value}
                    className={`w-8 h-8 rounded border-2 hover:scale-110 transition-transform ${
                      background.color === value ? 'border-primary' : 'border-border'
                    }`}
                    style={{ backgroundColor: value }}
                    onClick={() => handleBackgroundColorChange(value)}
                    title={label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Grid Type</label>
              <Select
                value={background.gridType}
                onValueChange={(value) => handleGridTypeChange(value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRID_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-8" />

        {/* 줌 컨트롤 */}
        <Button variant="outline" size="sm" onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut className="w-4 h-4" />
        </Button>

        <span className="text-xs text-muted-foreground min-w-[60px] text-center">
          {Math.round(viewport.scale * 100)}%
        </span>

        <Button variant="outline" size="sm" onClick={handleZoomIn} title="Zoom In">
          <ZoomIn className="w-4 h-4" />
        </Button>

        <Button variant="outline" size="sm" onClick={handleResetZoom} title="Reset Zoom">
          <Maximize className="w-4 h-4" />
        </Button>
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </Button>

        <Separator orientation="vertical" className="h-8" />

        <Button
          variant="outline"
          size="sm"
          onClick={copySelected}
          disabled={selectedIds.size === 0}
          title="Copy (Ctrl+C)"
        >
          Copy
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={cutSelected}
          disabled={selectedIds.size === 0}
          title="Cut (Ctrl+X)"
        >
          Cut
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={paste}
          title="Paste (Ctrl+V)"
        >
          Paste
        </Button>

        <Separator orientation="vertical" className="h-8" />

        <Button
          variant="outline"
          size="sm"
          onClick={deleteSelected}
          disabled={selectedIds.size === 0}
          title="Delete Selected (Delete)"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </Button>

        {/* Clear All with Dialog */}
        <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              title="Clear Canvas"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear Whiteboard</AlertDialogTitle>
              <AlertDialogDescription>
                Choose what to clear from the whiteboard.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant="outline"
                onClick={handleClearMyOperations}
              >
                Clear My Work Only
              </Button>
              <AlertDialogAction
                onClick={handleClearAll}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear Everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* 상태 표시 */}
      <div className="text-xs text-muted-foreground">
        <span>Tool: {currentTool}</span>
        {selectedIds.size > 0 && (
          <span className="ml-4">Selected: {selectedIds.size}</span>
        )}
        <span className="ml-4">
          Total: {operations.size} operations
        </span>
      </div>
    </div>
  );
};
