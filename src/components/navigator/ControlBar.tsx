import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Mic, MicOff, Video, VideoOff, MessageSquare,
  MoreVertical, PhoneOff, Settings, ScreenShare, ScreenShareOff,
  Captions, FileVideo, Palette, LayoutGrid, ChevronUp, ChevronLeft, ChevronRight, Share2, Clapperboard
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useRoomUpgradeStore } from '@/stores/useRoomUpgradeStore';
import { isAudioRoom } from '@/types/roomCapabilities';
import { useChatStore } from '@/stores/useChatStore';
import { MobileCameraToggle } from '../media/MobileCameraToggle';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useRelayStore } from '@/stores/useRelayStore';
import {
  prepareClickCapCapture,
  subscribeToClickCapCaptureStream,
} from '@/features/clickcap/clickcapBridge';

export const ControlBar = ({ isVertical = false }: { isVertical?: boolean }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const autoHideTimerRef = useRef<NodeJS.Timeout>();
  const controlBarRef = useRef<HTMLDivElement>(null);

  const [isTouchProtected, setIsTouchProtected] = useState(false);
  const touchProtectionTimerRef = useRef<NodeJS.Timeout>();
  const lastDockToggleTimeRef = useRef<number>(0);

  const {
    isAudioEnabled,
    isVideoEnabled,
    isSharingScreen,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    startClickCapCapture: startPonsLinkClickCapCapture,
    stopClickCapCapture: stopPonsLinkClickCapCapture,
    cleanup: cleanupMediaDevice
  } = useMediaDeviceStore();

  const {
    activePanel,
    viewMode,
    setActivePanel,
    setViewMode,
    controlBarSize,
    isMobileDockVisible,
    mobileDockPosition,
    mobileDockSize,
    mobileDockAutoHideEnabled,
    setMobileDockVisible,
    toggleMobileDock,
    reset: resetUI
  } = useUIManagementStore();

  const unreadCount = useChatStore(state => state.unreadCount);

  const {
    isTranscriptionEnabled,
    transcriptionStatus,
    toggleTranscription
  } = useTranscriptionStore();

  const { cleanup: cleanupPeerConnection } = usePeerConnectionStore();
  const { clearSession, roomType, roomId } = useSessionStore();
  const pendingClickCapRequestIdRef = useRef<string | undefined>(undefined);
  const { requestUpgrade } = useRoomUpgradeStore();
  const cameraHidden = !!roomType && isAudioRoom(roomType);

  const captionStatusA11yLabel = (() => {
    if (!isTranscriptionEnabled || transcriptionStatus === 'off') return null;
    if (transcriptionStatus === 'live') return 'Live captions streaming';
    if (transcriptionStatus === 'fallback') return 'Live captions fallback streaming';
    if (transcriptionStatus === 'error') return 'Live captions need attention';
    return 'Live captions starting';
  })();

  const takeoverMode = useRelayStore(state => state.takeoverMode);
  const takeoverPeerId = useRelayStore(state => state.takeoverPeerId);
  const disableTakeover = useRelayStore(state => state.disableTakeover);
  const terminateRelay = useRelayStore(state => state.terminateRelay);

  const activateTouchProtection = useCallback(() => {
    setIsTouchProtected(true);
    lastDockToggleTimeRef.current = Date.now();
    if (touchProtectionTimerRef.current) {
      clearTimeout(touchProtectionTimerRef.current);
    }
    touchProtectionTimerRef.current = setTimeout(() => {
      setIsTouchProtected(false);
    }, 500);
  }, []);

  const handleDockToggle = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    toggleMobileDock();
    if (!isMobileDockVisible) {
      activateTouchProtection();
    }
  }, [toggleMobileDock, isMobileDockVisible, activateTouchProtection]);

  const startAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }
    
    autoHideTimerRef.current = setTimeout(() => {
      if (!isDrawerOpen) {
        setMobileDockVisible(false);
      }
    }, 3000);
  }, [isDrawerOpen, setMobileDockVisible]);

  useEffect(() => {
    if (!isMobile || !mobileDockAutoHideEnabled) {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (isDrawerOpen) return;
      
      const target = e.target as HTMLElement;
      
      if (controlBarRef.current && controlBarRef.current.contains(target)) {
        if (autoHideTimerRef.current) {
          clearTimeout(autoHideTimerRef.current);
        }
        setMobileDockVisible(true);
        startAutoHideTimer();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });

    if (isMobileDockVisible) {
      startAutoHideTimer();
    }

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [isMobile, mobileDockAutoHideEnabled, isDrawerOpen, isMobileDockVisible, setMobileDockVisible, startAutoHideTimer]);

  useEffect(() => {
    if (isDrawerOpen && autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }
  }, [isDrawerOpen]);

  useEffect(() => {
    return () => {
      if (touchProtectionTimerRef.current) {
        clearTimeout(touchProtectionTimerRef.current);
      }
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, []);

  const handleLeave = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    if (isTouchProtected) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const timeSinceToggle = Date.now() - lastDockToggleTimeRef.current;
    if (timeSinceToggle < 500) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    cleanupMediaDevice();
    cleanupPeerConnection();
    clearSession();
    resetUI();
    navigate('/legacy-home');
    toast.info('Call ended.');
  }, [
    isTouchProtected,
    navigate,
    cleanupMediaDevice,
    cleanupPeerConnection,
    clearSession,
    resetUI
  ]);

  const handleVideoButton = async () => {
    if (takeoverMode) {
      const ok = window.confirm('Return to your camera and end relay?');
      if (!ok) return;
      const pid = takeoverPeerId;
      await disableTakeover();
      if (pid) {
        terminateRelay(pid);
      }
      return;
    }
    toggleVideo();
  };

  const handleRequestVideoUpgrade = useCallback(() => {
    if (!roomType || !roomId) {
      toast.error('Current room information is not ready.');
      return;
    }

    requestUpgrade({
      roomId,
      roomTitle: roomId,
      roomType,
    });
  }, [requestUpgrade, roomId, roomType]);

  const registerClickCapHost = useCallback(async ({
    silent = false,
  }: {
    silent?: boolean;
  } = {}) => {
    try {
      const prepared = await prepareClickCapCapture({
        roomHint: roomId,
        timeoutMs: silent ? 700 : 3000,
      });
      if (prepared.success === false) {
        if (!silent) toast.error(prepared.error);
        return false;
      }

      pendingClickCapRequestIdRef.current = prepared.requestId;
      if (!silent) {
        toast.info('ClickCap is ready. Open ClickCap and click Share Screen after selecting area.');
      }
      return true;
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : 'ClickCap Capture could not start.');
      }
      return false;
    }
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const register = async () => {
      const registered = await registerClickCapHost({ silent: true });
      if (!cancelled && registered && intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    void register();
    intervalId = window.setInterval(() => {
      void register();
    }, 5000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [registerClickCapHost]);

  useEffect(() => {
    const unsubscribe = subscribeToClickCapCaptureStream({
      onStreamReady: ({ requestId, streamId, cropArea, view }) => {
        if (pendingClickCapRequestIdRef.current && requestId && pendingClickCapRequestIdRef.current !== requestId) {
          return;
        }
        if (!pendingClickCapRequestIdRef.current && requestId) {
          return;
        }
        pendingClickCapRequestIdRef.current = undefined;
        void startPonsLinkClickCapCapture({ streamId, cropArea, view }).finally(() => {
          void registerClickCapHost({ silent: true });
        });
      },
      onStreamStopped: ({ requestId }) => {
        if (pendingClickCapRequestIdRef.current && requestId && pendingClickCapRequestIdRef.current !== requestId) {
          return;
        }
        pendingClickCapRequestIdRef.current = undefined;
        void stopPonsLinkClickCapCapture().finally(() => {
          void registerClickCapHost({ silent: true });
        });
      },
    });

    return () => {
      unsubscribe();
    };
  }, [registerClickCapHost, startPonsLinkClickCapCapture, stopPonsLinkClickCapCapture]);

  const iconSize = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const buttonPadding = {
    sm: "min-h-11 min-w-11 p-2",
    md: "min-h-11 min-w-11 p-2.5",
    lg: "min-h-12 min-w-12 p-3",
  };

  const separatorMargin = {
    sm: isVertical ? "my-1" : "mx-1",
    md: isVertical ? "my-1.5" : "mx-1.5",
    lg: isVertical ? "my-2" : "mx-2",
  };

  const roomNavButtonClass = (isActive = false) => cn(
    "rounded-full room-icon-button",
    buttonPadding[controlBarSize],
    isActive ? "room-nav-button-active" : "room-nav-button-muted"
  );

  const captionIconClass = cn(
    iconSize[controlBarSize],
    transcriptionStatus === 'starting' && "text-cyan-200 drop-shadow-[0_0_10px_rgba(103,232,249,0.95)] animate-pulse",
    transcriptionStatus === 'live' && "text-emerald-300 drop-shadow-[0_0_10px_rgba(110,231,183,0.95)] animate-pulse",
    transcriptionStatus === 'fallback' && "text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.95)] animate-pulse",
    transcriptionStatus === 'error' && "text-rose-300 drop-shadow-[0_0_10px_rgba(253,164,175,0.95)]",
  );

  const captionButtonClass = cn(
    roomNavButtonClass(isTranscriptionEnabled),
    isTranscriptionEnabled && transcriptionStatus === 'starting' && "ring-1 ring-cyan-300/60 shadow-[0_0_20px_-6px_rgba(103,232,249,0.85)]",
    isTranscriptionEnabled && transcriptionStatus === 'live' && "ring-1 ring-emerald-300/60 shadow-[0_0_20px_-6px_rgba(110,231,183,0.85)]",
    isTranscriptionEnabled && transcriptionStatus === 'fallback' && "ring-1 ring-amber-300/60 shadow-[0_0_20px_-6px_rgba(252,211,77,0.85)]",
    isTranscriptionEnabled && transcriptionStatus === 'error' && "ring-1 ring-rose-300/70 shadow-[0_0_20px_-6px_rgba(253,164,175,0.85)]",
  );

  const roomMobileButtonClass = (isActive = false) => cn(
    "flex-1 w-full rounded-xl flex flex-col gap-1 p-1",
    dockSizeClasses[mobileDockSize],
    isActive ? "room-nav-button-active" : "room-nav-button-muted"
  );

  const roomMoreItemClass = "room-more-menu-item gap-2 px-2.5 py-2 text-sm";

  if (!isMobile) {
    return (
      <div className={cn(
          "control-panel flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#111116]/88 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.95)] backdrop-blur-2xl",
          isVertical ? "flex-col p-1.5" : "flex-row p-1.5"
      )}>
        <div className={cn("flex items-center gap-1", isVertical ? "flex-col" : "flex-row")}>
          <Button variant="ghost" onClick={toggleAudio} className={isAudioEnabled ? roomNavButtonClass(false) : cn("rounded-full room-icon-button room-nav-button-danger", buttonPadding[controlBarSize])} title={isAudioEnabled ? "Mute" : "Unmute"} aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"} aria-pressed={!isAudioEnabled}>
            {isAudioEnabled ? <Mic className={iconSize[controlBarSize]} /> : <MicOff className={iconSize[controlBarSize]} />}
          </Button>
          {!cameraHidden && (
            <Button variant="ghost" onClick={handleVideoButton} className={takeoverMode || !isVideoEnabled ? cn("rounded-full room-icon-button room-nav-button-danger", buttonPadding[controlBarSize]) : roomNavButtonClass(false)} title={takeoverMode ? "Restore camera" : isVideoEnabled ? "Stop video" : "Start video"} aria-label={takeoverMode ? "Restore camera" : isVideoEnabled ? "Stop video" : "Start video"} aria-pressed={isVideoEnabled && !takeoverMode}>
              {takeoverMode ? <VideoOff className={iconSize[controlBarSize]} /> : isVideoEnabled ? <Video className={iconSize[controlBarSize]} /> : <VideoOff className={iconSize[controlBarSize]} />}
            </Button>
          )}
          <Button variant="ghost" onClick={handleLeave} className={cn("rounded-full room-icon-button room-nav-button-danger", buttonPadding[controlBarSize])} title="Leave room" aria-label="Leave room">
            <PhoneOff className={iconSize[controlBarSize]} />
          </Button>
        </div>
       <div className={cn("bg-white/[0.08]", isVertical ? "w-full h-px" : "w-px h-6", separatorMargin[controlBarSize])} />
       <div className={cn("flex items-center gap-1", isVertical ? "flex-col" : "flex-row")}>
         <div className="relative">
           <Button variant="ghost" onClick={() => setActivePanel("chat")} className={roomNavButtonClass(activePanel === "chat")} title="Chat" aria-label={unreadCount > 0 ? `Open chat, ${unreadCount} unread messages` : "Open chat"} aria-pressed={activePanel === "chat"}>
             <MessageSquare className={iconSize[controlBarSize]} />
           </Button>
           {unreadCount > 0 && (
             <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]" variant="destructive">
               {unreadCount > 9 ? '9+' : unreadCount}
             </Badge>
           )}
         </div>
         {!isMobile && (
           <Button variant="ghost" onClick={() => toggleScreenShare()} className={roomNavButtonClass(isSharingScreen)} title={isSharingScreen ? "Stop sharing" : "Share screen"} aria-label={isSharingScreen ? "Stop screen sharing" : "Share screen"} aria-pressed={isSharingScreen}>
             {isSharingScreen ? <ScreenShareOff className={cn(iconSize[controlBarSize], "text-destructive-foreground")} /> : <ScreenShare className={iconSize[controlBarSize]} />}
           </Button>
         )}
         <Button
           variant="ghost"
           onClick={toggleTranscription}
           className={captionButtonClass}
           title={isTranscriptionEnabled ? "Disable live captions" : "Enable live captions"}
           aria-label={isTranscriptionEnabled ? "Disable live captions" : "Enable live captions"}
           aria-pressed={isTranscriptionEnabled}
         >
           <Captions className={captionIconClass} />
           {captionStatusA11yLabel && (
             <span role="status" aria-live="polite" aria-label={captionStatusA11yLabel} className="sr-only" />
           )}
         </Button>
         <Button variant="ghost" onClick={() => setActivePanel("relay")} className={roomNavButtonClass(activePanel === "relay")} title="Media Relay" aria-label="Open media relay panel" aria-pressed={activePanel === "relay"}>
           <Share2 className={iconSize[controlBarSize]} />
         </Button>
         <Button variant="ghost" onClick={() => setActivePanel("cowatch")} className={roomNavButtonClass(activePanel === "cowatch")} title="CoWatch" aria-label="Open CoWatch panel" aria-pressed={activePanel === "cowatch"}>
           <Clapperboard className={iconSize[controlBarSize]} />
         </Button>
       </div>
        <div className={cn("bg-white/[0.08]", isVertical ? "w-full h-px" : "w-px h-6", separatorMargin[controlBarSize])} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={roomNavButtonClass(false)} title="More options" aria-label="Open more room controls">
              <MoreVertical className={iconSize[controlBarSize]} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="room-more-menu mb-2 w-60 p-1.5">
             {!isMobile && <DropdownMenuItem className={roomMoreItemClass} onClick={() => setActivePanel("whiteboard")}><Palette className="w-4 h-4 mr-2" />Whiteboard</DropdownMenuItem>}
            <DropdownMenuItem className={roomMoreItemClass} onClick={() => setActivePanel("fileStreaming")}><FileVideo className="w-4 h-4 mr-2" />PonsCast</DropdownMenuItem>
            <DropdownMenuItem className={roomMoreItemClass} onClick={() => setActivePanel("relay")}><Share2 className="w-4 h-4 mr-2" />Media Relay</DropdownMenuItem>
            <DropdownMenuItem className={roomMoreItemClass} onClick={() => setActivePanel("cowatch")}><Clapperboard className="w-4 h-4 mr-2" />CoWatch</DropdownMenuItem>
            <DropdownMenuSeparator className="room-more-menu-separator" />
            <DropdownMenuItem className={roomMoreItemClass} onClick={() => setViewMode(viewMode === 'speaker' ? 'grid' : viewMode === 'grid' ? 'viewer' : 'speaker')}><LayoutGrid className="w-4 h-4 mr-2" />{viewMode === 'speaker' ? 'Grid View' : viewMode === 'grid' ? 'Viewer Mode' : 'Speaker View'}</DropdownMenuItem>
            <DropdownMenuSeparator className="room-more-menu-separator" />
            {cameraHidden && (
              <DropdownMenuItem className={roomMoreItemClass} onClick={handleRequestVideoUpgrade}><Video className="w-4 h-4 mr-2" />Request Video Upgrade</DropdownMenuItem>
            )}
            <DropdownMenuItem className={roomMoreItemClass} onClick={() => setActivePanel("settings")}><Settings className="w-4 h-4 mr-2" />Settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  const isVerticalDock = mobileDockPosition === 'left' || mobileDockPosition === 'right';

  const dockSizeClasses = {
    sm: isVerticalDock ? 'w-14' : 'h-14',
    md: isVerticalDock ? 'w-16' : 'h-16',
    lg: isVerticalDock ? 'w-20' : 'h-20',
  };

  const iconSizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const textSizeMap = {
    sm: 'text-[10px]',
    md: 'text-[10px]',
    lg: 'text-[11px]',
  };

  const getFABIcon = () => {
    switch (mobileDockPosition) {
      case 'left': return <ChevronRight className="w-6 h-6" />;
      case 'right': return <ChevronLeft className="w-6 h-6" />;
      case 'bottom': default: return <ChevronUp className="w-6 h-6" />;
    }
  };

  const getFABPosition = () => {
    switch (mobileDockPosition) {
      case 'left': return 'left-4 top-1/2 -translate-y-1/2';
      case 'right': return 'right-4 top-1/2 -translate-y-1/2';
      case 'bottom': default: return 'right-4 bottom-5';
    }
  };

  return (
    <>
      <div 
        ref={controlBarRef}
        className={cn(
          "fixed z-50 rounded-2xl border border-white/[0.08] bg-[#111116]/92 shadow-[0_20px_70px_-45px_rgba(0,0,0,0.95)] backdrop-blur-2xl transition-transform duration-300",
          mobileDockPosition === 'bottom' && "left-4 right-4 bottom-4",
          mobileDockPosition === 'left' && "top-1/2 left-4 -translate-y-1/2",
          mobileDockPosition === 'right' && "top-1/2 right-4 -translate-y-1/2",
          !isMobileDockVisible && (
            mobileDockPosition === 'bottom' ? 'translate-y-[calc(100%+2rem)]' :
            mobileDockPosition === 'left' ? '-translate-x-[calc(100%+2rem)]' :
            'translate-x-[calc(100%+2rem)]'
          ),
          isTouchProtected && "pointer-events-none opacity-90"
        )}
      >
        <div className={cn(
          "flex items-center justify-around p-1",
          isVerticalDock ? "flex-col h-auto gap-2" : "flex-row",
          dockSizeClasses[mobileDockSize]
        )}>
          <Button 
            variant="ghost"
            size="sm" 
            onClick={toggleAudio} 
            aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
            aria-pressed={!isAudioEnabled}
            className={isAudioEnabled ? roomMobileButtonClass(false) : cn("flex-1 w-full rounded-xl flex flex-col gap-1 p-1 room-nav-button-danger", dockSizeClasses[mobileDockSize])}
          >
            {isAudioEnabled ? <Mic className={iconSizeMap[mobileDockSize]} /> : <MicOff className={iconSizeMap[mobileDockSize]} />}
            <span className={textSizeMap[mobileDockSize]}>{isAudioEnabled ? "Mute" : "Unmute"}</span>
          </Button>
          
          {!cameraHidden && (
            <Button 
              variant="ghost"
              size="sm" 
              onClick={handleVideoButton} 
              aria-label={takeoverMode ? "Restore camera" : isVideoEnabled ? "Stop video" : "Start video"}
              aria-pressed={isVideoEnabled && !takeoverMode}
              className={takeoverMode || !isVideoEnabled ? cn("flex-1 w-full rounded-xl flex flex-col gap-1 p-1 room-nav-button-danger", dockSizeClasses[mobileDockSize]) : roomMobileButtonClass(false)}
            >
              {takeoverMode ? <VideoOff className={iconSizeMap[mobileDockSize]} /> : isVideoEnabled ? <Video className={iconSizeMap[mobileDockSize]} /> : <VideoOff className={iconSizeMap[mobileDockSize]} />}
              <span className={textSizeMap[mobileDockSize]}>{takeoverMode ? "Restore" : isVideoEnabled ? "Stop" : "Start"}</span>
            </Button>
          )}
          
          {!cameraHidden && <MobileCameraToggle />}
          
          <div className="relative flex-1 w-full">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActivePanel("chat")}
              aria-label={unreadCount > 0 ? `Open chat, ${unreadCount} unread messages` : "Open chat"}
              aria-pressed={activePanel === "chat"}
              className={cn("w-full", roomMobileButtonClass(activePanel === "chat"))}
            >
              <MessageSquare className={iconSizeMap[mobileDockSize]} />
              <span className={textSizeMap[mobileDockSize]}>Chat</span>
            </Button>
            {unreadCount > 0 && (
              <Badge className="absolute top-0 right-0 h-4 w-4 p-0 flex items-center justify-center text-[10px]" variant="destructive">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActivePanel("cowatch")}
            aria-label="Open CoWatch panel"
            aria-pressed={activePanel === "cowatch"}
            className={roomMobileButtonClass(activePanel === "cowatch")}
          >
            <Clapperboard className={iconSizeMap[mobileDockSize]} />
            <span className={textSizeMap[mobileDockSize]}>CoWatch</span>
          </Button>
          
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Open more room controls"
                className={roomMobileButtonClass(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDrawerOpen(true);
                }}
              >
                <MoreVertical className={iconSizeMap[mobileDockSize]} />
                <span className={textSizeMap[mobileDockSize]}>More</span>
              </Button>
            </DrawerTrigger>
            <DrawerContent className="room-noir-panel room-soft-edge max-h-[85dvh] overflow-y-auto pb-safe border-t-0 text-foreground">
              <DrawerHeader className="pb-2">
                <DrawerTitle>Options</DrawerTitle>
                <DrawerDescription>Choose an option to customize your experience</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-8 space-y-2">
                <Button
                  variant="ghost"
                  className={cn("w-full justify-start h-14 text-left", isTranscriptionEnabled ? "room-nav-button-active" : "room-more-menu-item")}
                  onClick={() => { toggleTranscription(); setIsDrawerOpen(false); }}
                >
                  <Captions className="w-5 h-5 mr-3" />
                  <span className="flex items-center gap-2 leading-tight">
                    <span>Live Captions {isTranscriptionEnabled && '(On)'}</span>
                    {captionStatusA11yLabel && <span aria-label={captionStatusA11yLabel} className={cn("h-2 w-2 rounded-full", transcriptionStatus === 'live' ? "bg-emerald-300 animate-pulse" : transcriptionStatus === 'fallback' ? "bg-amber-300 animate-pulse" : transcriptionStatus === 'error' ? "bg-rose-300" : "bg-cyan-300 animate-pulse")} />}
                  </span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left room-more-menu-item" onClick={() => { setActivePanel("fileStreaming"); setIsDrawerOpen(false); }}>
                  <FileVideo className="w-5 h-5 mr-3" />
                  <span>PonsCast</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left room-more-menu-item" onClick={() => { setActivePanel("whiteboard"); setIsDrawerOpen(false); }}>
                  <Palette className="w-5 h-5 mr-3" />
                  <span>Whiteboard</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left room-more-menu-item" onClick={() => { setActivePanel("cowatch"); setIsDrawerOpen(false); }}>
                  <Clapperboard className="w-5 h-5 mr-3" />
                  <span>CoWatch</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left room-more-menu-item" onClick={() => { setActivePanel("relay"); setIsDrawerOpen(false); }}>
                  <Share2 className="w-5 h-5 mr-3" />
                  <span>Media Relay</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left room-more-menu-item" onClick={() => { setViewMode(viewMode === 'speaker' ? 'grid' : viewMode === 'grid' ? 'viewer' : 'speaker'); setIsDrawerOpen(false); }}>
                  <LayoutGrid className="w-5 h-5 mr-3" />
                  <span>{viewMode === 'speaker' ? 'Grid View' : viewMode === 'grid' ? 'Viewer Mode' : 'Speaker View'}</span>
                </Button>
                {cameraHidden && (
                  <Button variant="ghost" className="w-full justify-start h-14 text-left room-more-menu-item" onClick={() => { handleRequestVideoUpgrade(); setIsDrawerOpen(false); }}>
                    <Video className="w-5 h-5 mr-3" />
                    <span>Request Video Upgrade</span>
                  </Button>
                )}
                <Button variant="ghost" className="w-full justify-start h-14 text-left room-more-menu-item" onClick={() => { setActivePanel("settings"); setIsDrawerOpen(false); }}>
                  <Settings className="w-5 h-5 mr-3" />
                  <span>Settings</span>
                </Button>
                <div className="room-more-menu-separator" />
                <Button variant="ghost" className="w-full h-14 room-nav-button-danger" onClick={handleLeave} aria-label="Leave room">
                  <PhoneOff className="w-5 h-5 mr-3" />
                  <span>Leave Room</span>
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLeave}
            className={cn(
              "flex-1 w-full rounded-xl flex flex-col gap-1 p-1 room-nav-button-danger",
              dockSizeClasses[mobileDockSize],
              isTouchProtected && "opacity-50 cursor-not-allowed"
            )}
            disabled={isDrawerOpen || isTouchProtected}
            aria-label={isTouchProtected ? "Leave button temporarily disabled" : "Leave room"}
          >
            <PhoneOff className={iconSizeMap[mobileDockSize]} />
            <span className={textSizeMap[mobileDockSize]}>Leave</span>
          </Button>
        </div>
      </div>

      {!isMobileDockVisible && (
        <button
          onClick={handleDockToggle}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDockToggle(e);
          }}
          className={cn(
            "fixed z-40 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500 text-white shadow-[0_18px_45px_-25px_rgba(99,102,241,0.9)] transition-all duration-300 hover:scale-110 hover:bg-indigo-400 active:scale-95",
            getFABPosition(),
            "touch-manipulation select-none"
          )}
          style={{
            padding: '12px',
            transform: 'translateZ(0)',
            willChange: 'transform'
          }}
          aria-label="Show controls"
        >
          {getFABIcon()}
        </button>
      )}

      {mobileDockPosition === 'bottom' && (
        <div className={cn(dockSizeClasses[mobileDockSize], "safe-area-bottom")} />
      )}
    </>
  );
};
