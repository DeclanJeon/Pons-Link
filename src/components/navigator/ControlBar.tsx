/**
 * @fileoverview ControlBar 컴포넌트 (개선판)
 * @module components/navigator/ControlBar
 */

import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Mic, MicOff, Video, VideoOff, MessageSquare,
  MoreVertical, PhoneOff, Settings, ScreenShare, ScreenShareOff,
  Captions, FileVideo, Palette, LayoutGrid, ChevronUp, ChevronLeft, ChevronRight, X
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
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useUIManagementStore, ActivePanel } from '@/stores/useUIManagementStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { MobileCameraToggle } from '../media/MobileCameraToggle';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export const ControlBar = ({ isVertical = false }: { isVertical?: boolean }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const autoHideTimerRef = useRef<NodeJS.Timeout>();

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

  // 모바일 dock 자동 숨김
  useEffect(() => {
    if (!isMobile || !mobileDockAutoHideEnabled) return;

    const resetAutoHideTimer = () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
      setMobileDockVisible(true);
      autoHideTimerRef.current = setTimeout(() => {
        setMobileDockVisible(false);
      }, 3000); // 3초 후 숨김
    };

    const events = ['touchstart', 'touchmove', 'click'];
    events.forEach(event => {
      window.addEventListener(event, resetAutoHideTimer, { passive: true });
    });

    resetAutoHideTimer();

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, resetAutoHideTimer);
      });
    };
  }, [isMobile, mobileDockAutoHideEnabled, setMobileDockVisible]);

  /**
   * 통화 종료 핸들러 (개선판)
   */
  const handleLeave = useCallback(async () => {
    console.log('[ControlBar] Leave button clicked');
    
    // 1. 미디어 스트림 정리
    cleanupMediaDevice();
    
    // 2. 피어 연결 정리
    cleanupPeerConnection();
    
    // 3. 세션 정리
    clearSession();
    
    // 4. UI 상태 초기화
    resetUI();
    
    // 5. 네비게이션
    navigate('/');
    
    toast.info('통화가 종료되었습니다.');
  }, [navigate, cleanupMediaDevice, cleanupPeerConnection, clearSession, resetUI]);

  const handleMobilePanelOpen = (panel: ActivePanel) => {
    setActivePanel(panel);
    setIsDrawerOpen(false);
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

  // 데스크톱 컨트롤 바 (기존 코드)
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
          <Button variant={isVideoEnabled ? "ghost" : "destructive"} onClick={toggleVideo} className={cn("rounded-full", buttonPadding[controlBarSize])} title={isVideoEnabled ? "Stop video" : "Start video"}>
            {isVideoEnabled ? <Video className={iconSize[controlBarSize]} /> : <VideoOff className={iconSize[controlBarSize]} />}
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
          <Button variant={isSharingScreen ? "default" : "secondary"} onClick={() => toggleScreenShare()} className={cn("rounded-full", buttonPadding[controlBarSize])} title={isSharingScreen ? "Stop sharing" : "Share screen"}>
            {isSharingScreen ? <ScreenShareOff className={cn(iconSize[controlBarSize], "text-destructive-foreground")} /> : <ScreenShare className={iconSize[controlBarSize]} />}
          </Button>
          <Button variant={isTranscriptionEnabled ? "default" : "secondary"} onClick={toggleTranscription} className={cn("rounded-full", buttonPadding[controlBarSize])} title={isTranscriptionEnabled ? "Disable subtitles" : "Enable subtitles"}>
            <Captions className={iconSize[controlBarSize]} />
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
             <DropdownMenuItem onClick={() => setActivePanel("whiteboard")}><Palette className="w-4 h-4 mr-2" />Whiteboard</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActivePanel("fileStreaming")}><FileVideo className="w-4 h-4 mr-2" />Stream File</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setViewMode(viewMode === 'speaker' ? 'grid' : viewMode === 'grid' ? 'viewer' : 'speaker')}><LayoutGrid className="w-4 h-4 mr-2" />{viewMode === 'speaker' ? 'Grid View' : viewMode === 'grid' ? 'Viewer Mode' : 'Speaker View'}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setActivePanel("settings")}><Settings className="w-4 h-4 mr-2" />Settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // 모바일 컨트롤 바
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

  // FAB(Floating Action Button) 아이콘 결정
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
        className={cn(
          "fixed bg-background/95 backdrop-blur-xl z-50 transition-transform duration-300 rounded-2xl shadow-lg",
          // 위치
          mobileDockPosition === 'bottom' && "left-4 right-4 bottom-4 border",
          mobileDockPosition === 'left' && "top-1/2 left-4 -translate-y-1/2 border",
          mobileDockPosition === 'right' && "top-1/2 right-4 -translate-y-1/2 border",
          // 가시성
          !isMobileDockVisible && (
            mobileDockPosition === 'bottom' ? 'translate-y-[calc(100%+2rem)]' :
            mobileDockPosition === 'left' ? '-translate-x-[calc(100%+2rem)]' :
            'translate-x-[calc(100%+2rem)]'
          )
        )}
      >
        <div className={cn(
          "flex items-center justify-around p-1",
          isVerticalDock ? "flex-col h-auto gap-2" : "flex-row",
          dockSizeClasses[mobileDockSize]
        )}>
          <Button variant={isAudioEnabled ? "ghost" : "destructive"} size="sm" onClick={toggleAudio} className={cn("flex-1 w-full rounded-xl flex flex-col gap-1 p-1", dockSizeClasses[mobileDockSize])}>
            {isAudioEnabled ? <Mic className={iconSizeMap[mobileDockSize]} /> : <MicOff className={iconSizeMap[mobileDockSize]} />}
            <span className={textSizeMap[mobileDockSize]}>{isAudioEnabled ? "Mute" : "Unmute"}</span>
          </Button>
          
          <Button variant={isVideoEnabled ? "ghost" : "destructive"} size="sm" onClick={toggleVideo} className={cn("flex-1 w-full rounded-xl flex flex-col gap-1 p-1", dockSizeClasses[mobileDockSize])}>
            {isVideoEnabled ? <Video className={iconSizeMap[mobileDockSize]} /> : <VideoOff className={iconSizeMap[mobileDockSize]} />}
            <span className={textSizeMap[mobileDockSize]}>{isVideoEnabled ? "Stop" : "Start"}</span>
          </Button>
          
          <MobileCameraToggle />
          
          <div className="relative flex-1 w-full">
            <Button variant={activePanel === "chat" ? "default" : "ghost"} size="sm" onClick={() => setActivePanel("chat")} className={cn("w-full rounded-xl flex flex-col gap-1 p-1", dockSizeClasses[mobileDockSize])}>
              <MessageSquare className={iconSizeMap[mobileDockSize]} />
              <span className={textSizeMap[mobileDockSize]}>Chat</span>
            </Button>
            {unreadMessageCount > 0 && (
              <Badge className="absolute top-0 right-0 h-4 w-4 p-0 flex items-center justify-center text-[10px]" variant="destructive">
                {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
              </Badge>
            )}
          </div>
          
          <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("flex-1 w-full rounded-xl flex flex-col gap-1 p-1", dockSizeClasses[mobileDockSize])}
                onClick={(e) => {
                  // 드로어가 열릴 때 통화 종료 버튼이 눌리지 않도록 이벤트 전파 방지
                  e.stopPropagation();
                  setIsDrawerOpen(true);
                }}
              >
                <MoreVertical className={iconSizeMap[mobileDockSize]} />
                <span className={textSizeMap[mobileDockSize]}>More</span>
              </Button>
            </DrawerTrigger>
            <DrawerContent className="pb-safe">
              <DrawerHeader className="pb-2"><DrawerTitle>Options</DrawerTitle></DrawerHeader>
              <div className="px-4 pb-8 space-y-2">
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => { toggleScreenShare(); setIsDrawerOpen(false); }}>
                  {isSharingScreen ? <ScreenShareOff className="w-5 h-5 mr-3 text-destructive" /> : <ScreenShare className="w-5 h-5 mr-3" />}
                  <span>{isSharingScreen ? "Stop Sharing" : "Share Screen"}</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => { toggleTranscription(); setIsDrawerOpen(false); }}>
                  <Captions className="w-5 h-5 mr-3" />
                  <span>Subtitles {isTranscriptionEnabled && '(On)'}</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => handleMobilePanelOpen("whiteboard")}>
                  <Palette className="w-5 h-5 mr-3" />
                  <span>Whiteboard</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => handleMobilePanelOpen("fileStreaming")}>
                  <FileVideo className="w-5 h-5 mr-3" />
                  <span>Stream File</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => { setViewMode(viewMode === 'speaker' ? 'grid' : viewMode === 'grid' ? 'viewer' : 'speaker'); setIsDrawerOpen(false); }}>
                  <LayoutGrid className="w-5 h-5 mr-3" />
                  <span>{viewMode === 'speaker' ? 'Grid View' : viewMode === 'grid' ? 'Viewer Mode' : 'Speaker View'}</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start h-14 text-left" onClick={() => handleMobilePanelOpen("settings")}>
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
            className={cn("flex-1 w-full rounded-xl flex flex-col gap-1 p-1", dockSizeClasses[mobileDockSize])}
            disabled={isDrawerOpen} // 드로어가 열려있을 때는 통화 종료 버튼 비활성화
          >
            <PhoneOff className={iconSizeMap[mobileDockSize]} />
            <span className={textSizeMap[mobileDockSize]}>Leave</span>
          </Button>
        </div>
      </div>

      {/* Floating Action Button (Dock 숨김 시) */}
      {!isMobileDockVisible && (
        <button
          onClick={toggleMobileDock}
          className={cn(
            "fixed z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95",
            getFABPosition()
          )}
          aria-label="컨트롤 표시"
        >
          {getFABIcon()}
        </button>
      )}

      {/* Safe Area Spacer (모바일 Dock 하단 고정 시) */}
      {mobileDockPosition === 'bottom' && (
        <div className={cn(dockSizeClasses[mobileDockSize], "safe-area-bottom")} />
      )}
    </>
  );
};
