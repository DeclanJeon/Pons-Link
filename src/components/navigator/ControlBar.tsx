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
import { MobileCameraToggle } from '../media/MobileCameraToggle';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useRelayStore } from '@/stores/useRelayStore';

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
    cleanup: cleanupMediaDevice
  } = useMediaDeviceStore();

  const {
    activePanel,
    viewMode,
    unreadMessageCount,
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

  const {
    isTranscriptionEnabled,
    toggleTranscription
  } = useTranscriptionStore();

  const { cleanup: cleanupPeerConnection } = usePeerConnectionStore();
  const { clearSession } = useSessionStore();

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
    navigate('/');
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

  const iconSize = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  const buttonPadding = {
    sm: "p-2",
    md: "p-2.5",
    lg: "p-3",
  };

  const separatorMargin = {
    sm: isVertical ? "my-1" : "mx-1",
    md: isVertical ? "my-1.5" : "mx-1.5",
    lg: isVertical ? "my-2" : "mx-2",
  };

  if (!isMobile) {
    return (
      <div className={cn(
          "control-panel flex items-center gap-1.5 backdrop-blur-xl rounded-full shadow-lg border border-border/50",
          isVertical ? "flex-col p-1.5" : "flex-row p-1.5"
      )}>
        <div className={cn("flex items-center gap-1", isVertical ? "flex-col" : "flex-row")}>
          <Button variant={isAudioEnabled ? "ghost" : "destructive"} onClick={toggleAudio} className={cn("rounded-full", buttonPadding[controlBarSize])} title={isAudioEnabled ? "Mute" : "Unmute"}>
            {isAudioEnabled ? <Mic className={iconSize[controlBarSize]} /> : <MicOff className={iconSize[controlBarSize]} />}
          </Button>
          <Button variant={takeoverMode ? "destructive" : isVideoEnabled ? "ghost" : "destructive"} onClick={handleVideoButton} className={cn("rounded-full", buttonPadding[controlBarSize])} title={takeoverMode ? "Restore camera" : isVideoEnabled ? "Stop video" : "Start video"}>
            {takeoverMode ? <VideoOff className={iconSize[controlBarSize]} /> : isVideoEnabled ? <Video className={iconSize[controlBarSize]} /> : <VideoOff className={iconSize[controlBarSize]} />}
          </Button>
          <Button variant="destructive" onClick={handleLeave} className={cn("rounded-full", buttonPadding[controlBarSize])} title="Leave room">
            <PhoneOff className={iconSize[controlBarSize]} />
          </Button>
        </div>
       <div className={cn("bg-border/50", isVertical ? "w-full h-px" : "w-px h-6", separatorMargin[controlBarSize])} />
       <div className={cn("flex items-center gap-1", isVertical ? "flex-col" : "flex-row")}>
         <div className="relative">
           <Button variant={activePanel === "chat" ? "default" : "secondary"} onClick={() => setActivePanel("chat")} className={cn("rounded-full", buttonPadding[controlBarSize])} title="Chat">
             <MessageSquare className={iconSize[controlBarSize]} />
           </Button>
           {unreadMessageCount > 0 && (
             <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]" variant="destructive">
               {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
             </Badge>
           )}
         </div>
         {!isMobile && (
           <Button variant={isSharingScreen ? "default" : "secondary"} onClick={() => toggleScreenShare()} className={cn("rounded-full", buttonPadding[controlBarSize])} title={isSharingScreen ? "Stop sharing" : "Share screen"}>
             {isSharingScreen ? <ScreenShareOff className={cn(iconSize[controlBarSize], "text-destructive-foreground")} /> : <ScreenShare className={iconSize[controlBarSize]} />}
           </Button>
         )}
         <Button variant={isTranscriptionEnabled ? "default" : "secondary"} onClick={toggleTranscription} className={cn("rounded-full", buttonPadding[controlBarSize])} title={isTranscriptionEnabled ? "Disable subtitles" : "Enable subtitles"}>
           <Captions className={iconSize[controlBarSize]} />
         </Button>
         <Button variant={activePanel === "relay" ? "default" : "secondary"} onClick={() => setActivePanel("relay")} className={cn("rounded-full", buttonPadding[controlBarSize])} title="Media Relay">
           <Share2 className={iconSize[controlBarSize]} />
         </Button>
         <Button variant={activePanel === "cowatch" ? "default" : "secondary"} onClick={() => setActivePanel("cowatch")} className={cn("rounded-full", buttonPadding[controlBarSize])} title="CoWatch">
           <Clapperboard className={iconSize[controlBarSize]} />
         </Button>
       </div>
        <div className={cn("bg-border/50", isVertical ? "w-full h-px" : "w-px h-6", separatorMargin[controlBarSize])} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className={cn("rounded-full", buttonPadding[controlBarSize])} title="More options">
              <MoreVertical className={iconSize[controlBarSize]} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="mb-2 w-56">
             {!isMobile && <DropdownMenuItem onClick={() => setActivePanel("whiteboard")}><Palette className="w-4 h-4 mr-2" />Whiteboard</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => setActivePanel("fileStreaming")}><FileVideo className="w-4 h-4 mr-2" />PonsCast</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActivePanel("relay")}><Share2 className="w-4 h-4 mr-2" />Media Relay</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActivePanel("cowatch")}><Clapperboard className="w-4 h-4 mr-2" />CoWatch</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setViewMode(viewMode === 'speaker' ? 'grid' : viewMode === 'grid' ? 'viewer' : 'speaker')}><LayoutGrid className="w-4 h-4 mr-2" />{viewMode === 'speaker' ? 'Grid View' : viewMode === 'grid' ? 'Viewer Mode' : 'Speaker View'}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setActivePanel("settings")}><Settings className="w-4 h-4 mr-2" />Settings</DropdownMenuItem>
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
    sm: 'text-[9px]',
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
          "fixed bg-background/95 backdrop-blur-xl z-50 transition-transform duration-300 rounded-2xl shadow-lg",
          mobileDockPosition === 'bottom' && "left-4 right-4 bottom-4 border",
          mobileDockPosition === 'left' && "top-1/2 left-4 -translate-y-1/2 border",
          mobileDockPosition === 'right' && "top-1/2 right-4 -translate-y-1/2 border",
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
            variant={isAudioEnabled ? "ghost" : "destructive"} 
            size="sm" 
            onClick={toggleAudio} 
            className={cn("flex-1 w-full rounded-xl flex flex-col gap-1 p-1", dockSizeClasses[mobileDockSize])}
          >
            {isAudioEnabled ? <Mic className={iconSizeMap[mobileDockSize]} /> : <MicOff className={iconSizeMap[mobileDockSize]} />}
            <span className={textSizeMap[mobileDockSize]}>{isAudioEnabled ? "Mute" : "Unmute"}</span>
          </Button>
          
          <Button 
            variant={takeoverMode ? "destructive" : isVideoEnabled ? "ghost" : "destructive"} 
            size="sm" 
            onClick={handleVideoButton} 
            className={cn("flex-1 w-full rounded-xl flex flex-col gap-1 p-1", dockSizeClasses[mobileDockSize])}
          >
            {takeoverMode ? <VideoOff className={iconSizeMap[mobileDockSize]} /> : isVideoEnabled ? <Video className={iconSizeMap[mobileDockSize]} /> : <VideoOff className={iconSizeMap[mobileDockSize]} />}
            <span className={textSizeMap[mobileDockSize]}>{takeoverMode ? "Restore" : isVideoEnabled ? "Stop" : "Start"}</span>
          </Button>
          
          <MobileCameraToggle />
          
          <div className="relative flex-1 w-full">
            <Button 
              variant={activePanel === "chat" ? "default" : "ghost"} 
              size="sm" 
              onClick={() => setActivePanel("chat")} 
              className={cn("w-full rounded-xl flex flex-col gap-1 p-1", dockSizeClasses[mobileDockSize])}
            >
              <MessageSquare className={iconSizeMap[mobileDockSize]} />
              <span className={textSizeMap[mobileDockSize]}>Chat</span>
            </Button>
            {unreadMessageCount > 0 && (
              <Badge className="absolute top-0 right-0 h-4 w-4 p-0 flex items-center justify-center text-[10px]" variant="destructive">
                {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
              </Badge>
            )}
          </div>

          <Button
            variant={activePanel === "cowatch" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActivePanel("cowatch")}
            className={cn("flex-1 w-full rounded-xl flex flex-col gap-1 p-1", dockSizeClasses[mobileDockSize])}
          >
            <Clapperboard className={iconSizeMap[mobileDockSize]} />
            <span className={textSizeMap[mobileDockSize]}>CoWatch</span>
          </Button>
          
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("flex-1 w-full rounded-xl flex flex-col gap-1 p-1", dockSizeClasses[mobileDockSize])}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDrawerOpen(true);
                }}
              >
                <MoreVertical className={iconSizeMap[mobileDockSize]} />
                <span className={textSizeMap[mobileDockSize]}>More</span>
              </Button>
            </DrawerTrigger>
            <DrawerContent className="pb-safe">
              <DrawerHeader className="pb-2">
                <DrawerTitle>Options</DrawerTitle>
                <DrawerDescription>Choose an option to customize your experience</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-8 space-y-2">
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => { toggleTranscription(); setIsDrawerOpen(false); }}>
                  <Captions className="w-5 h-5 mr-3" />
                  <span>Subtitles {isTranscriptionEnabled && '(On)'}</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => { setActivePanel("fileStreaming"); setIsDrawerOpen(false); }}>
                  <FileVideo className="w-5 h-5 mr-3" />
                  <span>PonsCast</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => { setActivePanel("cowatch"); setIsDrawerOpen(false); }}>
                  <Clapperboard className="w-5 h-5 mr-3" />
                  <span>CoWatch</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => { setActivePanel("relay"); setIsDrawerOpen(false); }}>
                  <Share2 className="w-5 h-5 mr-3" />
                  <span>Media Relay</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => { setViewMode(viewMode === 'speaker' ? 'grid' : viewMode === 'grid' ? 'viewer' : 'speaker'); setIsDrawerOpen(false); }}>
                  <LayoutGrid className="w-5 h-5 mr-3" />
                  <span>{viewMode === 'speaker' ? 'Grid View' : viewMode === 'grid' ? 'Viewer Mode' : 'Speaker View'}</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => { setActivePanel("settings"); setIsDrawerOpen(false); }}>
                  <Settings className="w-5 h-5 mr-3" />
                  <span>Settings</span>
                </Button>
                <div className="h-px bg-border my-4" />
                <Button variant="destructive" className="w-full h-14" onClick={handleLeave}>
                  <PhoneOff className="w-5 h-5 mr-3" />
                  <span>Leave Room</span>
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={handleLeave}
            className={cn(
              "flex-1 w-full rounded-xl flex flex-col gap-1 p-1", 
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
            "fixed z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95",
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