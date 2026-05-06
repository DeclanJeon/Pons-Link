// src/components/FileStreaming/StreamControls.tsx
import { Button } from '@/components/ui/button';
import { Play, StopCircle, Camera, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StreamControlsProps {
  isStreaming: boolean;
  selectedFile: File | null;
  peers: Map<string, any>;
  onStartStreaming: () => void;
  onStopStreaming: () => void;
  onReturnToCamera: () => void;
  isReturningToCamera?: boolean;
}

export const StreamControls = ({
  isStreaming,
  selectedFile,
  peers,
  onStartStreaming,
  onStopStreaming,
  onReturnToCamera,
  isReturningToCamera = false
}: StreamControlsProps) => {
  const connectedPeers = Array.from(peers.values()).filter(
    peer => peer?.connected && !peer?.destroyed
  ).length;
  
  return (
    <div className="ponscast-stream-dock flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Ready to share</p>
        <p className="mt-1 text-xs text-white/70">Cue one item, then share it to everyone in the room.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!isStreaming ? (
          <Button
            onClick={onStartStreaming}
            disabled={!selectedFile}
            className="flex items-center gap-2 rounded-xl bg-indigo-500/80 text-white hover:bg-indigo-400 disabled:bg-white/[0.055] disabled:text-white/60"
          >
            <Play className="w-4 h-4" />
            {selectedFile ? 'Share to room' : 'Choose media first'}
          </Button>
        ) : (
          <>
            <Button
              onClick={onStopStreaming}
              variant="ghost"
              className="room-nav-button-danger flex items-center gap-2 rounded-xl"
            >
              <StopCircle className="w-4 h-4" />
              Stop sharing
            </Button>
            <Button
              onClick={onReturnToCamera}
              variant="ghost"
              className="room-nav-button-muted flex items-center gap-2 rounded-xl"
              disabled={isReturningToCamera}
            >
              {isReturningToCamera ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Returning...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  Camera
                </>
              )}
            </Button>
          </>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-white/70">
        {selectedFile && (
          <Badge variant="outline" className="border-white/10 bg-white/[0.035] text-xs text-white/70">
            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
          </Badge>
        )}
        {isStreaming && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="font-medium text-emerald-300">
                Sharing
              </span>
            </div>
            <Badge variant={connectedPeers > 0 ? "default" : "secondary"}>
              {connectedPeers} viewer{connectedPeers !== 1 ? 's' : ''}
            </Badge>
          </div>
        )}
        {isStreaming && connectedPeers === 0 && (
          <Badge variant="destructive" className="text-xs">
            No viewers yet
          </Badge>
        )}
      </div>
    </div>
  );
};
