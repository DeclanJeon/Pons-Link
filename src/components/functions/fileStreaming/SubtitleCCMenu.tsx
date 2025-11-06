import { useMemo, useCallback, useRef, ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { subtitleTransport } from '@/services/subtitleTransport';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  isStreaming: boolean;
};

export const SubtitleCCMenu = ({ open, onClose, containerRef, isStreaming }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    tracks,
    activeTrackId,
    isEnabled,
    position,
    customPosition,
    style,
    isRemoteSubtitleEnabled,
    setActiveTrack,
    setPosition,
    updateStyle,
    broadcastTrack,
    broadcastSubtitleState,
    addTrack
  } = useSubtitleStore();

  const trackList = useMemo(() => Array.from(tracks.values()), [tracks]);

  const broadcast = useCallback(() => {
    broadcastSubtitleState();
  }, [broadcastSubtitleState]);

  const onToggleEnabled = useCallback((v: boolean) => {
    useSubtitleStore.setState({ isEnabled: v });
    broadcast();
    const currentId = useSubtitleStore.getState().activeTrackId;
    if (isStreaming && currentId) {
      subtitleTransport.sendRemoteEnable(currentId, v);
    }
  }, [broadcast, isStreaming]);

  const onShareToggle = useCallback((v: boolean) => {
    useSubtitleStore.setState({ isRemoteSubtitleEnabled: v });
    const currentId = useSubtitleStore.getState().activeTrackId;
    if (currentId) {
      subtitleTransport.sendRemoteEnable(currentId, v);
    }
    broadcast();
  }, [broadcast]);

  const onTrackChange = useCallback((id: string) => {
    setActiveTrack(id === 'none' ? null : id);
    if (id !== 'none') {
      broadcastTrack(id);
    }
    broadcast();
  }, [setActiveTrack, broadcastTrack, broadcast]);

  const handleSubtitleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubtitleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await addTrack(file);
      const state = useSubtitleStore.getState();
      const ids = Array.from(state.tracks.keys());
      const newId = ids[ids.length - 1];
      if (newId) {
        state.setActiveTrack(newId);
        state.broadcastTrack(newId);
        state.broadcastSubtitleState();
        if (isStreaming) {
          subtitleTransport.sendRemoteEnable(newId, true);
        }
      }
      toast.success(`Subtitle loaded: ${file.name}`);
    } catch {
      toast.error('Failed to load subtitle');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [addTrack, isStreaming]);

  const onPositionChange = useCallback((v: string) => {
    setPosition(v as any);
    broadcast();
  }, [setPosition, broadcast]);

  const onCustomYChange = useCallback((v: number[]) => {
    const y = v[0];
    useSubtitleStore.setState({ customPosition: { ...customPosition, y } });
    broadcast();
  }, [customPosition, broadcast]);

  const onFontSizeChange = useCallback((v: string) => {
    updateStyle({ fontSize: v as any });
    broadcast();
  }, [updateStyle, broadcast]);

  const onFontWeightChange = useCallback((v: string) => {
    updateStyle({ fontWeight: v as any });
    broadcast();
  }, [updateStyle, broadcast]);

  const onTextColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateStyle({ color: e.target.value });
    broadcast();
  }, [updateStyle, broadcast]);

  const onBgColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateStyle({ backgroundColor: e.target.value });
    broadcast();
  }, [updateStyle, broadcast]);

  const onBgOpacityChange = useCallback((v: number[]) => {
    updateStyle({ backgroundOpacity: v[0] });
    broadcast();
  }, [updateStyle, broadcast]);

  const onEdgeStyleChange = useCallback((v: string) => {
    updateStyle({ edgeStyle: v as any });
    broadcast();
  }, [updateStyle, broadcast]);

  if (!open) return null;

  return (
    <div className="absolute z-50 right-3 top-12 w-[340px] max-w-[92vw] rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Subtitles</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSubtitleUploadClick}>
            <Upload className="w-3 h-3 mr-1" />
            Load
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt"
        className="hidden"
        onChange={handleSubtitleFileChange}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Track</Label>
          <Select value={activeTrackId || 'none'} onValueChange={onTrackChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select track" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No subtitle</SelectItem>
              {trackList.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.label} ({t.language.toUpperCase()})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Enabled</Label>
          <div className="h-9 px-3 border rounded-md flex items-center justify-between">
            <div className="text-xs">On/Off</div>
            <Switch checked={isEnabled} onCheckedChange={onToggleEnabled} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Position</Label>
          <Select value={position} onValueChange={onPositionChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="center">Bottom Center</SelectItem>
              <SelectItem value="bottom">Bottom Left</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Share</Label>
          <div className="h-9 px-3 border rounded-md flex items-center justify-between">
            <div className="text-xs">Participants</div>
            <Switch checked={!!isRemoteSubtitleEnabled} onCheckedChange={onShareToggle} />
          </div>
        </div>

        {position === 'custom' && (
          <div className="col-span-2 space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Vertical</Label>
              <div className="text-[10px] text-muted-foreground">{customPosition.y}%</div>
            </div>
            <Slider value={[customPosition.y]} onValueChange={onCustomYChange} min={10} max={90} step={1} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs">Font Size</Label>
          <Select value={style.fontSize} onValueChange={onFontSizeChange}>
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

        <div className="space-y-1.5">
          <Label className="text-xs">Font Weight</Label>
          <Select value={style.fontWeight} onValueChange={onFontWeightChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Text Color</Label>
          <div className="h-9 px-3 border rounded-md flex items-center justify-between">
            <div className="text-xs">{style.color}</div>
            <input type="color" value={style.color} onChange={onTextColorChange} className="h-6 w-10 border rounded" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Background</Label>
          <div className="h-9 px-3 border rounded-md flex items-center justify-between">
            <div className="text-xs">{style.backgroundColor}</div>
            <input type="color" value={style.backgroundColor} onChange={onBgColorChange} className="h-6 w-10 border rounded" />
          </div>
        </div>

        <div className="col-span-2 space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Background Opacity</Label>
            <div className="text-[10px] text-muted-foreground">{Math.round(style.backgroundOpacity * 100)}%</div>
          </div>
          <Slider value={[style.backgroundOpacity]} onValueChange={onBgOpacityChange} min={0} max={1} step={0.1} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs">Edge</Label>
          <Select value={style.edgeStyle} onValueChange={onEdgeStyleChange}>
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
      </div>

      <div className="mt-2 rounded-lg border border-border/50 bg-card/70 px-3 py-2">
        <div
          className="text-center"
          style={{
            color: style.color,
            fontWeight: style.fontWeight,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize === 'small' ? 12 : style.fontSize === 'medium' ? 16 : style.fontSize === 'large' ? 20 : 24,
            textShadow: style.edgeStyle === 'uniform' ? `0 0 4px ${style.edgeColor}` : style.edgeStyle === 'dropshadow' ? `2px 2px 4px ${style.edgeColor}` : style.edgeStyle === 'raised' ? `1px 1px 2px ${style.edgeColor}` : style.edgeStyle === 'depressed' ? `-1px -1px 2px ${style.edgeColor}` : 'none',
            WebkitTextStroke: style.edgeStyle === 'uniform' ? `1px ${style.edgeColor}` : undefined,
            backgroundColor: `${style.backgroundColor}${Math.round(style.backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
            display: 'inline-block',
            padding: '6px 12px',
            borderRadius: 6
          }}
        >
          Subtitle preview
        </div>
      </div>
    </div>
  );
};