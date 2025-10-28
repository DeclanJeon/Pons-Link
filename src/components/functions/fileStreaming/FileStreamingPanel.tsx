import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Maximize2, Minimize2, Camera, Bug, AlertCircle, Minus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { toast } from 'sonner';
import { VideoJsPlayer } from './VideoJsPlayer';
import { PDFViewer } from './PDFViewer';
import { ImageViewer } from './ImageViewer';
import { FileSelector } from './FileSelector';
import { DebugPanel } from './DebugPanel';
import { StreamControls } from './StreamControls';
import { MiniPlayer } from './MiniPlayer';
import { SubtitlePanelIntegrated } from './SubtitlePanelIntegrated';
import { useFileStreaming } from '@/hooks/useFileStreaming';
import { cn } from '@/lib/utils';
import { getDeviceInfo } from '@/lib/device/deviceDetector';
import { useFullscreenStore } from '@/stores/useFullscreenStore';
import type Player from 'video.js/dist/types/player';
import { useUIManagementStore } from '@/stores/useUIManagementStore';

interface FileStreamingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FileStreamingPanel = ({ isOpen, onClose }: FileStreamingPanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [isReturningToCamera, setIsReturningToCamera] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<string>('');

  const setActivePanel = useUIManagementStore(s => s.setActivePanel);

  const isFullscreen = useFullscreenStore(state => state.isFullscreen);
  const toggleFullscreen = useFullscreenStore(state => state.toggleFullscreen);

  const { peers, webRTCManager } = usePeerConnectionStore();
  const { localStream, isSharingScreen, toggleScreenShare } = useMediaDeviceStore();
  const {
    selectedFile,
    fileType,
    isStreaming,
    streamQuality,
    isMinimized,
    setSelectedFile,
    setFileType,
    setIsStreaming,
    setMinimized,
    toggleMinimized,
    reset: resetStreamingStore
  } = useFileStreamingStore();

  const {
    debugInfo,
    videoState,
    handleFileSelect,
    startStreaming,
    stopStreaming,
    updateStream,
    updateDebugInfo,
    cleanupResources
  } = useFileStreaming({
    canvasRef,
    videoRef,
    webRTCManager,
    localStream,
    peers,
    isStreaming,
    setIsStreaming,
    streamQuality,
    fileType
  });

  useEffect(() => {
    const info = getDeviceInfo();
    if (info.isIOS) {
      setDeviceInfo(`iOS ${info.iosVersion || 'Unknown'} - ${info.optimalMimeType}`);
    } else {
      setDeviceInfo('Desktop/Android');
    }
  }, []);

  useEffect(() => {
    return () => {
      const cleanup = async () => {
        if (isStreaming) {
          await stopStreaming();
        }
        cleanupResources();
        resetStreamingStore();
      };
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Escape' && isFullscreen) {
        return;
      }
      if (e.key === 'Escape' && !isStreaming && !isMinimized) {
        onClose();
      }
      if (e.key === 'm' || e.key === 'M') {
        if (isStreaming && !isFullscreen) {
          e.preventDefault();
          toggleMinimized();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, isStreaming, onClose, isMinimized, toggleMinimized, isFullscreen]);

  const handleMinimize = () => {
    if (isFullscreen) {
      toast.info('Exiting fullscreen to minimize...', { duration: 1500 });
      toggleFullscreen('fileStreaming', playerRef.current);
      requestAnimationFrame(() => {
        setMinimized(true);
      });
      return;
    }
    if (!isStreaming) {
      toast.warning('Start streaming first to minimize');
      return;
    }
    setMinimized(true);
  };

  const handleMaximize = () => {
    setMinimized(false);
    setActivePanel('fileStreaming');
  };

  const returnToCamera = async () => {
    setIsReturningToCamera(true);
    try {
      if (isStreaming) {
        await stopStreaming();
      }
      setMinimized(false);
      setTimeout(() => {
        onClose();
        setIsReturningToCamera(false);
      }, 500);
    } catch (error) {
      console.error('Error returning to camera:', error);
      toast.error('Failed to return to camera');
      setIsReturningToCamera(false);
    }
  };

  const handleStop = async () => {
    await stopStreaming();
    setMinimized(false);
  };

  const shouldRender = isOpen || isMinimized || isStreaming;
  if (!shouldRender) return null;

  return (
    <>
      {isMinimized && (
        <MiniPlayer
          onMaximize={handleMaximize}
          onStop={handleStop}
          onReturnToCamera={returnToCamera}
        />
      )}

      <div
        className={cn(
          'fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-6',
          (isMinimized || !isOpen) && 'hidden'
        )}
      >
        <Card className={`${isFullscreen ? 'w-full h-full' : 'w-full max-w-5xl max-h-[90vh]'} overflow-hidden flex flex-col`}>
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-bold">File Streaming</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className={showDebug ? 'bg-secondary' : ''}
                title="Toggle debug panel (D)"
              >
                <Bug className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMinimize}
                disabled={!isStreaming}
                title={isStreaming ? 'Minimize (M)' : 'Start streaming to minimize'}
              >
                <Minus className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleFullscreen('fileStreaming', playerRef.current)}
                title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={returnToCamera}
                disabled={isReturningToCamera}
                title="Return to camera"
              >
                <Camera className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isStreaming}
                title={isStreaming ? 'Stop streaming first' : 'Close panel (ESC)'}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isStreaming && (
            <Alert className="m-4 mb-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>File is currently being streamed. You can minimize this panel to continue working.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMinimize}
                  className="ml-4"
                >
                  Minimize
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {deviceInfo.includes('iOS') && (
            <Alert className="m-4 mb-0 bg-blue-50 dark:bg-blue-950 border-blue-200">
              <AlertDescription className="flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {deviceInfo}
                </span>
                <span className="text-xs text-muted-foreground">
                  - Optimized for iOS Safari
                </span>
              </AlertDescription>
            </Alert>
          )}

          {showDebug && <DebugPanel debugInfo={debugInfo} />}

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <FileSelector
                selectedFile={selectedFile}
                isStreaming={isStreaming}
                streamQuality={streamQuality}
                onFileSelect={(file) => handleFileSelect(file, setSelectedFile, setFileType)}
              />

              {fileType === 'video' && selectedFile && (
                <>
                  <VideoJsPlayer
                    videoRef={videoRef}
                    playerRef={playerRef}
                    videoState={videoState}
                    onStateChange={updateDebugInfo}
                    isStreaming={isStreaming}
                    file={selectedFile}
                  />
                  <SubtitlePanelIntegrated
                    videoRef={videoRef}
                    isStreaming={isStreaming}
                  />
                </>
              )}

              {fileType === 'pdf' && selectedFile && (
                <PDFViewer
                  canvasRef={canvasRef}
                  file={selectedFile}
                  isStreaming={isStreaming}
                  onStreamUpdate={updateStream}
                />
              )}

              {fileType === 'image' && selectedFile && (
                <ImageViewer
                  canvasRef={canvasRef}
                  isStreaming={isStreaming}
                  onStreamUpdate={updateStream}
                />
              )}

              {(fileType === 'pdf' || fileType === 'image') && (
                <div className="relative bg-black rounded-lg overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto max-h-[500px] object-contain mx-auto"
                    style={{ display: 'block' }}
                  />
                  {isStreaming && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm animate-pulse">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      LIVE
                    </div>
                  )}
                </div>
              )}

              <StreamControls
                isStreaming={isStreaming}
                selectedFile={selectedFile}
                peers={peers}
                onStartStreaming={async () => {
                  if (isSharingScreen) {
                    const confirmed = window.confirm('현재 화면 공유 중입니다. 중지하고 파일 스트리밍을 시작할까요?');
                    if (confirmed) {
                      await toggleScreenShare();
                      startStreaming(selectedFile!);
                    }
                  } else {
                    startStreaming(selectedFile!);
                  }
                }}
                onStopStreaming={stopStreaming}
                onReturnToCamera={returnToCamera}
                isReturningToCamera={isReturningToCamera}
              />
            </div>
          </div>

          <div className="px-4 pb-2 text-xs text-muted-foreground">
            <span className="mr-4">ESC: Close</span>
            <span className="mr-4">M: Minimize</span>
            <span className="mr-4">D: Debug</span>
            {fileType === 'video' && <span>(Video.js hotkeys enabled)</span>}
          </div>
        </Card>
      </div>
    </>
  );
};
