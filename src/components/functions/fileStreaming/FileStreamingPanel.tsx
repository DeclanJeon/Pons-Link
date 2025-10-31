import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Maximize2, Minimize2, Camera, Bug, AlertCircle, Minus, SkipBack, SkipForward, List, Upload, Folder, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useDeviceType } from '@/hooks/useDeviceType';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
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
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  const [showDebug, setShowDebug] = useState(false);
  const [isReturningToCamera, setIsReturningToCamera] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  
  const { isMobile, isTablet, isDesktop } = useDeviceType();
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
            <div className={cn(
              "flex items-center justify-between border-b sticky top-0 bg-background/95 backdrop-blur z-10",
              isMobile ? "p-2" : "p-3"
            )}>
              <h2 className={cn("font-bold",
                isMobile ? "text-base" : "text-lg")}>PonsCast</h2>
              <div className={cn("flex items-center gap-1",
                isMobile && "gap-0.5")}>
                <Button
                  variant="ghost"
                  size={isMobile ? "sm" : "sm"}
                  onClick={() => setShowDebug(!showDebug)}
                  className={cn(showDebug ? 'bg-secondary' : '', isMobile && "h-7 w-7")}
                >
                  <Bug className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
                </Button>
                <Button
                  variant="ghost"
                  size={isMobile ? "sm" : "sm"}
                  onClick={handleMinimize}
                  disabled={!isStreaming}
                  className={cn(isMobile && "h-7 w-7")}
                >
                  <Minus className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
                </Button>
                <Button
                  variant="ghost"
                  size={isMobile ? "sm" : "sm"}
                  onClick={returnToCamera}
                  disabled={isReturningToCamera}
                  className={cn(isMobile && "h-7 w-7")}
                >
                  <Camera className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
                </Button>
                <Button
                  variant="ghost"
                  size={isMobile ? "sm" : "sm"}
                  onClick={onClose}
                  disabled={isStreaming}
                  className={cn(isMobile && "h-7 w-7")}
                >
                  <X className={cn(isMobile ? "w-3 h-3" : "w-4 h-4")} />
                </Button>
              </div>
            </div>

            {isStreaming && (
              <Alert className={cn(isMobile ? "m-2" : "m-3")}>
                <AlertCircle className={cn("w-4 h-4", isMobile && "w-3 h-3")} />
                <AlertDescription className={cn(isMobile ? "text-[10px]" : "text-xs")}>
                  File is being streamed. You can minimize this panel.
                </AlertDescription>
              </Alert>
            )}

            {showDebug && <DebugPanel debugInfo={debugInfo} />}

            <div className={cn("flex-1 overflow-y-auto space-y-3",
              isMobile ? "p-2 pb-16" : "p-3 pb-20")}>
              <div className="border rounded-lg bg-card">
                <div className={cn("p-2 border-b flex items-center justify-between",
                  isMobile && "p-1.5")}>
                  <div className={cn("font-semibold",
                    isMobile ? "text-xs" : "text-sm")}>Playlist</div>
                  <div className={cn("flex items-center gap-1",
                    isMobile && "gap-0.5")}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { prevItem(); sendPlaylistOp('prev'); }}
                      disabled={playlist.length === 0 || currentIndex <= 0}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                    >
                      <SkipBack className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { nextItem(); sendPlaylistOp('next'); }}
                      disabled={!hasNext}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                    >
                      <SkipForward className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    </Button>
                  </div>
                </div>
                <div className={cn("overflow-auto p-2 space-y-1",
                  isMobile ? "max-h-[35vh] p-1.5" : "max-h-[40vh] p-2")}>
                  {playlist.length === 0 && (
                    <div className={cn("text-muted-foreground p-2 text-center",
                      isMobile ? "text-[10px]" : "text-xs")}>Add files to start</div>
                  )}
                  {playlist.map((p, i) => (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-2 rounded border',
                        isMobile
                          ? 'px-1.5 py-1 text-[10px]'
                          : 'px-2 py-1.5 text-xs',
                        i === currentIndex ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                      )}
                    >
                      <button
                        onClick={() => { setCurrentIndex(i); setSelectedFile(p.file); setFileType(p.type); sendPlaylistOp('jump', i); }}
                        className="flex-1 text-left truncate"
                      >
                        <div className="truncate font-medium">{p.name}</div>
                        {p.path && <div className={cn("opacity-70 truncate",
                          isMobile ? "text-[8px]" : "text-[10px]")}>{p.path}</div>}
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromPlaylist(i);
                        }}
                        className={cn("p-0 shrink-0",
                          isMobile ? "h-5 w-5" : "h-6 w-6")}
                      >
                        <Trash2 className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className={cn("p-2 border-t space-y-2",
                  isMobile && "p-1.5 space-y-1.5")}>
                  <FileSelector
                    selectedFile={selectedFile}
                    isStreaming={isStreaming}
                    streamQuality={streamQuality}
                    onFileSelect={(file) => handleFileSelect(file, setSelectedFile, setFileType)}
                  />
                  <div className={cn("flex gap-2", isMobile && "gap-1")}>
                    <input
                      ref={folderInputRef}
                      type="file"
                      // @ts-expect-error - webkitdirectory is not a standard HTML attribute but supported by Chrome
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
                      className={cn("flex-1", isMobile && "text-[10px] h-7")}
                    >
                      <Folder className={cn("mr-1", isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                      {isMobile ? "Folder" : "Add Folder"}
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
                      className={cn("w-full h-auto object-contain mx-auto",
                        isMobile ? "max-h-[40vh]" : "max-h-[50vh]")}
                      style={{ display: 'block' }}
                    />
                    {isStreaming && (
                      <div className={cn(
                        "absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white rounded-full animate-pulse",
                        isMobile ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
                      )}>
                        <div className={cn("bg-white rounded-full animate-pulse",
                          isMobile ? "w-1 h-1" : "w-1.5 h-1.5")} />
                        LIVE
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className={cn(
              "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t",
              isMobile ? "p-2" : "p-3"
            )}>
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

      <div className={cn('fixed inset-0 bg-background/95 backdrop-blur-sm z-50',
        (isMinimized || !isOpen) && 'hidden',
        isTablet ? "p-3" : "p-4")}>
        <Card className={cn('w-full h-full overflow-hidden flex flex-col')}>
          <div className={cn("flex items-center justify-between border-b",
            isTablet ? "p-3" : "p-4")}>
            <h2 className={cn("font-bold",
              isTablet ? "text-lg" : "text-xl")}>PonsCast</h2>
            <div className={cn("flex items-center gap-2",
              isTablet && "gap-1")}>
              <Button
                variant="ghost"
                size={isTablet ? "sm" : "sm"}
                onClick={() => setShowDebug(!showDebug)}
                className={cn(showDebug ? 'bg-secondary' : '', isTablet && "h-7 w-7")}
                title="Toggle debug panel (D)"
              >
                <Bug className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
              </Button>
              <Button
                variant="ghost"
                size={isTablet ? "sm" : "sm"}
                onClick={handleMinimize}
                disabled={!isStreaming}
                className={cn(isTablet && "h-7 w-7")}
                title={isStreaming ? 'Minimize (M)' : 'Start streaming to minimize'}
              >
                <Minus className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
              </Button>
              <Button
                variant="ghost"
                size={isTablet ? "sm" : "sm"}
                onClick={() => toggleFullscreen('fileStreaming', playerRef.current)}
                className={cn(isTablet && "h-7 w-7")}
                title={isFullscreen ? 'Exit fullscreen (F)' : 'Enter fullscreen (F)'}
              >
                {isFullscreen ? (
                  <Minimize2 className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                ) : (
                  <Maximize2 className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                )}
              </Button>
              <Button
                variant="ghost"
                size={isTablet ? "sm" : "sm"}
                onClick={returnToCamera}
                disabled={isReturningToCamera}
                className={cn(isTablet && "h-7 w-7")}
                title="Return to camera"
              >
                <Camera className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
              </Button>
              <Button
                variant="ghost"
                size={isTablet ? "sm" : "sm"}
                onClick={onClose}
                disabled={isStreaming}
                className={cn(isTablet && "h-7 w-7")}
                title={isStreaming ? 'Stop streaming first' : 'Close panel (ESC)'}
              >
                <X className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
              </Button>
            </div>
          </div>

          {isStreaming && (
            <Alert className={cn(isTablet ? "m-3 mb-0" : "m-4 mb-0")}>
              <AlertCircle className={cn("w-4 h-4", isTablet && "w-3 h-3")} />
              <AlertDescription className={cn("flex items-center justify-between",
                isTablet && "text-xs")}>
                <span>File is currently being streamed. You can minimize this panel to continue working.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMinimize}
                  className={cn("ml-4", isTablet && "text-xs h-7")}
                >
                  Minimize
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {deviceInfo.includes('iOS') && (
            <Alert className={cn("m-4 mb-0 bg-blue-50 dark:bg-blue-950 border-blue-200",
              isTablet && "m-3 mb-0")}>
              <AlertDescription className={cn("flex items-center gap-2",
                isTablet && "text-xs")}>
                <span className="text-blue-600 dark:text-blue-400 font-medium">{deviceInfo}</span>
                <span className="text-muted-foreground">- Optimized for iOS Safari</span>
              </AlertDescription>
            </Alert>
          )}

          {showDebug && <DebugPanel debugInfo={debugInfo} />}

          <div className={cn("flex-1 overflow-hidden",
            isTablet ? "p-3" : "p-4")}>
            <div className={cn("grid gap-4 h-full",
              isTablet ? "grid-cols-1" : "grid-cols-12")}>
              <div className={cn(
                "border rounded-lg flex flex-col",
                isTablet
                  ? "min-w-[200px]"
                  : "col-span-3 min-w-[240px]"
              )}>
                <div className={cn("p-3 border-b flex items-center justify-between",
                  isTablet && "p-2")}>
                  <div className={cn("font-semibold",
                    isTablet ? "text-xs" : "text-sm")}>Playlist</div>
                  <div className={cn("flex items-center gap-2",
                    isTablet && "gap-1")}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { prevItem(); sendPlaylistOp('prev'); }}
                      disabled={playlist.length === 0 || currentIndex <= 0}
                      className={cn(isTablet && "h-6 w-6 p-0")}
                    >
                      <SkipBack className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { nextItem(); sendPlaylistOp('next'); }}
                      disabled={!hasNext}
                      className={cn(isTablet && "h-6 w-6 p-0")}
                    >
                      <SkipForward className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                    </Button>
                  </div>
                </div>
                <div className={cn(
                  "flex-1 overflow-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
                  isTablet ? "max-h-[30vh]" : "max-h-[60vh]"
                )}>
                  {playlist.length === 0 && (
                    <div className={cn("text-muted-foreground p-2",
                      isTablet ? "text-[10px]" : "text-xs")}>Add files to start</div>
                  )}
                  {playlist.map((p, i) => (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-2 rounded border',
                        isTablet
                          ? 'px-2 py-1.5 text-xs'
                          : 'px-3 py-2 text-sm',
                        i === currentIndex ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                      )}
                    >
                      <button
                        onClick={() => { setCurrentIndex(i); setSelectedFile(p.file); setFileType(p.type); sendPlaylistOp('jump', i); }}
                        className="flex-1 text-left"
                      >
                        <div className={cn("truncate",
                          isTablet ? "text-xs" : "text-sm")}>{p.name}</div>
                        {p.path && <div className="text-[10px] text-muted-foreground truncate">{p.path}</div>}
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromPlaylist(i);
                        }}
                        className={cn("p-0",
                          isTablet ? "h-6 w-6" : "h-7 w-7")}
                      >
                        <Trash2 className={cn(isTablet ? "w-3 h-3" : "w-3.5 h-3.5")} />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className={cn("p-2 border-t space-y-2",
                  isTablet && "p-1.5 space-y-1.5")}>
                  <FileSelector
                    selectedFile={selectedFile}
                    isStreaming={isStreaming}
                    streamQuality={streamQuality}
                    onFileSelect={(file) => handleFileSelect(file, setSelectedFile, setFileType)}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    // @ts-expect-error - webkitdirectory is not a standard HTML attribute but supported by Chrome
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
                    className={cn("w-full", isTablet && "text-xs h-8")}
                  >
                    <Folder className={cn("mr-2", isTablet ? "w-3 h-3" : "w-4 h-4")} />
                    {isTablet ? "Add Folder" : "Add Folder"}
                  </Button>
                </div>
              </div>

              <div className={cn(
                "border rounded-lg overflow-hidden flex flex-col",
                isTablet ? "col-span-1" : "col-span-9"
              )}>
                <div className={cn("flex-1 overflow-auto p-3",
                  isTablet && "p-2")}>
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
                        className={cn("w-full h-auto object-contain mx-auto",
                          isTablet ? "max-h-[50vh]" : "max-h-[70vh]")}
                        style={{ display: 'block' }}
                      />
                      {isStreaming && (
                        <div className={cn(
                          "absolute top-4 right-4 flex items-center gap-2 bg-red-600 text-white rounded-full animate-pulse",
                          isTablet ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
                        )}>
                          <div className={cn("bg-white rounded-full animate-pulse",
                            isTablet ? "w-1.5 h-1.5" : "w-2 h-2")} />
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

          <div className={cn("px-4 pb-2 text-muted-foreground",
            isTablet ? "text-[10px]" : "text-xs")}>
            <span className="mr-4">ESC: Close</span>
            <span className="mr-4">M: Minimize</span>
            <span className="mr-4">D: Debug</span>
          </div>
        </Card>
      </div>
    </>
  );
};
