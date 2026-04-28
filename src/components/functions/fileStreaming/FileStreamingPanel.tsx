import { useRef, useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Maximize2, Minimize2, Camera, Bug, AlertCircle, Minus, SkipBack, SkipForward, Folder, Trash2, Repeat, Shuffle, ListX, ArrowUp, ArrowDown, Download, Clock, Save, Upload } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useDeviceType } from '@/hooks/useDeviceType';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { ImageViewer } from './ImageViewer';
import { FileSelector } from './FileSelector';
import { DebugPanel } from './DebugPanel';
import { StreamControls } from './StreamControls';
import { MiniPlayer } from './MiniPlayer';
import { useFileStreaming } from '@/hooks/useFileStreaming';
import { cn } from '@/lib/utils';
import { getDeviceInfo } from '@/lib/device/deviceDetector';
import { useFullscreenStore } from '@/stores/useFullscreenStore';
import type Player from 'video.js/dist/types/player';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { detectPonsCastFileType } from '@/lib/fileStreaming/fileType';
import type { PlaylistSnapshot } from '@/stores/useFileStreamingStore';
import { loadPonsCastPlaylistCache, savePonsCastPlaylistCache } from '@/lib/ponscast/playlistPersistence';

const VideoJsPlayer = lazy(() =>
  import('./VideoJsPlayer').then((module) => ({ default: module.VideoJsPlayer }))
);
const PDFViewer = lazy(() =>
  import('./PDFViewer').then((module) => ({ default: module.PDFViewer }))
);

interface FileStreamingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FileStreamingPanel = ({ isOpen, onClose }: FileStreamingPanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const playlistImportRef = useRef<HTMLInputElement>(null);
  const playlistMatchRef = useRef<HTMLInputElement>(null);
  
  const [showDebug, setShowDebug] = useState(false);
  const [isReturningToCamera, setIsReturningToCamera] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<string>('');
  const [draggedPlaylistIndex, setDraggedPlaylistIndex] = useState<number | null>(null);
  const [pendingImportSnapshot, setPendingImportSnapshot] = useState<PlaylistSnapshot | null>(null);
  
  const { isMobile, isTablet } = useDeviceType();
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
    currentPage,
    totalPages,
    setCurrentPage,
    repeatMode,
    shuffleEnabled,
    imageAdvanceSeconds,
    pdfSlideshowSeconds,
    addFolderToPlaylist,
    getNextIndex,
    getPreviousIndex,
    setCurrentIndex,
    removeFromPlaylist,
    clearPlaylist,
    movePlaylistItem,
    setRepeatMode,
    toggleShuffle,
    setImageAdvanceSeconds,
    setPdfSlideshowSeconds,
    setPlaylistItemDuration,
    exportPlaylistSnapshot,
    importPlaylistSnapshot
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

  const hasNext = getNextIndex() >= 0;
  const hasPrevious = getPreviousIndex() >= 0;
  const playlistActionClass = "ponscast-toolbar-button h-8 w-8 rounded-xl p-0";
  const playlistActionActiveClass = "ponscast-toolbar-button ponscast-toolbar-button-active h-8 w-8 rounded-xl p-0";

  const playPlaylistIndex = useCallback(async (index: number, op: 'next' | 'prev' | 'jump', forceStart = false) => {
    const item = playlist[index];
    if (!item) return;

    const wasStreaming = isStreaming;
    if (wasStreaming) {
      await stopStreaming();
    }

    setCurrentIndex(index);
    setSelectedFile(item.file);
    setFileType(item.type);
    sendPlaylistOp(op, index);

    if (wasStreaming || forceStart) {
      setTimeout(() => {
        startStreaming(item.file);
      }, 0);
    }
  }, [playlist, isStreaming, stopStreaming, setCurrentIndex, setSelectedFile, setFileType, sendPlaylistOp, startStreaming]);

  const autoPlayNext = useCallback(async () => {
    const nextIndex = getNextIndex();
    if (nextIndex < 0) return;
    await playPlaylistIndex(nextIndex, 'next');
  }, [getNextIndex, playPlaylistIndex]);

  const handleNext = useCallback(async () => {
    const nextIndex = getNextIndex();
    if (nextIndex < 0) return;
    await playPlaylistIndex(nextIndex, 'next');
  }, [getNextIndex, playPlaylistIndex]);

  const handlePrevious = useCallback(async () => {
    const previousIndex = getPreviousIndex();
    if (previousIndex < 0) return;
    await playPlaylistIndex(previousIndex, 'prev');
  }, [getPreviousIndex, playPlaylistIndex]);

  const cycleRepeatMode = useCallback(() => {
    const nextMode = repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none';
    setRepeatMode(nextMode);
    toast.info(`Repeat ${nextMode}`);
  }, [repeatMode, setRepeatMode]);

  const handleFolderSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const supportedFiles = fileArray.filter(file => detectPonsCastFileType(file).supported);

    if (supportedFiles.length === 0) {
      toast.error('No supported files found in folder');
      return;
    }

    const folderPath = (files[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split('/')[0] || 'Folder';
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

  const formatDuration = useCallback((seconds?: number) => {
    if (!seconds || Number.isNaN(seconds) || !Number.isFinite(seconds)) return '--:--';
    const total = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handlePlaylistDrop = useCallback((targetIndex: number) => {
    if (draggedPlaylistIndex === null || draggedPlaylistIndex === targetIndex) {
      setDraggedPlaylistIndex(null);
      return;
    }
    movePlaylistItem(draggedPlaylistIndex, targetIndex);
    setDraggedPlaylistIndex(null);
  }, [draggedPlaylistIndex, movePlaylistItem]);

  const exportPlaylistMetadata = useCallback(() => {
    const snapshot = exportPlaylistSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ponscast-playlist-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success('Playlist metadata exported. Re-select local files to play it again.');
  }, [exportPlaylistSnapshot]);

  const savePlaylistCache = useCallback(async () => {
    try {
      await savePonsCastPlaylistCache(exportPlaylistSnapshot(), playlist.map(item => item.file));
      toast.success('Playlist files saved in this browser.');
    } catch (error) {
      toast.error(`Failed to save playlist: ${error}`);
    }
  }, [exportPlaylistSnapshot, playlist]);

  const loadPlaylistCache = useCallback(async () => {
    try {
      const record = await loadPonsCastPlaylistCache();
      if (!record) {
        toast.info('No saved PonsCast playlist in this browser.');
        return;
      }
      const result = importPlaylistSnapshot(record.snapshot, record.files);
      toast.success(`Loaded ${result.matched} saved files.`);
    } catch (error) {
      toast.error(`Failed to load playlist: ${error}`);
    }
  }, [importPlaylistSnapshot]);

  const handlePlaylistMetadataImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const snapshot = JSON.parse(await file.text()) as PlaylistSnapshot;
      setPendingImportSnapshot(snapshot);
      toast.info('Metadata loaded. Choose the matching local files/folder next.');
      playlistMatchRef.current?.click();
    } catch (error) {
      toast.error(`Failed to import playlist metadata: ${error}`);
    } finally {
      e.target.value = '';
    }
  }, []);

  const handlePlaylistFileMatch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!pendingImportSnapshot || files.length === 0) return;
    const result = importPlaylistSnapshot(pendingImportSnapshot, files);
    setPendingImportSnapshot(null);
    toast.success(`Matched ${result.matched} files. ${result.unmatched.length} missing.`);
    e.target.value = '';
  }, [pendingImportSnapshot, importPlaylistSnapshot]);

  useEffect(() => {
    if (fileType !== 'image' || imageAdvanceSeconds <= 0 || !selectedFile || !hasNext) return;
    const timer = window.setTimeout(() => {
      void autoPlayNext();
    }, imageAdvanceSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [fileType, imageAdvanceSeconds, selectedFile, hasNext, autoPlayNext]);

  useEffect(() => {
    if (fileType !== 'pdf' || pdfSlideshowSeconds <= 0 || !selectedFile || totalPages <= 0) return;
    const timer = window.setTimeout(() => {
      if (currentPage < totalPages) {
        setCurrentPage(currentPage + 1);
        return;
      }
      if (hasNext) void autoPlayNext();
    }, pdfSlideshowSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [fileType, pdfSlideshowSeconds, selectedFile, currentPage, totalPages, setCurrentPage, hasNext, autoPlayNext]);

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
          'room-noir-surface fixed inset-0 z-50 overflow-y-auto text-foreground',
          (isMinimized || !isOpen) && 'hidden'
        )}>
          <div className="flex flex-col h-full">
            <div className={cn(
              "room-panel-header flex items-center justify-between border-b sticky top-0 z-10",
              isMobile ? "p-2" : "p-3"
            )}>
              <div>
                <p className="room-panel-eyebrow">Live media surface</p>
                <h2 className={cn("room-panel-title font-bold",
                  isMobile ? "text-base" : "text-lg")}>PonsCast</h2>
              </div>
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
              <div className="room-section-card rounded-2xl overflow-hidden">
                <div className={cn("p-2 border-b flex items-center justify-between",
                  isMobile && "p-1.5")}>
                  <div>
                    <p className="room-panel-eyebrow">Playlist queue</p>
                    <div className={cn("font-semibold text-white/90",
                      isMobile ? "text-xs" : "text-sm")}>{playlist.length} item{playlist.length === 1 ? '' : 's'}</div>
                  </div>
                  <div className={cn("flex items-center gap-1",
                    isMobile && "gap-0.5")}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePrevious}
                      disabled={!hasPrevious}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                    >
                      <SkipBack className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleNext}
                      disabled={!hasNext}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                    >
                      <SkipForward className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    </Button>
                    <Button
                      size="sm"
                      variant={shuffleEnabled ? "default" : "outline"}
                      onClick={toggleShuffle}
                      disabled={playlist.length < 2}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                      title="Shuffle"
                    >
                      <Shuffle className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    </Button>
                    <Button
                      size="sm"
                      variant={repeatMode === 'none' ? "outline" : "default"}
                      onClick={cycleRepeatMode}
                      disabled={playlist.length === 0}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                      title={`Repeat: ${repeatMode}`}
                    >
                      <Repeat className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearPlaylist}
                      disabled={playlist.length === 0 || isStreaming}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                      title="Clear playlist"
                    >
                      <ListX className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportPlaylistMetadata}
                      disabled={playlist.length === 0}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                      title="Export playlist metadata"
                    >
                      <Download className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={savePlaylistCache}
                      disabled={playlist.length === 0}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                      title="Save files locally"
                    >
                      <Save className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadPlaylistCache}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                      title="Load saved files"
                    >
                      <Upload className={cn(isMobile ? "w-2.5 h-2.5" : "w-3 h-3")} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => playlistImportRef.current?.click()}
                      className={cn(isMobile && "h-6 w-6 p-0")}
                      title="Import metadata and match files"
                    >
                      JSON
                    </Button>
                  </div>
                </div>
                <div className={cn("overflow-auto p-2 space-y-1",
                  isMobile ? "max-h-[35vh] p-1.5" : "max-h-[40vh] p-2")}>
                  {playlist.length === 0 && (
                    <div className={cn("ponscast-empty-state rounded-xl p-3 text-center text-white/55",
                      isMobile ? "text-[10px]" : "text-xs")}>
                      <p className="font-semibold text-white/82">Select media to cue the room.</p>
                      <p className="mt-1 text-white/45">Tap the drop zone or add a folder.</p>
                    </div>
                  )}
                  {playlist.map((p, i) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDraggedPlaylistIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handlePlaylistDrop(i)}
                      onDragEnd={() => setDraggedPlaylistIndex(null)}
                      className={cn(
                        'ponscast-playlist-item flex items-center gap-2 rounded-xl',
                        isMobile
                          ? 'px-1.5 py-1 text-[10px]'
                          : 'px-2 py-1.5 text-xs',
                        i === currentIndex ? 'ponscast-playlist-item-active' : ''
                      )}
                    >
                      <button
                        onClick={() => playPlaylistIndex(i, 'jump')}
                        onDoubleClick={() => playPlaylistIndex(i, 'jump', true)}
                        className="flex-1 text-left truncate"
                      >
                        <div className="truncate font-medium">{p.name}</div>
                        <div className={cn("flex items-center gap-1 opacity-70 truncate", isMobile ? "text-[8px]" : "text-[10px]")}> 
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatDuration(p.duration)}</span>
                          {p.path && <span className="truncate">· {p.path}</span>}
                        </div>
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          movePlaylistItem(i, i - 1);
                        }}
                        disabled={i === 0}
                        className="p-0 shrink-0 h-6 w-6"
                        title="Move up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          movePlaylistItem(i, i + 1);
                        }}
                        disabled={i === playlist.length - 1}
                        className="p-0 shrink-0 h-6 w-6"
                        title="Move down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
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
                    <input
                      ref={playlistImportRef}
                      type="file"
                      accept="application/json,.json"
                      onChange={handlePlaylistMetadataImport}
                      className="hidden"
                    />
                    <input
                      ref={playlistMatchRef}
                      type="file"
                      multiple
                      // @ts-expect-error - webkitdirectory is not a standard HTML attribute but supported by Chrome
                      webkitdirectory=""
                      directory=""
                      onChange={handlePlaylistFileMatch}
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
                    <label className={cn("flex items-center gap-1 text-xs", isMobile && "text-[10px]")}> 
                      Image sec
                      <input
                        type="number"
                        min={0}
                        value={imageAdvanceSeconds}
                        onChange={(e) => setImageAdvanceSeconds(Number(e.target.value))}
                        className="w-14 rounded border bg-background px-1 py-0.5 text-xs"
                      />
                    </label>
                    <label className={cn("flex items-center gap-1 text-xs", isMobile && "text-[10px]")}> 
                      PDF sec
                      <input
                        type="number"
                        min={0}
                        value={pdfSlideshowSeconds}
                        onChange={(e) => setPdfSlideshowSeconds(Number(e.target.value))}
                        className="w-14 rounded border bg-background px-1 py-0.5 text-xs"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="ponscast-stage rounded-2xl overflow-hidden">
                {!selectedFile && (
                  <div className="flex min-h-[22vh] flex-col items-center justify-center p-5 text-center">
                    <Upload className="mb-2 h-6 w-6 text-indigo-200" />
                    <p className="text-sm font-semibold text-white/90">Select media to preview</p>
                    <p className="mt-1 text-xs text-white/45">Prepare a room-ready surface before going live.</p>
                  </div>
                )}
                <Suspense fallback={null}>
                  {fileType === 'video' && selectedFile && (
                    <VideoJsPlayer
                      videoRef={videoRef}
                      playerRef={playerRef}
                      videoState={videoState}
                      onStateChange={updateDebugInfo}
                      onEnded={autoPlayNext}
                      onDurationChange={(duration) => {
                        const item = playlist[currentIndex];
                        if (item) setPlaylistItemDuration(item.id, duration);
                      }}
                      isStreaming={isStreaming}
                      file={selectedFile}
                    />
                  )}
                  {fileType === 'pdf' && selectedFile && (
                    <PDFViewer
                      canvasRef={canvasRef}
                      file={selectedFile}
                      isStreaming={isStreaming}
                      onStreamUpdate={updateStream}
                    />
                  )}
                </Suspense>
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

      <div className={cn('room-noir-surface fixed inset-0 z-50 text-foreground',
        (isMinimized || !isOpen) && 'hidden',
        isTablet ? "p-3" : "p-4")}>
        <Card className={cn('room-noir-panel room-soft-edge w-full h-full overflow-hidden flex flex-col border')}>
          <div className={cn("room-panel-header flex items-center justify-between border-b",
            isTablet ? "p-3" : "p-4")}>
            <div>
              <p className="room-panel-eyebrow">Live media surface</p>
              <h2 className={cn("room-panel-title font-bold",
                isTablet ? "text-lg" : "text-xl")}>PonsCast</h2>
            </div>
            <div className={cn("flex items-center gap-2",
              isTablet && "gap-1")}>
              <Button
                variant="ghost"
                size={isTablet ? "sm" : "sm"}
                onClick={() => setShowDebug(!showDebug)}
                aria-label="Toggle PonsCast debug panel"
                className={cn("room-icon-button", showDebug ? 'bg-secondary' : '', isTablet && "h-7 w-7")}
                title="Toggle debug panel (D)"
              >
                <Bug className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
              </Button>
              <Button
                variant="ghost"
                size={isTablet ? "sm" : "sm"}
                onClick={handleMinimize}
                disabled={!isStreaming}
                aria-label="Minimize PonsCast"
                className={cn("room-icon-button", isTablet && "h-7 w-7")}
                title={isStreaming ? 'Minimize (M)' : 'Start streaming to minimize'}
              >
                <Minus className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
              </Button>
              <Button
                variant="ghost"
                size={isTablet ? "sm" : "sm"}
                onClick={() => toggleFullscreen('fileStreaming', playerRef.current)}
                aria-label={isFullscreen ? 'Exit PonsCast fullscreen' : 'Open PonsCast fullscreen'}
                className={cn("room-icon-button", isTablet && "h-7 w-7")}
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
                aria-label="Return PonsCast to camera"
                className={cn("room-icon-button", isTablet && "h-7 w-7")}
                title="Return to camera"
              >
                <Camera className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
              </Button>
              <Button
                variant="ghost"
                size={isTablet ? "sm" : "sm"}
                onClick={onClose}
                disabled={isStreaming}
                aria-label="Close PonsCast panel"
                className={cn("room-icon-button", isTablet && "h-7 w-7")}
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
                "room-section-card rounded-2xl flex flex-col overflow-hidden",
                isTablet
                  ? "min-w-[200px]"
                  : "col-span-4 min-w-[280px]"
              )}>
                <div className={cn("room-panel-header p-3 border-b flex items-start justify-between gap-3",
                  isTablet && "p-2")}>
                  <div>
                    <p className="room-panel-eyebrow">Playlist queue</p>
                    <div className={cn("font-semibold text-white/90",
                      isTablet ? "text-xs" : "text-sm")}>{playlist.length} item{playlist.length === 1 ? '' : 's'}</div>
                  </div>
                  {playlist.length > 0 ? (
                    <div className={cn("grid shrink-0 grid-cols-5 gap-1.5",
                      isTablet && "gap-1")}>
                      <Button size="sm" variant="ghost" onClick={handlePrevious} disabled={!hasPrevious} className={cn(playlistActionClass, isTablet && "h-6 w-6 p-0")} title="Previous item">
                        <SkipBack className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleNext} disabled={!hasNext} className={cn(playlistActionClass, isTablet && "h-6 w-6 p-0")} title="Next item">
                        <SkipForward className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={toggleShuffle} disabled={playlist.length < 2} className={cn(shuffleEnabled ? playlistActionActiveClass : playlistActionClass, isTablet && "h-6 w-6 p-0")} title="Shuffle playlist">
                        <Shuffle className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cycleRepeatMode} className={cn(repeatMode === 'none' ? playlistActionClass : playlistActionActiveClass, isTablet && "h-6 w-6 p-0")} title={`Repeat: ${repeatMode}`}>
                        <Repeat className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={clearPlaylist} disabled={isStreaming} className={cn(playlistActionClass, isTablet && "h-6 w-6 p-0")} title="Clear playlist">
                        <ListX className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={exportPlaylistMetadata} className={cn(playlistActionClass, isTablet && "h-6 w-6 p-0")} title="Export playlist metadata">
                        <Download className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={savePlaylistCache} className={cn(playlistActionClass, isTablet && "h-6 w-6 p-0")} title="Save files locally">
                        <Save className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={loadPlaylistCache} className={cn(playlistActionClass, isTablet && "h-6 w-6 p-0")} title="Load saved files">
                        <Upload className={cn(isTablet ? "w-3 h-3" : "w-4 h-4")} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => playlistImportRef.current?.click()} className={cn("ponscast-toolbar-button h-8 rounded-xl px-2 text-[10px] font-semibold", isTablet && "h-6 px-2")} title="Import metadata and match files">
                        JSON
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={loadPlaylistCache} className={cn("ponscast-toolbar-button h-8 rounded-xl px-2 text-[10px] font-semibold", isTablet && "h-6 px-2")} title="Load saved files">
                        Restore
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => playlistImportRef.current?.click()} className={cn("ponscast-toolbar-button h-8 rounded-xl px-2 text-[10px] font-semibold", isTablet && "h-6 px-2")} title="Import metadata and match files">
                        JSON
                      </Button>
                    </div>
                  )}
                </div>
                <div className={cn(
                  "flex-1 overflow-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
                  isTablet ? "max-h-[30vh]" : "max-h-[60vh]"
                )}>
                  {playlist.length === 0 && (
                    <div className={cn("ponscast-empty-state rounded-2xl p-4 text-center",
                      isTablet ? "text-[10px]" : "text-xs")}>
                      <p className="font-semibold text-white/82">Select media to cue the room.</p>
                      <p className="mt-1 text-white/45">Build a playlist, then double-click any item to start instantly.</p>
                    </div>
                  )}
                  {playlist.map((p, i) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDraggedPlaylistIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handlePlaylistDrop(i)}
                      onDragEnd={() => setDraggedPlaylistIndex(null)}
                      className={cn(
                        'ponscast-playlist-item flex items-center gap-2 rounded-xl',
                        isTablet
                          ? 'px-2 py-1.5 text-xs'
                          : 'px-3 py-2 text-sm',
                        i === currentIndex ? 'ponscast-playlist-item-active' : ''
                      )}
                    >
                      <button
                        onClick={() => playPlaylistIndex(i, 'jump')}
                        onDoubleClick={() => playPlaylistIndex(i, 'jump', true)}
                        className="flex-1 text-left"
                      >
                        <div className={cn("truncate",
                          isTablet ? "text-xs" : "text-sm")}>{p.name}</div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(p.duration)}</span>
                          {p.path && <span className="truncate">· {p.path}</span>}
                        </div>
                      </button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          movePlaylistItem(i, i - 1);
                        }}
                        disabled={i === 0}
                        className="p-0 shrink-0 h-6 w-6"
                        title="Move up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          movePlaylistItem(i, i + 1);
                        }}
                        disabled={i === playlist.length - 1}
                        className="p-0 shrink-0 h-6 w-6"
                        title="Move down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
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
                  <input
                    ref={playlistImportRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={handlePlaylistMetadataImport}
                    className="hidden"
                  />
                  <input
                    ref={playlistMatchRef}
                    type="file"
                    multiple
                    // @ts-expect-error - webkitdirectory is not a standard HTML attribute but supported by Chrome
                    webkitdirectory=""
                    directory=""
                    onChange={handlePlaylistFileMatch}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => folderInputRef.current?.click()}
                    className={cn("room-nav-button-muted w-full rounded-xl", isTablet && "text-xs h-8")}
                  >
                    <Folder className={cn("mr-2", isTablet ? "w-3 h-3" : "w-4 h-4")} />
                    {isTablet ? "Add Folder" : "Add Folder"}
                  </Button>
                  <label className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs text-white/52 ponscast-soft-card">
                    <span>Image auto-next seconds</span>
                    <input
                      type="number"
                      min={0}
                      value={imageAdvanceSeconds}
                      onChange={(e) => setImageAdvanceSeconds(Number(e.target.value))}
                      className="w-16 rounded-lg border-0 bg-black/25 px-2 py-1 text-xs text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset] outline-none focus:ring-2 focus:ring-indigo-300/20"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs text-white/52 ponscast-soft-card">
                    <span>PDF slideshow seconds</span>
                    <input
                      type="number"
                      min={0}
                      value={pdfSlideshowSeconds}
                      onChange={(e) => setPdfSlideshowSeconds(Number(e.target.value))}
                      className="w-16 rounded-lg border-0 bg-black/25 px-2 py-1 text-xs text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset] outline-none focus:ring-2 focus:ring-indigo-300/20"
                    />
                  </label>
                </div>
              </div>

              <div className={cn(
                "ponscast-stage rounded-2xl overflow-hidden flex flex-col",
                isTablet ? "col-span-1" : "col-span-8"
              )}>
                <div className={cn("flex-1 overflow-auto p-3",
                  isTablet && "p-2")}>
                  {!selectedFile && (
                    <div className="flex min-h-[42vh] flex-col items-center justify-center rounded-2xl bg-black/10 p-8 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-indigo-500/12 text-indigo-100 shadow-[0_0_0_1px_rgba(165,180,252,0.16)_inset]">
                        <Upload className="h-6 w-6" />
                      </div>
                      <p className="text-lg font-semibold text-white/90">No media selected</p>
                      <p className="mt-2 max-w-md text-sm leading-6 text-white/48">Pick a file on the left. Preview it here before you share it.</p>
                    </div>
                  )}
                  <Suspense fallback={null}>
                    {fileType === 'video' && selectedFile && (
                      <VideoJsPlayer
                        videoRef={videoRef}
                        playerRef={playerRef}
                        videoState={videoState}
                        onStateChange={updateDebugInfo}
                        onEnded={autoPlayNext}
                        onDurationChange={(duration) => {
                          const item = playlist[currentIndex];
                          if (item) setPlaylistItemDuration(item.id, duration);
                        }}
                        isStreaming={isStreaming}
                        file={selectedFile}
                      />
                    )}
                    {fileType === 'pdf' && selectedFile && (
                      <PDFViewer
                        canvasRef={canvasRef}
                        file={selectedFile}
                        isStreaming={isStreaming}
                        onStreamUpdate={updateStream}
                      />
                    )}
                  </Suspense>
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
                <div className="ponscast-stream-dock">
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
