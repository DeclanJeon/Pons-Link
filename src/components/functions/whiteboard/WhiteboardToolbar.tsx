/**
 * @fileoverview 화이트보드 툴바 컴포넌트 (v3.5 - Popover Portal 수정)
 * @module components/functions/Whiteboard/WhiteboardToolbar
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import useWhiteboard from '@/contexts/WhiteboardContext';
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
  Paintbrush,
  Eye,
  EyeOff,
  User,
  Users
} from 'lucide-react';
import type { Tool } from '@/types/whiteboard.types';
import { useWhiteboardCollaboration } from '@/hooks/whiteboard/useWhiteboardCollaboration';
import { useSessionStore } from '@/stores/useSessionStore';
import { toast } from 'sonner';
import { useWhiteboardStore } from '@/stores/useWhiteboardStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { hexToRgb, rgbToHex, rgbToCmyk, cmykToRgb } from '@/lib/whiteboard/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  // { value: 'dots', label: 'Dots' },
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
    deleteSelected,
    copySelected,
    cutSelected,
    paste,
    selectedIds,
    viewport,
    setViewport,
    resetViewport,
    setBackground,
    operations,
    updateOperation,
    pushHistory
  } = useWhiteboard();

  const { broadcastBackground, broadcastClear, broadcastFollowStart, broadcastViewport, broadcastUpdate } = useWhiteboardCollaboration();
  const { userId } = useSessionStore();

  const background = useWhiteboardStore(state => state.background);
  const isFollowMeEnabled = useWhiteboardStore(state => state.isFollowMeEnabled);
  const setFollowMeEnabled = useWhiteboardStore(state => state.setFollowMeEnabled);
  const followedUserId = useWhiteboardStore(state => state.followedUserId);
  const followedUserNickname = useWhiteboardStore(state => state.followedUserNickname);
  const setFollowedUser = useWhiteboardStore(state => state.setFollowedUser);
  const setIsPanMode = useWhiteboardStore(state => state.setIsPanMode);
  const peers = usePeerConnectionStore(state => state.peers);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showFollowerMenu, setShowFollowerMenu] = useState(false);

  const handleFollowUser = (followUserId: string | null, followNickname: string | null) => {
    setFollowedUser(followUserId, followNickname);
    if (followUserId && followNickname) {
      toast.info(`${followNickname}님을 따르고 있습니다.`);
      broadcastViewport(viewport);
    } else {
      toast.info('따라가기 모드를 종료했습니다.');
    }
    setShowFollowerMenu(false);
  };

  const handleToolSelect = (tool: Tool) => {
    setTool(tool);
    
    if (tool === ('pan' as Tool)) {
      setIsPanMode(true);
    } else if (currentTool === ('pan' as Tool) && tool !== ('pan' as Tool)) {
      setIsPanMode(false);
    }
  };

  const applyColor = (color: string) => {
    const updates = { 
      strokeColor: color, 
      fillColor: 'transparent'
    };
    
    setToolOptions(updates);

    if (selectedIds.size > 0) {
      selectedIds.forEach(id => {
        const op = operations.get(id);
        if (op) {
          updateOperation(id, { options: { ...op.options, ...updates } });
          broadcastUpdate(id, { options: { ...op.options, ...updates } });
        }
      });
    }
  };

  const commitColor = () => {
    if (selectedIds.size > 0) {
      pushHistory();
    }
  };

  const handleColorChange = (color: string) => {
    applyColor(color);
    commitColor();
    setShowColorPicker(false);
  };

  const handleStrokeWidthChange = (value: number[]) => {

    setToolOptions({ strokeWidth: value[0] });
  };

  const handleBackgroundColorChange = (color: string) => {
    console.log('[Toolbar] 🎨 Changing background color to:', color);
    
    const newBackground = { ...background, color };
    setBackground(newBackground);
    broadcastBackground(newBackground);
    
    setTimeout(() => {
      const currentBg = useWhiteboardStore.getState().background;
      console.log('[Toolbar] ✅ Background state updated:', currentBg);
    }, 100);
  };

  const handleGridTypeChange = (gridType: 'none' | 'dots' | 'lines') => {
    console.log('[Toolbar] 📐 Changing grid type to:', gridType);
    
    const newBackground = { ...background, gridType };
    setBackground(newBackground);
    broadcastBackground(newBackground);
    
    setTimeout(() => {
      const currentBg = useWhiteboardStore.getState().background;
      console.log('[Toolbar] ✅ Grid type updated:', currentBg.gridType);
    }, 100);
  };

  const handleClearMyOperations = () => {
    const myOperations = Array.from(operations.values())
      .filter(op => op.userId === userId)
      .map(op => op.id);

    if (myOperations.length === 0) {
      toast.info('You have no operations to clear');
      setShowClearDialog(false);
      return;
    }

    myOperations.forEach(id => {
      useWhiteboardStore.getState().removeOperation(id);
    });

    useWhiteboardStore.getState().pushHistory();
    
    toast.success(`Cleared ${myOperations.length} of your operations`);
    setShowClearDialog(false);
    
    console.log('[Toolbar] 🗑️ Cleared my operations only:', myOperations.length);
  };

  const handleClearAll = () => {
    const totalOperations = operations.size;
    
    if (totalOperations === 0) {
      toast.info('Canvas is already empty');
      setShowClearDialog(false);
      return;
    }

    useWhiteboardStore.getState().clearOperations();
    broadcastClear();
    
    toast.success(`Cleared all ${totalOperations} operations from everyone`);
    setShowClearDialog(false);
    
    console.log('[Toolbar] 🗑️ Cleared ALL operations:', totalOperations);
  };

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

  const handleToggleFollowMe = () => {
    const newState = !isFollowMeEnabled;
    setFollowMeEnabled(newState);
    if (newState) {
      toast.success('Follow Me enabled - Others will see your view');
    } else {
      toast.info('Follow Me disabled');
    }
  };

  /**
   * ✅ Clear Dialog Portal 렌더링
   */
  const renderClearDialog = () => {
    if (typeof document === 'undefined') return null;

    return createPortal(
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="z-[9999]">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Whiteboard</AlertDialogTitle>
            <AlertDialogDescription>
              Choose what to clear from the whiteboard. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-2 text-sm text-muted-foreground border-y">
            <div>Your operations: {Array.from(operations.values()).filter(op => op.userId === userId).length}</div>
            <div>Total operations: {operations.size}</div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleClearMyOperations}
              disabled={Array.from(operations.values()).filter(op => op.userId === userId).length === 0}
            >
              Clear My Work Only
            </Button>
            <AlertDialogAction
              onClick={handleClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={operations.size === 0}
            >
              Clear Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
      document.body
    );
  };

  return (
    <>
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
          <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" title="Stroke Color">
                <Palette className="w-4 h-4 mr-2" />
                <div
                  className="w-4 h-4 rounded border border-border"
                  style={{ backgroundColor: toolOptions.strokeColor }}
                />
              </Button>
            </PopoverTrigger>

            <PopoverContent 
              className="w-80 p-0 z-[9500] overflow-hidden" 
              sideOffset={5}
              collisionPadding={10}
            >
              <div 
                className="w-full h-16 border-b border-border shadow-inner transition-colors duration-150 flex items-center justify-center"
                style={{ backgroundColor: toolOptions.strokeColor }}
              >
                <span 
                  className="text-xs font-mono font-bold px-2 py-1 rounded bg-background/20 backdrop-blur-sm border border-white/10 text-white"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                >
                  {toolOptions.strokeColor.toUpperCase()}
                </span>
              </div>

              <Tabs defaultValue="swatches" className="w-full">
                <TabsList className="w-full rounded-none h-9">
                  <TabsTrigger value="swatches" className="flex-1 text-xs">Colors</TabsTrigger>
                  <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
                </TabsList>
                
                <TabsContent value="swatches" className="p-3 m-0">
                  <div className="grid grid-cols-5 gap-2">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        className={`w-10 h-10 rounded border-2 transition-transform hover:scale-110 ${
                          toolOptions.strokeColor === color ? 'border-primary ring-1 ring-primary' : 'border-border'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => handleColorChange(color)}
                      />
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="custom" className="p-3 m-0 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Hex Code</Label>
                    <Input 
                      value={toolOptions.strokeColor}
                      onChange={(e) => applyColor(e.target.value)}
                      onBlur={commitColor}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitColor();
                          setShowColorPicker(false);
                        }
                      }}
                      className="h-8 text-sm font-mono"
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">Red</Label>
                        <span className="text-[10px] font-mono">{hexToRgb(toolOptions.strokeColor)?.r || 0}</span>
                      </div>
                      <Slider 
                        min={0} 
                        max={255} 
                        step={1} 
                        value={[hexToRgb(toolOptions.strokeColor)?.r || 0]}
                        onValueChange={([v]) => {
                          const rgb = hexToRgb(toolOptions.strokeColor) || { r: 0, g: 0, b: 0 };
                          applyColor(rgbToHex(v, rgb.g, rgb.b));
                        }}
                        onValueCommit={commitColor}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">Green</Label>
                        <span className="text-[10px] font-mono">{hexToRgb(toolOptions.strokeColor)?.g || 0}</span>
                      </div>
                      <Slider 
                        min={0} 
                        max={255} 
                        step={1} 
                        value={[hexToRgb(toolOptions.strokeColor)?.g || 0]}
                        onValueChange={([v]) => {
                          const rgb = hexToRgb(toolOptions.strokeColor) || { r: 0, g: 0, b: 0 };
                          applyColor(rgbToHex(rgb.r, v, rgb.b));
                        }}
                        onValueCommit={commitColor}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <Label className="text-[10px] uppercase text-muted-foreground">Blue</Label>
                        <span className="text-[10px] font-mono">{hexToRgb(toolOptions.strokeColor)?.b || 0}</span>
                      </div>
                      <Slider 
                        min={0} 
                        max={255} 
                        step={1} 
                        value={[hexToRgb(toolOptions.strokeColor)?.b || 0]}
                        onValueChange={([v]) => {
                          const rgb = hexToRgb(toolOptions.strokeColor) || { r: 0, g: 0, b: 0 };
                          applyColor(rgbToHex(rgb.r, rgb.g, v));
                        }}
                        onValueCommit={commitColor}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">CMYK Info</Label>
                    <div className="grid grid-cols-4 gap-1">
                      {(() => {
                        const rgb = hexToRgb(toolOptions.strokeColor);
                        if (!rgb) return null;
                        const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
                        return (
                          <>
                            <div className="bg-muted p-1 rounded text-center text-[9px]">C:{cmyk.c}%</div>
                            <div className="bg-muted p-1 rounded text-center text-[9px]">M:{cmyk.m}%</div>
                            <div className="bg-muted p-1 rounded text-center text-[9px]">Y:{cmyk.y}%</div>
                            <div className="bg-muted p-1 rounded text-center text-[9px]">K:{cmyk.k}%</div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
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
              title="Stroke Width"
            />
            <span className="text-xs text-muted-foreground w-8 text-right">
              {toolOptions.strokeWidth}
            </span>
          </div>

          <Separator orientation="vertical" className="h-8" />

          {/* ✅ 배경 설정 Popover */}
          <Popover 
            open={showBackgroundSettings} 
            onOpenChange={(open) => {
              console.log('[Toolbar] 🎨 Background Popover:', open ? 'OPENING' : 'CLOSING');
              setShowBackgroundSettings(open);
            }}
          >
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                title="Background Settings"
                onClick={() => {
                  console.log('[Toolbar] 🎨 Background button clicked');
                  setShowBackgroundSettings(true);
                }}
              >
                <Paintbrush className="w-4 h-4 mr-2" />
                Background
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-64 p-4 space-y-4 z-[9500]" 
              align="start"
              sideOffset={5}
              collisionPadding={10}
            >
              <div>
                <label className="text-sm font-medium mb-2 block">Background Color</label>
                <div className="grid grid-cols-5 gap-2">
                  {BACKGROUND_COLORS.map(({ value, label }) => (
                    <button
                      key={value}
                      className={`w-8 h-8 rounded border-2 hover:scale-110 transition-transform ${
                        background.color === value ? 'border-primary ring-2 ring-primary' : 'border-border'
                      }`}
                      style={{ backgroundColor: value }}
                      onClick={() => {
                        handleBackgroundColorChange(value);
                        console.log('[Toolbar] 🎨 Color button clicked:', value);
                      }}
                      title={label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Grid Type</label>
                <Select
                  value={background.gridType}
                  onValueChange={(value) => {
                    handleGridTypeChange(value as any);
                    console.log('[Toolbar] 📐 Grid type selected:', value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[9600]"> {/* ✅ Select도 높은 z-index */}
                    {GRID_TYPES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="text-xs text-muted-foreground border-t pt-2">
                <div>Current: {background.color}</div>
                <div>Grid: {background.gridType}</div>
              </div>
            </PopoverContent>
           </Popover>

          {/* Follow Me 토글 (뷰 따라가기) */}
          <Popover open={showFollowerMenu} onOpenChange={setShowFollowerMenu}>
            <PopoverTrigger asChild>
              <Button
                variant={isFollowMeEnabled || followedUserId ? 'default' : 'outline'}
                size="sm"
                className="gap-1"
                title="뷰 따라가기 - 원격 유저의 뷰를 따르기"
              >
                {followedUserId ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                뷰 따라가기
                {followedUserNickname && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({followedUserNickname})
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start" sideOffset={5}>
              <div className="p-2">
                <h4 className="text-sm font-medium mb-2">따라가기 모드</h4>
                <div className="space-y-1">
                  <Button
                    variant={followedUserId === null ? 'default' : 'outline'}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleFollowUser(null, null)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    나의 뷰 공유
                  </Button>
                  {Array.from(peers.values())
                    .filter(peer => peer.userId !== userId)
                    .map((peer) => (
                      <Button
                        key={peer.userId}
                        variant={followedUserId === peer.userId ? 'default' : 'outline'}
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => handleFollowUser(peer.userId, peer.nickname)}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        {peer.nickname}
                      </Button>
                    ))}
                </div>
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

          <Button variant="outline" size="sm" onClick={handleResetZoom} title="Reset Zoom (Fit to Screen)">
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
            title="Copy Selected (Ctrl+C)"
          >
            Copy
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={cutSelected}
            disabled={selectedIds.size === 0}
            title="Cut Selected (Ctrl+X)"
          >
            Cut
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={paste}
            title="Paste from Clipboard (Ctrl+V)"
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

          {/* Clear All 버튼 */}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowClearDialog(true)}
            title="Clear Canvas Options"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>

        {/* 상태 표시 */}
        <div className="text-xs text-muted-foreground">
          <span>Tool: <strong>{currentTool}</strong></span>
          {selectedIds.size > 0 && (
            <span className="ml-4">Selected: <strong>{selectedIds.size}</strong></span>
          )}
          <span className="ml-4">
            Total: <strong>{operations.size}</strong> operations
          </span>
          <span className="ml-4">
            Background: <strong>{background.color}</strong> / Grid: <strong>{background.gridType}</strong>
          </span>
        </div>
      </div>

      {/* Clear Dialog Portal */}
      {renderClearDialog()}
    </>
  );
};
