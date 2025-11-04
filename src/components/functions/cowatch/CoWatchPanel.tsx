// src/components/functions/cowatch/CoWatchPanel.tsx
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useCoWatchStore, useCoWatchMedia, useCoWatchTabs, useCoWatchRole, useCoWatchActions } from '@/stores/useCoWatchStore';
import { YouTubeProvider } from '@/lib/cowatch/youtube';
import { toast } from 'sonner';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Loader2,
  HelpCircle,
  X,
  PictureInPicture,
  Maximize,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeviceType } from '@/hooks/useDeviceType';

const SYNC_THRESHOLD = 2;
const STATE_BROADCAST_THROTTLE = 500;
const BUFFER_CHECK_INTERVAL = 100;

// 개선된 throttle 함수 - 더 효율적인 디바운싱
const createThrottle = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  let lastCallTime = 0;
  
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    lastCallTime = now;
    
    if (now - lastExecTime > delay) {
      func(...args);
      lastExecTime = now;
    } else if (timeSinceLastCall >= delay) {
      // 즉시 실행
      func(...args);
      lastExecTime = now;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
      }, delay - timeSinceLastCall);
    }
  }) as T;
};

// 메모이제이션된 콜백 생성 유틸리티
const createMemoizedCallback = <T extends (...args: any[]) => any>(
  fn: T,
  deps: React.DependencyList
): T => {
  const ref = useRef<T>();
  const signalRef = useRef<number>(0);
  
  useEffect(() => {
    signalRef.current += 1;
    const currentSignal = signalRef.current;
    ref.current = fn;
    
    return () => {
      ref.current = undefined;
    };
  }, deps);
  
  return useCallback((...args: Parameters<T>) => {
    const currentFn = ref.current;
    if (!currentFn) return fn(...args);
    return currentFn(...args);
  }, [signalRef.current]) as T;
};

interface CoWatchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type PanelMode = 'full' | 'pip' | 'minimized';

const CoWatchPanel = memo(({ isOpen, onClose }: CoWatchPanelProps) => {
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState<YouTubeProvider | null>(null);
  const [isProviderReady, setIsProviderReady] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [localVolume, setLocalVolume] = useState(100);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('full');
  
  const { isMobile, isTablet, isDesktop, width } = useDeviceType();
  const [pipSize] = useState({ width: isMobile ? 320 : 480, height: isMobile ? 240 : 320 });
  const [pipPosition, setPipPosition] = useState({
    x: isMobile ? window.innerWidth - 340 : window.innerWidth - 500,
    y: isMobile ? window.innerHeight - 300 : window.innerHeight - 420
  });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const [minimizedSize] = useState({ width: isMobile ? 200 : 280, height: isMobile ? 60 : 80 });
  const [minimizedPosition, setMinimizedPosition] = useState({
    x: isMobile ? window.innerWidth - 220 : window.innerWidth - 300,
    y: isMobile ? window.innerHeight - 120 : window.innerHeight - 180
  });
  const [isDraggingMinimized, setIsDraggingMinimized] = useState(false);
  const [minimizedDragOffset, setMinimizedDragOffset] = useState({ x: 0, y: 0 });
  
  const pipRef = useRef<HTMLDivElement>(null);
  const minimizedRef = useRef<HTMLDivElement>(null);
  const fullPanelRef = useRef<HTMLDivElement>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevStateRef = useRef<any>({});
  const isApplyingRemoteChangeRef = useRef(false);
  const lastBroadcastTimeRef = useRef(0);
  const mountedRef = useRef(true);
  const savedPlayerStateRef = useRef<{
    currentTime: number;
    playing: boolean;
    volume: number;
    muted: boolean;
  } | null>(null);
  const providerInitializedRef = useRef(false);
  
  const {
    isPanelOpen,
    getPanelZIndex,
    bringPanelToFront,
    closePanel,
    openPanel
  } = useUIManagementStore();
  const { userId, nickname } = useSessionStore();
  
  // 상태를 세분화하여 구독
  const { tabs, activeTabId } = useCoWatchTabs();
  const { playing, currentTime, duration, muted, volume, rate } = useCoWatchMedia();
  const { role, hostId } = useCoWatchRole();
  const { addTab, setActiveTab, setMediaState, broadcastControl, broadcastState, updateTabMeta } = useCoWatchActions();

  const activeTab = useMemo(() => tabs.find(tab => tab.id === activeTabId), [tabs, activeTabId]);
  const isHost = useMemo(() => role === 'host', [role]);
  const isVisible = useMemo(() => isPanelOpen('cowatch') || panelMode !== 'full', [isPanelOpen, panelMode]);
  const zIndex = useMemo(() => getPanelZIndex('cowatch'), [getPanelZIndex]);

  const throttledBroadcast = useRef(
    createThrottle(() => {
      if (!mountedRef.current || !isHost || isApplyingRemoteChangeRef.current) return;
      broadcastState();
      lastBroadcastTimeRef.current = Date.now();
    }, STATE_BROADCAST_THROTTLE)
  ).current;

  useEffect(() => {
    if (isOpen && !isPanelOpen('cowatch')) {
      openPanel('cowatch');
    }
  }, [isOpen, isPanelOpen, openPanel]);

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!isDraggingSeek) {
      setLocalCurrentTime(currentTime);
    }
  }, [currentTime, isDraggingSeek]);

  const getCurrentContainerId = useCallback(() => {
    if (!activeTab?.id) return null;
    return `cowatch-player-${activeTab.id}-${panelMode}`;
  }, [activeTab?.id, panelMode]);

  const handlePanelClick = useCallback(() => {
    if (panelMode === 'full') {
      bringPanelToFront('cowatch');
    }
  }, [panelMode, bringPanelToFront]);

  const initializeProvider = useCallback(() => {
    if (!isVisible || !activeTab?.id) {
      console.log('[CoWatch] Panel not visible or no active tab, skipping provider initialization');
      return;
    }

    const containerId = getCurrentContainerId();
    if (!containerId) return;
    
    let retryCount = 0;
    const maxRetries = 20;
    let timeoutId: NodeJS.Timeout | null = null;

    const tryInitialize = () => {
      if (!isVisible || !activeTab?.id) {
        console.log('[CoWatch] Panel closed during initialization, aborting');
        return;
      }

      const container = document.getElementById(containerId);
      
      if (!container) {
        retryCount++;
        
        if (retryCount >= maxRetries) {
          console.error('[CoWatch] Container not found after max retries:', containerId);
          return;
        }
        
        console.warn(`[CoWatch] Container not found (${retryCount}/${maxRetries}), retrying...`, containerId);
        timeoutId = setTimeout(tryInitialize, 100);
        return;
      }

      console.log('[CoWatch] Initializing provider for:', {
        tabId: activeTab.id,
        panelMode,
        containerId
      });

      if (provider) {
        console.log('[CoWatch] Destroying old provider before creating new one');
        try {
          provider.destroy();
        } catch (e) {
          console.warn('[CoWatch] Error destroying old provider:', e);
        }
      }

      const newProvider = new YouTubeProvider(
        container,
        (videoData) => {
          if (!mountedRef.current) return;
          console.log('[CoWatch] Provider ready:', videoData);
          setIsProviderReady(true);
          providerInitializedRef.current = true;
          
          if (videoData && activeTab) {
            updateTabMeta(activeTab.id, { title: videoData.title });
          }

          if (savedPlayerStateRef.current) {
            console.log('[CoWatch] Restoring saved state:', savedPlayerStateRef.current);
            const saved = savedPlayerStateRef.current;
            setTimeout(() => {
              if (!mountedRef.current || !newProvider) return;
              
              newProvider.seek(saved.currentTime);
              newProvider.setVolume(saved.volume);
              if (saved.muted) {
                newProvider.mute();
              } else {
                newProvider.unmute();
              }
              
              if (saved.playing) {
                newProvider.play().catch(e => {
                  console.warn('[CoWatch] Auto-play failed:', e);
                });
              }
              
              savedPlayerStateRef.current = null;
            }, 300);
          }
        },
        (state) => {
          if (!mountedRef.current) return;
          
          if (!isApplyingRemoteChangeRef.current) {
            setMediaState(state);
            setLocalCurrentTime(state.currentTime);
            
            if (isHost) {
              const prev = prevStateRef.current;
              const hasSignificantChange =
                prev.playing !== state.playing ||
                Math.abs((prev.currentTime || 0) - state.currentTime) > SYNC_THRESHOLD ||
                prev.muted !== state.muted ||
                Math.abs((prev.volume || 0) - state.volume) > 5 ||
                prev.rate !== state.rate;
              
              if (hasSignificantChange) {
                throttledBroadcast();
                prevStateRef.current = { ...state };
              }
            }
          }
        },
        (error) => {
          if (!mountedRef.current) return;
          console.error('[CoWatch] YouTube provider error:', error);
          toast.error('Failed to load YouTube video');
          setIsVideoLoaded(false);
          providerInitializedRef.current = false;
        }
      );

      if (!mountedRef.current) {
        newProvider.destroy();
        return;
      }

      setProvider(newProvider);
      setIsProviderReady(false);
      setIsVideoLoaded(false);
    };

    tryInitialize();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeTab?.id, panelMode, isVisible, setMediaState, updateTabMeta, isHost, throttledBroadcast, getCurrentContainerId]);

  useEffect(() => {
    if (!activeTab?.id || !isVisible) {
      if (provider) {
        console.log('[CoWatch] Cleaning up provider - not visible or no active tab');
        const oldProvider = provider;
        setProvider(null);
        setIsProviderReady(false);
        setIsVideoLoaded(false);
        providerInitializedRef.current = false;
        
        setTimeout(() => {
          if (!mountedRef.current) return;
          try {
            oldProvider.destroy();
          } catch (e) {
            console.warn('[CoWatch] Error destroying provider:', e);
          }
        }, 100);
      }
      return;
    }

    const cleanup = initializeProvider();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [activeTab?.id, isVisible]);

  useEffect(() => {
    if (!provider || !activeTab?.url || !isProviderReady || isVideoLoaded || !mountedRef.current) {
      return;
    }

    const videoId = extractVideoId(activeTab.url);
    if (!videoId) {
      toast.error('Invalid YouTube URL');
      return;
    }

    console.log('[CoWatch] Loading video:', { videoId, panelMode });
    let cancelled = false;
    
    provider.loadVideo(videoId)
      .then(() => {
        if (cancelled || !mountedRef.current) return;
        console.log('[CoWatch] Video loaded successfully');
        setIsVideoLoaded(true);
        
        if (savedPlayerStateRef.current) {
          const saved = savedPlayerStateRef.current;
          console.log('[CoWatch] Restoring player state after load:', saved);
          
          setTimeout(() => {
            if (!mountedRef.current || !provider) return;
            
            provider.seek(saved.currentTime);
            provider.setVolume(saved.volume);
            if (saved.muted) {
              provider.mute();
            } else {
              provider.unmute();
            }
            
            if (saved.playing) {
              provider.play().catch(e => console.warn('[CoWatch] Auto-play failed:', e));
            }
            
            savedPlayerStateRef.current = null;
          }, 500);
        } else if (isHost) {
          setTimeout(() => {
            if (mountedRef.current) {
              broadcastState();
            }
          }, 1000);
        }
      })
      .catch((error) => {
        if (cancelled || !mountedRef.current) return;
        console.error('[CoWatch] Failed to load video:', error);
        toast.error('Failed to load video. Please try again.');
        setIsVideoLoaded(false);
      });

    return () => {
      cancelled = true;
    };
  }, [provider, activeTab?.url, isProviderReady, isVideoLoaded, isHost, broadcastState]);

  useEffect(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    if (provider && playing && !isDraggingSeek && isVideoLoaded && mountedRef.current) {
      updateIntervalRef.current = setInterval(() => {
        if (!isApplyingRemoteChangeRef.current && mountedRef.current) {
          try {
            const snapshot = provider.getSnapshot();
            setLocalCurrentTime(snapshot.currentTime);
          } catch (error) {
            console.warn('[CoWatch] Error getting snapshot:', error);
          }
        }
      }, BUFFER_CHECK_INTERVAL);
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [provider, playing, isDraggingSeek, isVideoLoaded]);

  useEffect(() => {
    if (!provider || !isVideoLoaded || isHost || playing === undefined || !mountedRef.current) return;
    
    isApplyingRemoteChangeRef.current = true;
    
    const applyPlayingState = async () => {
      try {
        if (playing) {
          await provider.play();
        } else {
          provider.pause();
        }
      } catch (error) {
        console.error('[CoWatch] Failed to apply playing state:', error);
      } finally {
        setTimeout(() => {
          if (mountedRef.current) {
            isApplyingRemoteChangeRef.current = false;
          }
        }, 300);
      }
    };
    
    applyPlayingState();
  }, [provider, isHost, playing, isVideoLoaded]);

  useEffect(() => {
    if (!provider || !isVideoLoaded || isHost || typeof currentTime !== 'number' || !mountedRef.current) return;
    
    const diff = Math.abs(localCurrentTime - currentTime);
    
    if (diff > SYNC_THRESHOLD && !isDraggingSeek) {
      isApplyingRemoteChangeRef.current = true;
      provider.seek(currentTime);
      setLocalCurrentTime(currentTime);
      setTimeout(() => {
        if (mountedRef.current) {
          isApplyingRemoteChangeRef.current = false;
        }
      }, 500);
    }
  }, [provider, isHost, currentTime, isDraggingSeek, isVideoLoaded]);

  useEffect(() => {
    if (!provider || !isVideoLoaded || isHost || muted === undefined || !mountedRef.current) return;
    
    isApplyingRemoteChangeRef.current = true;
    if (muted) {
      provider.mute();
    } else {
      provider.unmute();
    }
    setTimeout(() => {
      if (mountedRef.current) {
        isApplyingRemoteChangeRef.current = false;
      }
    }, 100);
  }, [provider, isHost, muted, isVideoLoaded]);

  useEffect(() => {
    if (!provider || !isVideoLoaded || isHost || typeof volume !== 'number' || !mountedRef.current) return;
    
    isApplyingRemoteChangeRef.current = true;
    provider.setVolume(volume);
    setLocalVolume(volume);
    setTimeout(() => {
      if (mountedRef.current) {
        isApplyingRemoteChangeRef.current = false;
      }
    }, 100);
  }, [provider, isHost, volume, isVideoLoaded]);

  useEffect(() => {
    if (!provider || !isVideoLoaded || isHost || typeof rate !== 'number' || !mountedRef.current) return;
    
    isApplyingRemoteChangeRef.current = true;
    provider.setRate(rate);
    setTimeout(() => {
      if (mountedRef.current) {
        isApplyingRemoteChangeRef.current = false;
      }
    }, 100);
  }, [provider, isHost, rate, isVideoLoaded]);

  const handlePipMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('.no-drag')) {
      return;
    }
    
    e.preventDefault();
    
    setIsDraggingPip(true);
    const rect = pipRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  }, []);

  const handlePipMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPip) return;

    e.preventDefault();

    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    const maxX = window.innerWidth - pipSize.width;
    const maxY = window.innerHeight - pipSize.height;
    
    setPipPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [isDraggingPip, dragOffset, pipSize]);

  const handlePipMouseUp = useCallback(() => {
    setIsDraggingPip(false);
  }, []);

  const handleMinimizedMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    
    e.preventDefault();
    
    setIsDraggingMinimized(true);
    const rect = minimizedRef.current?.getBoundingClientRect();
    if (rect) {
      setMinimizedDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  }, []);

  const handleMinimizedMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingMinimized) return;

    e.preventDefault();

    const newX = e.clientX - minimizedDragOffset.x;
    const newY = e.clientY - minimizedDragOffset.y;
    
    const maxX = window.innerWidth - minimizedSize.width;
    const maxY = window.innerHeight - minimizedSize.height;
    
    setMinimizedPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [isDraggingMinimized, minimizedDragOffset, minimizedSize]);

  const handleMinimizedMouseUp = useCallback(() => {
    setIsDraggingMinimized(false);
  }, []);

  useEffect(() => {
    if (isDraggingPip) {
      document.addEventListener('mousemove', handlePipMouseMove);
      document.addEventListener('mouseup', handlePipMouseUp);
      return () => {
        document.removeEventListener('mousemove', handlePipMouseMove);
        document.removeEventListener('mouseup', handlePipMouseUp);
      };
    }
  }, [isDraggingPip, handlePipMouseMove, handlePipMouseUp]);

  useEffect(() => {
    if (isDraggingMinimized) {
      document.addEventListener('mousemove', handleMinimizedMouseMove);
      document.addEventListener('mouseup', handleMinimizedMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMinimizedMouseMove);
        document.removeEventListener('mouseup', handleMinimizedMouseUp);
      };
    }
  }, [isDraggingMinimized, handleMinimizedMouseMove, handleMinimizedMouseUp]);

  const togglePanelMode = useCallback(() => {
    if (provider && isVideoLoaded && providerInitializedRef.current) {
      try {
        const snapshot = provider.getSnapshot();
        savedPlayerStateRef.current = {
          currentTime: snapshot.currentTime,
          playing: snapshot.playing,
          volume: snapshot.volume,
          muted: snapshot.muted
        };
        console.log('[CoWatch] Saving player state before mode change:', savedPlayerStateRef.current);
      } catch (error) {
        console.warn('[CoWatch] Error getting snapshot for mode change:', error);
      }
    }

    if (panelMode === 'full') {
      setPanelMode('pip');
      toast.info('CoWatch minimized to Picture-in-Picture');
    } else if (panelMode === 'pip') {
      setPanelMode('minimized');
      toast.info('CoWatch minimized');
    } else {
      setPanelMode('full');
      openPanel('cowatch');
    }
  }, [panelMode, provider, isVideoLoaded, openPanel]);

  const restoreFromMinimized = useCallback(() => {
    setPanelMode('full');
    openPanel('cowatch');
  }, [openPanel]);

  const handleClose = useCallback(() => {
    closePanel('cowatch');
    onClose();
  }, [closePanel, onClose]);

  const loadUrl = useCallback(async () => {
    if (!url.trim()) {
      toast.error('Please enter a YouTube URL');
      return;
    }
    
    const urlToLoad = url.trim();
    setUrl('');
    
    const videoId = extractVideoId(urlToLoad);
    if (!videoId) {
      toast.error('Invalid YouTube URL format');
      return;
    }
    
    try {
      const existingTab = tabs.find(tab => tab.url === urlToLoad && tab.ownerId === userId);
      if (existingTab) {
        toast.info('This video is already loaded');
        setActiveTab(existingTab.id);
        return;
      }
      
      let title = '';
      try {
        const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
        if (response.ok) {
          const data = await response.json();
          title = data.title || '';
        }
      } catch (metadataError) {
        console.warn('Failed to fetch video metadata:', metadataError);
      }
      
      const tabId = addTab(urlToLoad, userId || '', nickname || '', 'youtube');
      
      if (title) {
        updateTabMeta(tabId, { title });
      }
      
      if (!hostId) {
        const { setHost } = useCoWatchStore.getState();
        setHost(userId || '');
      }
      
      setActiveTab(tabId);
      
    } catch (error) {
      console.error('Failed to load video:', error);
      toast.error('Failed to load video');
    }
  }, [url, userId, nickname, hostId, addTab, setActiveTab, updateTabMeta, tabs]);

  // 미디어 컨트롤 콜백 메모이제이션
  const handlePlay = createMemoizedCallback(async () => {
    if (!provider || !isVideoLoaded) {
      console.warn('[CoWatch] Cannot play - provider not ready');
      return;
    }
    console.log('[CoWatch] Play requested');
    await provider.play();
    if (isHost) broadcastControl({ cmd: 'play' });
  }, [provider, isHost, broadcastControl, isVideoLoaded]);

  const handlePause = createMemoizedCallback(() => {
    if (!provider || !isVideoLoaded) {
      console.warn('[CoWatch] Cannot pause - provider not ready');
      return;
    }
    console.log('[CoWatch] Pause requested');
    provider.pause();
    if (isHost) broadcastControl({ cmd: 'pause' });
  }, [provider, isHost, broadcastControl, isVideoLoaded]);

  const handleSeek = createMemoizedCallback((time: number) => {
    if (!provider || !isVideoLoaded) return;
    provider.seek(time);
    setLocalCurrentTime(time);
    if (isHost) broadcastControl({ cmd: 'seek', time });
  }, [provider, isHost, broadcastControl, isVideoLoaded]);

  const handleVolumeChange = createMemoizedCallback((newVolume: number) => {
    if (!provider || !isVideoLoaded) return;
    setLocalVolume(newVolume);
    provider.setVolume(newVolume);
    if (isHost) broadcastControl({ cmd: 'volume', volume: newVolume });
  }, [provider, isHost, broadcastControl, isVideoLoaded]);

  const handleMuteToggle = createMemoizedCallback(() => {
    if (!provider || !isVideoLoaded) return;
    const newMutedState = !muted;
    if (newMutedState) {
      provider.mute();
    } else {
      provider.unmute();
    }
    if (isHost) broadcastControl({ cmd: newMutedState ? 'mute' : 'unmute' });
  }, [provider, muted, isHost, broadcastControl, isVideoLoaded]);

  const formatTime = useCallback((seconds: number) => {
    if (seconds < 0 || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.floor(Math.abs(seconds) % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const extractVideoId = useCallback((url: string): string | null => {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtu.be')) return u.pathname.replace('/', '');
      if (u.searchParams.has('v')) return u.searchParams.get('v');
      const paths = u.pathname.split('/');
      const idx = paths.indexOf('embed');
      if (idx >= 0 && paths[idx + 1]) return paths[idx + 1];
      return null;
    } catch {
      return null;
    }
  }, []);

  const progressPercentage = duration > 0 ? (localCurrentTime / duration) * 100 : 0;

  const handlePipClose = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[CoWatch] PIP close button clicked');
    handleClose();
    setPanelMode('full');
  }, [handleClose]);

  if (panelMode === 'minimized') {
    return (
      <div
        ref={minimizedRef}
        className={cn(
          "fixed z-[61] rounded-lg bg-primary text-primary-foreground shadow-xl hover:shadow-2xl transition-all flex items-center gap-3 px-4 py-3 group",
          isMobile && "px-3 py-2"
        )}
        style={{
          left: `${minimizedPosition.x}px`,
          top: `${minimizedPosition.y}px`,
          width: `${minimizedSize.width}px`,
          height: `${minimizedSize.height}px`,
          cursor: isDraggingMinimized ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
        onMouseDown={handleMinimizedMouseDown}
      >
        <Play className={cn("w-4 h-4 flex-shrink-0", isMobile && "w-3 h-3")} />
        <div className="flex-1 min-w-0">
          <div className={cn("font-medium", isMobile ? "text-xs" : "text-sm")}>CoWatch</div>
          {activeTab?.title && (
            <div className={cn(isMobile ? "text-[10px] opacity-90" : "text-xs opacity-90", "truncate")}>
              {activeTab.title}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            restoreFromMinimized();
          }}
          className={cn(
            "h-7 w-7 p-0 flex-shrink-0 hover:bg-white/20 opacity-70 group-hover:opacity-100",
            isMobile && "h-6 w-6"
          )}
          title="Restore"
        >
          <Maximize className={cn("w-4 h-4", isMobile && "w-3 h-3")} />
        </Button>
      </div>
    );
  }

  if (panelMode === 'pip') {
    return (
      <div
        ref={pipRef}
        className="fixed bg-background border-2 border-primary rounded-xl shadow-2xl overflow-hidden"
        style={{
          left: `${pipPosition.x}px`,
          top: `${pipPosition.y}px`,
          width: `${pipSize.width}px`,
          height: `${pipSize.height}px`,
          cursor: isDraggingPip ? 'grabbing' : 'grab',
          userSelect: 'none',
          zIndex: 50
        }}
        onMouseDown={handlePipMouseDown}
      >
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm px-3 py-2 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 pointer-events-none">
            <span className={cn(isMobile ? "text-[10px]" : "text-xs", "font-semibold text-white truncate max-w-[20px]")}>
              {activeTab?.title || 'CoWatch'}
            </span>
            <span className={cn(
              isMobile ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-xs",
              "rounded font-medium",
              isHost
                ? "bg-green-500/90 text-white"
                : "bg-blue-500/90 text-white"
            )}>
              {isHost ? 'Host' : 'Viewer'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setPanelMode('minimized');
              }}
              className={cn("h-7 w-7 p-0 text-white hover:bg-white/20", isMobile && "h-6 w-6")}
              title="Minimize"
            >
              <Minimize2 className={cn("w-3.5 h-3.5", isMobile && "w-3 h-3")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (provider && isVideoLoaded) {
                  try {
                    const snapshot = provider.getSnapshot();
                    savedPlayerStateRef.current = {
                      currentTime: snapshot.currentTime,
                      playing: snapshot.playing,
                      volume: snapshot.volume,
                      muted: snapshot.muted
                    };
                  } catch (error) {
                    console.warn('[CoWatch] Error getting snapshot for PIP mode:', error);
                  }
                }
                setPanelMode('full');
                openPanel('cowatch');
              }}
              className={cn("h-7 w-7 p-0 text-white hover:bg-white/20", isMobile && "h-6 w-6")}
              title="Restore"
            >
              <Maximize className={cn("w-3.5 h-3.5", isMobile && "w-3 h-3")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePipClose}
              className={cn("h-7 w-7 p-0 text-white hover:bg-white/20", isMobile && "h-6 w-6")}
              title="Close"
            >
              <X className={cn("w-3.5 h-3.5", isMobile && "w-3 h-3")} />
            </Button>
          </div>
        </div>

        <div className="absolute inset-0 pt-12 pb-20">
          <div className="absolute inset-0 bg-black">
            <div
              id={getCurrentContainerId() || undefined}
              className="absolute inset-0"
            />
            {!activeTab && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center space-y-2">
                  <div className="text-muted-foreground">No video loaded</div>
                </div>
              </div>
            )}
            {activeTab && !isVideoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10">
                <div className="text-center space-y-3">
                  <Loader2 className="w-12 h-12 animate-spin text-white mx-auto" />
                  <div className="text-white text-lg font-medium">Loading...</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent backdrop-blur-sm px-3 py-3 no-drag">
          <div className="mb-2">
            <div className={cn("relative h-1 bg-white/20 rounded-full cursor-pointer group", isMobile && "h-1.5")}
              onClick={(e) => {
                if (!isHost) return;
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = x / rect.width;
                const newTime = percentage * duration;
                handleSeek(newTime);
              }}
            >
              <div
                className="absolute top-0 left-0 h-full bg-primary rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
          
          <div className={cn("flex items-center gap-2", isMobile && "gap-1")}>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (!isHost) {
                  toast.info('Only the host can control playback');
                  return;
                }
                playing ? handlePause() : handlePlay();
              }}
              disabled={!isHost}
              className={cn("h-8 w-8 p-0 text-white hover:bg-white/20 disabled:opacity-50", isMobile && "h-7 w-7")}
            >
              {playing ? <Pause className={cn("w-4 h-4", isMobile && "w-3 h-3")} /> : <Play className={cn("w-4 h-4", isMobile && "w-3 h-3")} />}
            </Button>
            
            <span className={cn(isMobile ? "text-[10px] min-w-[60px]" : "text-xs font-mono min-w-[80px]", "text-white")}>
              {formatTime(localCurrentTime)} / {formatTime(duration)}
            </span>
            
            <div className="flex-1" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleMuteToggle();
              }}
              className={cn("h-8 w-8 p-0 text-white hover:bg-white/20", isMobile && "h-7 w-7")}
            >
              {muted ? <VolumeX className={cn("w-4 h-4", isMobile && "w-3 h-3")} /> : <Volume2 className={cn("w-4 h-4", isMobile && "w-3 h-3")} />}
            </Button>
            
            <div className={cn("flex items-center gap-1", isMobile ? "min-w-[60px]" : "min-w-[100px]")}>
              <Slider
                value={[localVolume]}
                onValueChange={([v]) => handleVolumeChange(v)}
                max={100}
                step={1}
                className={cn("w-20", isMobile && "w-12")}
              />
              <span className={cn(isMobile ? "text-[10px] w-6" : "text-xs w-10", "font-mono text-white text-right")}>
                {Math.round(localVolume)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={fullPanelRef}
        className={cn(
          'fixed inset-0 bg-background flex flex-col',
          !isPanelOpen('cowatch') && 'hidden'
        )}
        style={{ zIndex }}
        onClick={handlePanelClick}
      >
        <div className={cn("bg-background border-b px-4 py-2 flex items-center justify-between z-10", isMobile && "px-3 py-1.5")}>
          <div className="flex items-center gap-2">
            <span className={cn(isMobile ? "text-sm" : "font-semibold")}>CoWatch</span>
            {activeTab && (
              <span className={cn(
                isMobile ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1",
                "rounded-md font-medium",
                isHost
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              )}>
                {isHost ? 'Host' : 'Viewer'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size={isMobile ? "sm" : "sm"}
              onClick={togglePanelMode}
              className={cn("h-8 w-8 p-0", isMobile && "h-7 w-7")}
              title="Minimize to PIP"
            >
              <PictureInPicture className={cn("w-4 h-4", isMobile && "w-3 h-3")} />
            </Button>
            <Button
              variant="ghost"
              size={isMobile ? "sm" : "sm"}
              onClick={() => setShowHelp(!showHelp)}
              className={cn("h-8 w-8 p-0", isMobile && "h-7 w-7")}
              title="Help"
            >
              <HelpCircle className={cn("w-4 h-4", isMobile && "w-3 h-3")} />
            </Button>
            <Button
              variant="ghost"
              size={isMobile ? "sm" : "sm"}
              onClick={handleClose}
              className={cn("h-8 w-8 p-0", isMobile && "h-7 w-7")}
            >
              <X className={cn("w-4 h-4", isMobile && "w-3 h-3")} />
            </Button>
          </div>
        </div>

        {tabs.length > 0 && (
          <div className={cn("bg-background border-b px-4 py-2 z-10", isMobile && "px-3 py-1.5")}>
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    isMobile ? "px-2 py-1 rounded-md text-xs font-medium" : "px-3 py-1 rounded-md text-sm font-medium",
                    "transition-colors whitespace-nowrap",
                    activeTabId === tab.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(isMobile ? "max-w-[100px] text-xs" : "max-w-[150px]", "truncate")}>{tab.title || 'Loading...'}</span>
                    {tab.ownerName && (
                      <span className={cn(isMobile ? "text-[10px]" : "text-xs", "opacity-70")}>({tab.ownerName})</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className={cn("flex items-center justify-between px-4 py-3 bg-background border-b z-10", isMobile && "px-3 py-2")}>
          <div className={cn("flex items-center gap-3 flex-1", isMobile && "gap-2")}>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              className={cn("max-w-md", isMobile && "text-sm h-8")}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadUrl();
              }}
            />
            <Button onClick={loadUrl} size={isMobile ? "sm" : "sm"} disabled={!url.trim()} className={isMobile && "text-xs h-8"}>
              Load
            </Button>
          </div>
        </div>
        
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-black">
            <div
              id={getCurrentContainerId() || undefined}
              className="absolute inset-0"
            />
            {!activeTab && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center space-y-2">
                  <div className="text-muted-foreground text-lg">Enter a YouTube URL to start CoWatch</div>
                  <div className="text-muted-foreground/60 text-sm">Watch videos together in sync</div>
                </div>
              </div>
            )}
            {activeTab && !isVideoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-10">
                <div className="text-center space-y-3">
                  <Loader2 className="w-12 h-12 animate-spin text-white mx-auto" />
                  <div className="text-white text-lg font-medium">Loading video...</div>
                  <div className="text-white/70 text-sm">Please wait while we prepare your video</div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {activeTab && isVideoLoaded && (
          <div className="bg-background border-t z-10">
            <div className="px-4 py-2">
              <div className="relative h-1 bg-muted rounded-full cursor-pointer group"
                onClick={(e) => {
                  if (!isHost) {
                    toast.info('Only the host can seek the video');
                    return;
                  }
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percentage = x / rect.width;
                  const newTime = percentage * duration;
                  handleSeek(newTime);
                }}
                onMouseDown={() => setIsDraggingSeek(true)}
                onMouseUp={() => setIsDraggingSeek(false)}
                onMouseLeave={() => setIsDraggingSeek(false)}
              >
                <div 
                  className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all group-hover:bg-primary/80"
                  style={{ width: `${progressPercentage}%` }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${progressPercentage}%`, transform: 'translate(-50%, -50%)' }}
                />
              </div>
            </div>
            
            <div className="px-4 pb-3 flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={playing ? handlePause : handlePlay}
                disabled={!isHost}
                className="h-10 w-10 p-0"
                title={!isHost ? 'Only the host can control playback' : ''}
              >
                {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </Button>
              
              <div className="flex items-center gap-2 text-sm font-mono min-w-[100px]">
                <span>{formatTime(localCurrentTime)}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-muted-foreground">{formatTime(duration)}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMuteToggle}
                  className="h-10 w-10 p-0"
                  title={isHost ? 'Toggle mute for all' : 'Toggle mute for yourself'}
                >
                  {muted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </Button>
                
                <div className="flex items-center gap-2 min-w-[160px]">
                  <Slider
                    value={[localVolume]}
                    onValueChange={([v]) => handleVolumeChange(v)}
                    max={100}
                    step={1}
                    className="w-32"
                  />
                  <span className="text-sm font-mono w-12 text-right">{Math.round(localVolume)}%</span>
                </div>
              </div>
              
              <div className="flex-1" />
              
              <div className="text-sm text-muted-foreground max-w-md truncate font-medium flex items-center gap-2">
                <span>{activeTab.title || 'Loading...'}</span>
                {activeTab.ownerName && (
                  <span className="text-xs opacity-70 bg-muted px-2 py-1 rounded">
                    by {activeTab.ownerName}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {showHelp && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-background rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">CoWatch Help</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowHelp(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium mb-1">Host Controls</h4>
                <p className="text-muted-foreground">As a host, you can control playback, seek, and adjust volume for all viewers.</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Viewer Experience</h4>
                <p className="text-muted-foreground">As a viewer, you watch in sync with the host. You can adjust your local volume without affecting others.</p>
              </div>
              <div>
                <h4 className="font-medium mb-1">Panel Modes</h4>
                <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                  <li><strong>Full Mode:</strong> Complete panel with all controls</li>
                  <li><strong>PIP Mode:</strong> Floating window you can drag anywhere</li>
                  <li><strong>Minimized:</strong> Collapsed to draggable button</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">Tips</h4>
                <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                  <li>Multiple panels can be open at once</li>
                  <li>Click on a panel to bring it to front</li>
                  <li>Use PIP mode to watch while using other features</li>
                  <li>Drag the PIP window or minimized button anywhere on screen</li>
                  <li>The video continues playing in all modes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

CoWatchPanel.displayName = 'CoWatchPanel';

export { CoWatchPanel };