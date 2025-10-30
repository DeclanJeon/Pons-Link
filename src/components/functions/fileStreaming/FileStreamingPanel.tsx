import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Maximize2, Minimize2, Camera, Bug, AlertCircle, Minus, SkipBack, SkipForward, List, Upload, Folder, Trash2 } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';

interface FileStreamingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FileStreamingPanel = ({ isOpen, onClose }: FileStreamingPanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const [showDebug, setShowDebug] = useState(false);
  const [isReturningToCamera, setIsReturningToCamera] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  
  const isMobile = useIsMobile();
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
    reset: resetStreamingStore,
    playlist,
    currentIndex,
    addToPlaylist,
    addFolderToPlaylist,
    nextItem,
    prevItem,
    setCurrentIndex,
    removeFromPlaylist
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

  const handleMinimize = useCallback(() => {
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
  }, [isFullscreen, isStreaming, toggleFullscreen, setMinimized]);

  const handleMaximize = useCallback(() => {
    setMinimized(false);
    setActivePanel('fileStreaming');
  }, [setMinimized, setActivePanel]);

  const returnToCamera = useCallback(async () => {
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
      toast.error('Failed to return to camera');
      setIsReturningToCamera(false);
    }
  }, [isStreaming, stopStreaming, setMinimized, onClose]);

  const handleStop = useCallback(async () => {
    await stopStreaming();
    setMinimized(false);
  }, [stopStreaming, setMinimized]);

  const sendPlaylistOp = useCallback((op: 'next' | 'prev' | 'jump', index?: number) => {
    usePeerConnectionStore.getState().sendToAllPeers(
      JSON.stringify({ type: 'ponscast', payload: { action: op, index } })
    );
  }, []);

  const hasNext = useMemo(() => {
    if (playlist.length === 0) return false;
    return currentIndex >= 0 && currentIndex + 1 < playlist.length;
  }, [playlist.length, currentIndex]);

  const autoPlayNext = useCallback(async () => {
    if (!hasNext) return;
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    const nextFile = playlist[newIndex]?.file || null;
    if (nextFile) {
      setSelectedFile(nextFile);
      const nextType = nextFile.type.startsWith('video/') 
        ? 'video' 
        : nextFile.type === 'application/pdf' 
          ? 'pdf' 
          : nextFile.type.startsWith('image/') 
            ? 'image' 
            : 'other';
      setFileType(nextType);
      sendPlaylistOp('next');
      if (isStreaming) {
        setTimeout(() => {
          startStreaming(nextFile);
        }, 0);
      }
    }
  }, [hasNext, currentIndex, playlist, setCurrentIndex, setSelectedFile, setFileType, sendPlaylistOp, isStreaming, startStreaming]);

  const handleFolderSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const supportedFiles = fileArray.filter(file => 
      file.type.startsWith('video/') || 
      file.type === 'application/pdf' || 
      file.type.startsWith('image/')
    );

    if (supportedFiles.length === 0) {
      toast.error('No supported files found in folder');
      return;
    }

    const folderPath = (files[0] as any).webkitRelativePath?.split('/')[0] || 'Folder';
    addFolderToPlaylist(supportedFiles, folderPath);
    toast.success(`Added ${supportedFiles.length} files from ${folderPath}`);

    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  }, [addFolderToPlaylist]);

  const handleRemoveFromPlaylist = useCallback((index: number) => {
    removeFromPlaylist(index);
    toast.info('Item removed from playlist');
  }, [removeFromPlaylist]);

  const shouldRender = isOpen || isMinimized || isStreaming;
  if (!shouldRender) return null;

  if (isMobile) {
    return (
      <>
        {isMinimized && (
          <MiniPlayer
            onMaximize={handleMaximize}
            onStop={handleStop}
            onReturnToCamera={returnToCamera}
          />
        )}

        <div className={cn(
          'fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto',
          (isMinimized || !isOpen) && 'hidden'
        )}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-3 border-b sticky top-0 bg-background/95 backdrop-blur z-10">
              <h2 className="text-lg font-bold">PonsCast</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)} className={showDebug ? 'bg-secondary' : ''}>
                  <Bug className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleMinimize} disabled={!isStreaming}>
                  <Minus className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={returnToCamera} disabled={isReturningToCamera}>
                  <Camera className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose} disabled={isStreaming}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isStreaming && (
              <Alert className="m-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  File is being streamed. You can minimize this panel.
                </AlertDescription>
              </Alert>
            )}

            {showDebug && <DebugPanel debugInfo={debugInfo} />}

            <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-20">
              <div className="border rounded-lg bg-card">
                <div className="p-2 border-b flex items-center justify-between">
                  <div className="text-sm font-semibold">Playlist</div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => { prevItem(); sendPlaylistOp('prev'); }} disabled={playlist.length === 0 || currentIndex <= 0}>
                      <SkipBack className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { nextItem(); sendPlaylistOp('next'); }} disabled={!hasNext}>
                      <SkipForward className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="max-h-[40vh] overflow-auto p-2 space-y-1">
                  {playlist.length === 0 && (
                    <div className="text-xs text-muted-foreground p-2 text-center">Add files to start</div>
                  )}
                  {playlist.map((p, i) => (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded border text-xs',
                        i === currentIndex ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                      )}
                    >
                      <button
                        onClick={() => { setCurrentIndex(i); setSelectedFile(p.file); setFileType(p.type); sendPlaylistOp('jump', i); }}
                        className="flex-1 text-left truncate"
                      >
                        <div className="truncate font-medium">{p.name}</div>
                        {p.path && <div className="text-[10px] opacity-70 truncate">{p.path}</div>}
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromPlaylist(i);
                        }}
                        className="h-6 w-6 p-0 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t space-y-2">
                  <FileSelector
                    selectedFile={selectedFile}
                    isStreaming={isStreaming}
                    streamQuality={streamQuality}
                    onFileSelect={(file) => handleFileSelect(file, setSelectedFile, setFileType)}
                  />
                  <div className="flex gap-2">
                    <input
                      ref={folderInputRef}
                      type="file"
                      /* @ts-ignore */
                      webkitdirectory=""
                      directory=""
                      multiple
                      onChange={handleFolderSelect}
                      className="hidden"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => folderInputRef.current?.click()}
                      className="flex-1 text-xs"
                    >
                      <Folder className="w-3 h-3 mr-1" />
                      Add Folder
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden bg-card">
                {fileType === 'video' && selectedFile && (
                  <>
                    <VideoJsPlayer
                      videoRef={videoRef}
                      playerRef={playerRef}
                      videoState={videoState}
                      onStateChange={updateDebugInfo}
                      onEnded={autoPlayNext}
                      isStreaming={isStreaming}
                      file={selectedFile}
                    />
                    <SubtitlePanelIntegrated videoRef={videoRef} isStreaming={isStreaming} />
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
                  <div className="relative bg-black">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-auto max-h-[50vh] object-contain mx-auto"
                      style={{ display: 'block' }}
                    />
                    {isStreaming && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-full text-xs animate-pulse">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        LIVE
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-3">
              <StreamControls
                isStreaming={isStreaming}
                selectedFile={selectedFile}
                peers={peers}
                onStartStreaming={async () => {
                  if (isSharingScreen) {
                    const confirmed = window.confirm('Stop screen sharing to start file streaming?');
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
        </div>
      </>
    );
  }

  return (
    <>
      {isMinimized && (
        <MiniPlayer
          onMaximize={handleMaximize}
          onStop={handleStop}
          onReturnToCamera={returnToCamera}
        />
      )}

      <div className={cn('fixed inset-0 bg-background/95 backdrop-blur-sm z-50 p-4', (isMinimized || !isOpen) && 'hidden')}>
        <Card className={cn('w-full h-full overflow-hidden flex flex-col')}>
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-bold">PonsCast</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)} className={showDebug ? 'bg-secondary' : ''} title="Toggle debug panel (D)">
                <Bug className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleMinimize} disabled={!isStreaming} title={isStreaming ? 'Minimize (M)' : 'Start streaming to minimize'}>
                <Minus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toggleFullscreen('fileStreaming', playerRef.current)} title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}>
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={returnToCamera} disabled={isReturningToCamera} title="Return to camera">
                <Camera className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} disabled={isStreaming} title={isStreaming ? 'Stop streaming first' : 'Close panel (ESC)'}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {isStreaming && (
            <Alert className="m-4 mb-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>File is currently being streamed. You can minimize this panel to continue working.</span>
                <Button variant="outline" size="sm" onClick={handleMinimize} className="ml-4">Minimize</Button>
              </AlertDescription>
            </Alert>
          )}

          {deviceInfo.includes('iOS') && (
            <Alert className="m-4 mb-0 bg-blue-50 dark:bg-blue-950 border-blue-200">
              <AlertDescription className="flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-medium">{deviceInfo}</span>
                <span className="text-xs text-muted-foreground">- Optimized for iOS Safari</span>
              </AlertDescription>
            </Alert>
          )}

          {showDebug && <DebugPanel debugInfo={debugInfo} />}

          <div className="flex-1 overflow-hidden p-4">
            <div className="grid grid-cols-12 gap-4 h-full">
              <div className="col-span-3 border rounded-lg flex flex-col min-w-[240px]">
                <div className="p-3 border-b flex items-center justify-between">
                  <div className="text-sm font-semibold">Playlist</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => { prevItem(); sendPlaylistOp('prev'); }} disabled={playlist.length === 0 || currentIndex <= 0}>
                      <SkipBack className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { nextItem(); sendPlaylistOp('next'); }} disabled={!hasNext}>
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1 max-h-[60vh] scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  {playlist.length === 0 && (
                    <div className="text-xs text-muted-foreground p-2">Add files to start</div>
                  )}
                  {playlist.map((p, i) => (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded border',
                        i === currentIndex ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                      )}
                    >
                      <button
                        onClick={() => { setCurrentIndex(i); setSelectedFile(p.file); setFileType(p.type); sendPlaylistOp('jump', i); }}
                        className="flex-1 text-left"
                      >
                        <div className="truncate text-sm">{p.name}</div>
                        {p.path && <div className="text-[10px] text-muted-foreground truncate">{p.path}</div>}
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromPlaylist(i);
                        }}
                        className="h-7 w-7 p-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t space-y-2">
                  <FileSelector
                    selectedFile={selectedFile}
                    isStreaming={isStreaming}
                    streamQuality={streamQuality}
                    onFileSelect={(file) => handleFileSelect(file, setSelectedFile, setFileType)}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    /* @ts-ignore */
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFolderSelect}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => folderInputRef.current?.click()}
                    className="w-full"
                  >
                    <Folder className="w-4 h-4 mr-2" />
                    Add Folder
                  </Button>
                </div>
              </div>

              <div className="col-span-9 border rounded-lg overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto p-3">
                  {fileType === 'video' && selectedFile && (
                    <>
                      <VideoJsPlayer
                        videoRef={videoRef}
                        playerRef={playerRef}
                        videoState={videoState}
                        onStateChange={updateDebugInfo}
                        onEnded={autoPlayNext}
                        isStreaming={isStreaming}
                        file={selectedFile}
                      />
                      <SubtitlePanelIntegrated videoRef={videoRef} isStreaming={isStreaming} />
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
                        className="w-full h-auto max-h-[70vh] object-contain mx-auto"
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
                </div>
                <div className="border-t">
                  <StreamControls
                    isStreaming={isStreaming}
                    selectedFile={selectedFile}
                    peers={peers}
                    onStartStreaming={async () => {
                      if (isSharingScreen) {
                        const confirmed = window.confirm('Stop screen sharing to start file streaming?');
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
            </div>
          </div>

          <div className="px-4 pb-2 text-xs text-muted-foreground">
            <span className="mr-4">ESC: Close</span>
            <span className="mr-4">M: Minimize</span>
            <span className="mr-4">D: Debug</span>
          </div>
        </Card>
      </div>
    </>
  );
};
