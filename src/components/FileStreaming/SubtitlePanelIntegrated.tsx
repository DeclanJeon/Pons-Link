/**
 * @fileoverview Video.js 통합 자막 패널 (최종 버전)
 * @module components/FileStreaming/SubtitlePanelIntegrated
 * @description 자막 로드, 타이밍 조정, 스타일 설정을 통합한 Accordion UI
 */

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Upload, 
  Plus, 
  Minus, 
  RotateCcw, 
  Clock, 
  Subtitles,
  Type,
  Palette,
  MoveVertical
} from 'lucide-react';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SubtitlePanelIntegratedProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
}

export const SubtitlePanelIntegrated = ({
  videoRef,
  isStreaming
}: SubtitlePanelIntegratedProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<string[]>(['basic']);

  const {
    tracks,
    activeTrackId,
    syncOffset,
    speedMultiplier,
    isEnabled,
    position,
    customPosition,
    style,
    addTrack,
    setActiveTrack,
    adjustSyncOffset,
    setSpeedMultiplier,
    setPosition,
    updateStyle,
    broadcastTrack,
    broadcastSubtitleState
  } = useSubtitleStore();

  /**
   * 자막 파일 선택 핸들러
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await addTrack(file);
        
        // 스트리밍 중일 때만 즉시 브로드캐스트
        if (isStreaming) {
          const trackIds = Array.from(tracks.keys());
          const lastTrackId = trackIds[trackIds.length - 1];
          
          if (lastTrackId) {
            setTimeout(() => {
              // 자막 트랙 브로드캐스트
              broadcastTrack(lastTrackId);
              
              // 자막 상태 브로드캐스트
              broadcastSubtitleState();
              
              // 리모트 자막 활성화 시그널 전송
              const { sendToAllPeers } = usePeerConnectionStore.getState();
              const enablePacket = {
                type: 'subtitle-remote-enable',
                payload: {
                  trackId: lastTrackId,
                  enabled: true
                }
              };
              
              sendToAllPeers(JSON.stringify(enablePacket));
              
              toast.success('Subtitle shared with all participants');
            }, 500);
          }
        } else {
          // 스트리밍 전이면 로컬에만 저장
          toast.success('Subtitle loaded (will be shared when streaming starts)');
        }
      } catch (error) {
        console.error('[SubtitlePanel] Failed to load subtitle:', error);
        toast.error('Failed to load subtitle file');
      }
      
      // 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * 동기화 오프셋 리셋
   */
  const resetSyncOffset = () => {
    useSubtitleStore.setState({ syncOffset: 0 });
    toast.info('Subtitle sync reset to 0s');
  };

  /**
   * 속도 리셋
   */
  const resetSpeed = () => {
    setSpeedMultiplier(1.0);
    toast.info('Subtitle speed reset to 1.0x');
  };

  /**
   * 스타일 리셋
   */
  const resetStyle = () => {
    updateStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: 'medium',
      fontWeight: 'normal',
      color: '#FFFFFF',
      backgroundColor: '#000000',
      backgroundOpacity: 0.7,
      edgeStyle: 'dropshadow',
      edgeColor: '#000000'
    });
    toast.info('Subtitle style reset to default');
  };

  return (
    <div className="subtitle-panel space-y-4 p-4 bg-secondary/50 rounded-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Subtitles className="w-5 h-5" />
          Subtitle Settings
        </h3>
        {isStreaming && tracks.size > 0 && (
          <span className="text-xs text-green-500 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Shared
          </span>
        )}
      </div>

      <Accordion 
        type="multiple" 
        value={activeSection} 
        onValueChange={setActiveSection}
        className="w-full"
      >
        {/* 기본 설정 */}
        <AccordionItem value="basic">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Subtitles className="w-4 h-4" />
              Basic Settings
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            {/* 자막 파일 로드 & 트랙 선택 */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt,.vtt,.ass,.ssa,.sub"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Load Subtitle
              </Button>

              {tracks.size > 0 && (
                <Select
                  value={activeTrackId || 'none'}
                  onValueChange={(value) => setActiveTrack(value === 'none' ? null : value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select subtitle track">
                      {activeTrackId
                        ? tracks.get(activeTrackId)?.label || 'Unknown'
                        : 'No subtitle'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No subtitle</SelectItem>
                    {Array.from(tracks.values()).map(track => (
                      <SelectItem key={track.id} value={track.id}>
                        {track.label} ({track.language.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                variant={isEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  useSubtitleStore.setState({ isEnabled: !isEnabled });
                  toast.info(`Subtitles ${!isEnabled ? 'enabled' : 'disabled'}`);
                }}
                title="Toggle subtitle (V)"
              >
                {isEnabled ? 'ON' : 'OFF'}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 타이밍 조정 */}
        <AccordionItem value="timing">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Timing Adjustment
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            {/* 자막 딜레이 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Subtitle Delay
                </Label>
                <span className="text-sm font-mono">
                  {syncOffset > 0 ? '+' : ''}{(syncOffset / 1000).toFixed(2)}s
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => adjustSyncOffset(-500)}
                  size="sm"
                  variant="outline"
                  title="Hasten subtitle by 500ms (Shift+G)"
                >
                  <Minus className="w-3 h-3" />
                  500ms
                </Button>
                
                <Button
                  onClick={() => adjustSyncOffset(-50)}
                  size="sm"
                  variant="outline"
                  title="Hasten subtitle by 50ms (G)"
                >
                  <Minus className="w-3 h-3" />
                  50ms
                </Button>
                
                <Slider
                  value={[syncOffset]}
                  onValueChange={([value]) => 
                    useSubtitleStore.setState({ syncOffset: value })
                  }
                  min={-5000}
                  max={5000}
                  step={50}
                  className="flex-1"
                />
                
                <Button
                  onClick={() => adjustSyncOffset(50)}
                  size="sm"
                  variant="outline"
                  title="Delay subtitle by 50ms (H)"
                >
                  <Plus className="w-3 h-3" />
                  50ms
                </Button>
                
                <Button
                  onClick={() => adjustSyncOffset(500)}
                  size="sm"
                  variant="outline"
                  title="Delay subtitle by 500ms (Shift+H)"
                >
                  <Plus className="w-3 h-3" />
                  500ms
                </Button>
                
                <Button
                  onClick={resetSyncOffset}
                  size="sm"
                  variant="ghost"
                  title="Reset sync to 0"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* 자막 속도 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Subtitle Speed</Label>
                <span className="text-sm font-mono">
                  {speedMultiplier.toFixed(2)}x
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setSpeedMultiplier(0.5)}
                  size="sm"
                  variant={speedMultiplier === 0.5 ? "default" : "outline"}
                >
                  0.5x
                </Button>
                
                <Button
                  onClick={() => setSpeedMultiplier(0.75)}
                  size="sm"
                  variant={speedMultiplier === 0.75 ? "default" : "outline"}
                >
                  0.75x
                </Button>
                
                <Slider
                  value={[speedMultiplier]}
                  onValueChange={([value]) => setSpeedMultiplier(value)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="flex-1"
                />
                
                <Button
                  onClick={() => setSpeedMultiplier(1.5)}
                  size="sm"
                  variant={speedMultiplier === 1.5 ? "default" : "outline"}
                >
                  1.5x
                </Button>
                
                <Button
                  onClick={() => setSpeedMultiplier(2)}
                  size="sm"
                  variant={speedMultiplier === 2 ? "default" : "outline"}
                >
                  2x
                </Button>
                
                <Button
                  onClick={resetSpeed}
                  size="sm"
                  variant="ghost"
                  title="Reset speed to 1.0x"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 스타일 & 위치 */}
        <AccordionItem value="style">
          <AccordionTrigger className="text-sm font-medium">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Style & Position
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            {/* 위치 설정 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MoveVertical className="w-4 h-4" />
                Position
              </Label>
              <Select value={position} onValueChange={setPosition as any}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              
              {position === 'custom' && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Vertical Position</span>
                    <span className="text-xs font-mono">{customPosition.y}%</span>
                  </div>
                  <Slider
                    value={[customPosition.y]}
                    onValueChange={([y]) => 
                      useSubtitleStore.setState({ 
                        customPosition: { ...customPosition, y } 
                      })
                    }
                    min={10}
                    max={90}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* 폰트 크기 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Type className="w-4 h-4" />
                Font Size
              </Label>
              <Select 
                value={style.fontSize} 
                onValueChange={(value) => 
                  updateStyle({ fontSize: value as any })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="xlarge">Extra Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 폰트 굵기 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Font Weight</Label>
              <Select 
                value={style.fontWeight} 
                onValueChange={(value) => 
                  updateStyle({ fontWeight: value as any })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 텍스트 색상 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Text Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={style.color}
                  onChange={(e) => updateStyle({ color: e.target.value })}
                  className="h-9 w-16 rounded border cursor-pointer"
                />
                <Select 
                  value={style.color}
                  onValueChange={(value) => updateStyle({ color: value })}
                >
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="#FFFFFF">White</SelectItem>
                    <SelectItem value="#FFFF00">Yellow</SelectItem>
                    <SelectItem value="#00FF00">Green</SelectItem>
                    <SelectItem value="#00FFFF">Cyan</SelectItem>
                    <SelectItem value="#FF00FF">Magenta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 배경 색상 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Background</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={style.backgroundColor}
                  onChange={(e) => updateStyle({ backgroundColor: e.target.value })}
                  className="h-9 w-16 rounded border cursor-pointer"
                />
                <Select 
                  value={style.backgroundColor}
                  onValueChange={(value) => updateStyle({ backgroundColor: value })}
                >
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="#000000">Black</SelectItem>
                    <SelectItem value="#333333">Dark Gray</SelectItem>
                    <SelectItem value="#666666">Gray</SelectItem>
                    <SelectItem value="transparent">Transparent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 배경 투명도 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Background Opacity</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(style.backgroundOpacity * 100)}%
                </span>
              </div>
              <Slider
                value={[style.backgroundOpacity]}
                onValueChange={([value]) => updateStyle({ backgroundOpacity: value })}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* 테두리 스타일 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Edge Style</Label>
              <Select 
                value={style.edgeStyle}
                onValueChange={(value) => 
                  updateStyle({ edgeStyle: value as any })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="dropshadow">Drop Shadow</SelectItem>
                  <SelectItem value="raised">Raised</SelectItem>
                  <SelectItem value="depressed">Depressed</SelectItem>
                  <SelectItem value="uniform">Uniform</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 스타일 리셋 */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={resetStyle}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Style
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* 키보드 단축키 안내 */}
      <div className="text-xs text-muted-foreground space-y-1 p-3 bg-background/50 rounded border border-border/30">
        <div className="font-medium mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Keyboard Shortcuts
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 ml-3">
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">V</kbd>
            <span>Toggle subtitle</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">J</kbd>
            <span>Cycle tracks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">G</kbd>
            <span className="text-xs">/ </span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">H</kbd>
            <span>±50ms</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Shift+G/H</kbd>
            <span>±500ms</span>
          </div>
        </div>
      </div>

      {/* 스트리밍 상태 표시 */}
      {isStreaming && tracks.size > 0 && (
        <div className="text-xs text-blue-500 bg-blue-50 dark:bg-blue-950 p-3 rounded flex items-center gap-2 border border-blue-200 dark:border-blue-800">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
          <span>Subtitles are being shared with all participants in real-time</span>
        </div>
      )}
    </div>
  );
};
