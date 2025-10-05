/**
 * @fileoverview Video.js와 통합된 자막 패널
 * @module components/FileStreaming/SubtitlePanelIntegrated
 * @description 자막 파일 업로드, 동기화 오프셋, 재생 속도, 스타일 설정 통합
 */

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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
  Subtitles 
} from 'lucide-react';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { SubtitleStyleSettings } from './SubtitleStyleSettings';
import { toast } from 'sonner';

interface SubtitlePanelIntegratedProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
}

export const SubtitlePanelIntegrated = ({
  videoRef,
  isStreaming
}: SubtitlePanelIntegratedProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const {
    tracks,
    activeTrackId,
    syncOffset,
    speedMultiplier,
    isEnabled,
    addTrack,
    setActiveTrack,
    adjustSyncOffset,
    setSpeedMultiplier,
    broadcastTrack
  } = useSubtitleStore();

  /**
   * 자막 파일 선택 핸들러
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await addTrack(file);
        
        // 스트리밍 중이면 자막을 모든 피어에게 브로드캐스트
        if (isStreaming) {
          // 방금 추가된 트랙 ID 찾기
          const trackIds = Array.from(tracks.keys());
          const lastTrackId = trackIds[trackIds.length - 1];
          
          if (lastTrackId) {
            // 약간의 지연 후 브로드캐스트 (트랙이 완전히 로드되도록)
            setTimeout(() => {
              broadcastTrack(lastTrackId);
              toast.success('Subtitle shared with all participants');
            }, 500);
          }
        }
      } catch (error) {
        console.error('[SubtitlePanel] Failed to load subtitle:', error);
        toast.error('Failed to load subtitle file');
      }
      
      // 파일 입력 초기화
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
   * 재생 속도 리셋
   */
  const resetSpeed = () => {
    setSpeedMultiplier(1.0);
    toast.info('Subtitle speed reset to 1.0x');
  };

  return (
    <div className="subtitle-panel space-y-4 p-4 bg-secondary/50 rounded-lg">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <Subtitles className="w-5 h-5" />
        Subtitle Settings
      </h3>

      {/* 자막 파일 업로드 & 트랙 선택 */}
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

        {isStreaming && tracks.size > 0 && (
          <span className="text-xs text-green-500 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Shared
          </span>
        )}
      </div>

      {/* 자막 동기화 오프셋 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Subtitle Delay
          </label>
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

      {/* 재생 속도 배율 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Subtitle Speed</label>
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

      {/* 자막 스타일 설정 */}
      <SubtitleStyleSettings />

      {/* 키보드 단축키 안내 */}
      <div className="text-xs text-muted-foreground space-y-1 p-2 bg-background/50 rounded">
        <div className="font-medium mb-1">⌨️ Keyboard shortcuts:</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 ml-2">
          <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">V</kbd> - Toggle subtitle</span>
          <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">J</kbd> - Cycle tracks</span>
          <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">G</kbd> / <kbd className="px-1 py-0.5 bg-muted rounded text-xs">H</kbd> - Adjust 50ms</span>
          <span><kbd className="px-1 py-0.5 bg-muted rounded text-xs">Shift+G</kbd> / <kbd className="px-1 py-0.5 bg-muted rounded text-xs">H</kbd> - Adjust 500ms</span>
        </div>
      </div>

      {/* 스트리밍 상태 안내 */}
      {isStreaming && (
        <div className="text-xs text-blue-500 bg-blue-50 dark:bg-blue-950 p-2 rounded flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          Subtitles are being shared with all participants in real-time
        </div>
      )}
    </div>
  );
};
