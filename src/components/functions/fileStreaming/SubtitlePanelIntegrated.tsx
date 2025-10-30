import { useRef, useState, useCallback } from 'react';
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
  MoveVertical,
  Zap
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

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await addTrack(file);
        
        if (isStreaming) {
          const trackIds = Array.from(tracks.keys());
          const lastTrackId = trackIds[trackIds.length - 1];
          
          if (lastTrackId) {
            setTimeout(() => {
              broadcastTrack(lastTrackId);
              broadcastSubtitleState();
              
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
          toast.success('Subtitle loaded (will be shared when streaming starts)');
        }
      } catch (error) {
        console.error('[SubtitlePanel] Failed to load subtitle:', error);
        toast.error('Failed to load subtitle file');
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [addTrack, isStreaming, tracks, broadcastTrack, broadcastSubtitleState]);

  const resetSyncOffset = useCallback(() => {
    useSubtitleStore.setState({ syncOffset: 0 });
    toast.info('Subtitle sync reset to 0s');
  }, []);

  const resetSpeed = useCallback(() => {
    setSpeedMultiplier(1.0);
    toast.info('Subtitle speed reset to 1.0x');
  }, [setSpeedMultiplier]);

  const resetStyle = useCallback(() => {
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
  }, [updateStyle]);

  const quickAdjustSync = useCallback((ms: number) => {
    adjustSyncOffset(ms);
  }, [adjustSyncOffset]);

  return (
    <div className="subtitle-panel space-y-4 p-4 bg-secondary/30 rounded-lg backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Subtitles className="w-5 h-5 text-primary" />
          Subtitle Settings
        </h3>
        {isStreaming && tracks.size > 0 && (
          <span className="text-xs text-green-500 flex items-center gap-1.5 bg-green-500/10 px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live Shared
          </span>
        )}
      </div>

      <Accordion 
        type="multiple" 
        value={activeSection} 
        onValueChange={setActiveSection}
        className="w-full space-y-2"
      >
        <AccordionItem value="basic" className="border rounded-lg px-4 bg-card/50">
          <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Subtitles className="w-4 h-4 text-primary" />
              <span>Basic Settings</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2 pb-4">
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
                  <SelectTrigger className="flex-1 h-9">
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
                className="h-9 px-3"
              >
                {isEnabled ? 'ON' : 'OFF'}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="timing" className="border rounded-lg px-4 bg-card/50">
          <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Timing Adjustment</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2 pb-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Subtitle Delay
                </Label>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                  {syncOffset > 0 ? '+' : ''}{(syncOffset / 1000).toFixed(2)}s
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => quickAdjustSync(-500)}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  <Minus className="w-3 h-3 mr-1" />
                  500ms
                </Button>
                <Button
                  onClick={() => quickAdjustSync(-50)}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  <Minus className="w-3 h-3 mr-1" />
                  50ms
                </Button>
                <Button
                  onClick={() => quickAdjustSync(50)}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  50ms
                </Button>
                <Button
                  onClick={() => quickAdjustSync(500)}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  500ms
                </Button>
              </div>

              <Slider
                value={[syncOffset]}
                onValueChange={([value]) => 
                  useSubtitleStore.setState({ syncOffset: value })
                }
                min={-5000}
                max={5000}
                step={50}
                className="w-full"
              />

              <Button
                onClick={resetSyncOffset}
                size="sm"
                variant="ghost"
                className="w-full text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset to 0
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Playback Speed
                </Label>
                <span className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                  {speedMultiplier.toFixed(2)}x
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map(speed => (
                  <Button
                    key={speed}
                    onClick={() => setSpeedMultiplier(speed)}
                    size="sm"
                    variant={Math.abs(speedMultiplier - speed) < 0.01 ? "default" : "outline"}
                    className="text-xs"
                  >
                    {speed}x
                  </Button>
                ))}
              </div>

              <Slider
                value={[speedMultiplier]}
                onValueChange={([value]) => setSpeedMultiplier(value)}
                min={0.5}
                max={2}
                step={0.1}
                className="w-full"
              />

              <Button
                onClick={resetSpeed}
                size="sm"
                variant="ghost"
                className="w-full text-xs"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset to 1.0x
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="style" className="border rounded-lg px-4 bg-card/50">
          <AccordionTrigger className="text-sm font-medium hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" />
              <span>Style & Position</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2 pb-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MoveVertical className="w-3.5 h-3.5" />
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
                <div className="space-y-2 pt-2 bg-muted/30 p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Vertical Position</span>
                    <span className="text-xs font-mono bg-background px-2 py-0.5 rounded">{customPosition.y}%</span>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Type className="w-3 h-3" />
                  Font Size
                </Label>
                <Select 
                  value={style.fontSize} 
                  onValueChange={(value) => 
                    updateStyle({ fontSize: value as any })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
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

              <div className="space-y-2">
                <Label className="text-xs font-medium">Font Weight</Label>
                <Select 
                  value={style.fontWeight} 
                  onValueChange={(value) => 
                    updateStyle({ fontWeight: value as any })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Text Color</Label>
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
                  <SelectTrigger className="h-9 flex-1 text-xs">
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

            <div className="space-y-2">
              <Label className="text-xs font-medium">Background</Label>
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
                  <SelectTrigger className="h-9 flex-1 text-xs">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Background Opacity</Label>
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

            <div className="space-y-2">
              <Label className="text-xs font-medium">Edge Style</Label>
              <Select 
                value={style.edgeStyle}
                onValueChange={(value) => 
                  updateStyle({ edgeStyle: value as any })
                }
              >
                <SelectTrigger className="h-9 text-xs">
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

      <div className="text-xs text-muted-foreground space-y-2 p-3 bg-muted/30 rounded-lg border border-border/30">
        <div className="font-medium mb-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Keyboard Shortcuts
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 ml-3">
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">V</kbd>
            <span className="text-[11px]">Toggle subtitle</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">J</kbd>
            <span className="text-[11px]">Cycle tracks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">G</kbd>
            <span className="text-[11px]">/ </span>
            <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">H</kbd>
            <span className="text-[11px]">50ms</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-background rounded text-[10px] font-mono border">Shift+G/H</kbd>
            <span className="text-[11px]">500ms</span>
          </div>
        </div>
      </div>

      {isStreaming && tracks.size > 0 && (
        <div className="text-xs text-blue-500 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg flex items-center gap-2 border border-blue-200 dark:border-blue-800">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
          <span>Subtitles are being shared with all participants in real-time</span>
        </div>
      )}
    </div>
  );
};
