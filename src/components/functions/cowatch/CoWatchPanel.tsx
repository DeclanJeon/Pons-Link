import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useUIManagementStore } from '@/stores/useUIManagementStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useCoWatchStore } from '@/stores/useCoWatchStore';
import { YouTubeProvider } from '@/lib/cowatch/youtube';
import { toast } from 'sonner';
import { Play, Pause, Volume2, VolumeX, Minimize, Loader2, HelpCircle, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const throttle = <T extends (...args: any[]) => void>(
  func: T,
  delay: number
): T => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  
  return ((...args: Parameters<T>) => {
    const currentTime = Date.now();
    
    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  }) as T;
};

interface CoWatchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CoWatchPanel = ({ isOpen, onClose }: CoWatchPanelProps) => {
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState<YouTubeProvider | null>(null);
  const [isProviderReady, setIsProviderReady] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [localVolume, setLocalVolume] = useState(100);
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [syncDelay, setSyncDelay] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'syncing'>('connected');
  
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevStateRef = useRef<any>({});
  const isApplyingRemoteChangeRef = useRef(false);
  
  const throttledBroadcast = useRef(
    throttle(() => {
      if (!isApplyingRemoteChangeRef.current) {
        broadcastState();
      }
    }, 500)
  ).current;
  
  const { setCowatchMinimized } = useUIManagementStore();
  const { userId, nickname } = useSessionStore();
  const { peers } = usePeerConnectionStore();
  const {
    tabs,
    activeTabId,
    role,
    hostId,
    playing,
    currentTime,
    duration,
    muted,
    volume,
    rate,
    addTab,
    setActiveTab,
    setMediaState,
    broadcastControl,
    broadcastState,
    updateTabMeta
  } = useCoWatchStore();

  const activeTab = tabs.find(tab => tab.id === activeTabId);
  const isCoWatchActive = isOpen && activeTab !== undefined;
  const isHost = role === 'host';

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!isDraggingSeek) {
      setLocalCurrentTime(currentTime);
    }
  }, [currentTime, isDraggingSeek]);

  useEffect(() => {
    if (!activeTab?.id || !isCoWatchActive) {
      if (provider) {
        provider.destroy();
        setProvider(null);
      }
      setIsProviderReady(false);
      setIsVideoLoaded(false);
      return;
    }

    const tabId = activeTab.id;
    const containerId = `cowatch-player-${tabId}`;
    
    const initializeProvider = () => {
      const container = document.getElementById(containerId);
      if (!container) {
        console.warn('[CoWatch] Container not found, retrying...');
        setTimeout(initializeProvider, 100);
        return;
      }

      console.log('[CoWatch] Initializing provider for tab:', tabId);

      const newProvider = new YouTubeProvider(
        container,
        (videoData) => {
          console.log('[CoWatch] Provider ready callback fired:', videoData);
          setIsProviderReady(true);
          
          if (videoData && activeTab) {
            updateTabMeta(activeTab.id, { title: videoData.title });
          }
        },
        (state) => {
          console.log('[CoWatch] State update:', state);
          setMediaState(state);
          setLocalCurrentTime(state.currentTime);
          
          if (isHost && !isApplyingRemoteChangeRef.current) {
            const prev = prevStateRef.current;
            const hasSignificantChange =
              prev.playing !== state.playing ||
              Math.abs((prev.currentTime || 0) - state.currentTime) > 2 ||
              prev.muted !== state.muted ||
              Math.abs((prev.volume || 0) - state.volume) > 5 ||
              prev.rate !== state.rate;
            
            if (hasSignificantChange) {
              throttledBroadcast();
              prevStateRef.current = state;
            }
          }
        },
        (error) => {
          console.error('[CoWatch] YouTube provider error:', error);
          toast.error('Failed to load YouTube video');
          setIsVideoLoaded(false);
        }
      );

      setProvider(newProvider);
      setIsProviderReady(false);
      setIsVideoLoaded(false);
    };

    initializeProvider();

    return () => {
      if (provider) {
        provider.destroy();
      }
      setIsProviderReady(false);
      setIsVideoLoaded(false);
    };
  }, [isCoWatchActive, activeTab?.id, isHost, throttledBroadcast]);

  useEffect(() => {
    if (!provider || !activeTab?.url || !isProviderReady || isVideoLoaded) {
      return;
    }

    const videoId = extractVideoId(activeTab.url);
    if (!videoId) {
      console.error('[CoWatch] Invalid video URL:', activeTab.url);
      toast.error('Invalid YouTube URL');
      return;
    }

    console.log('[CoWatch] Loading video:', videoId, 'Role:', role, 'IsHost:', isHost);
    
    provider.loadVideo(videoId)
      .then(() => {
        console.log('[CoWatch] Video loaded successfully');
        setIsVideoLoaded(true);
        
        if (isHost) {
          console.log('[CoWatch] Broadcasting initial state as host');
          setTimeout(() => {
            broadcastState();
          }, 1000);
        } else {
          console.log('[CoWatch] Video loaded as viewer, waiting for host state');
        }
      })
      .catch((error) => {
        console.error('[CoWatch] Failed to load video:', error);
        toast.error('Failed to load video. Please try again.');
        setIsVideoLoaded(false);
      });
  }, [provider, activeTab?.url, isProviderReady, isVideoLoaded, isHost, role, broadcastState]);

  useEffect(() => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    if (provider && playing && !isDraggingSeek && isVideoLoaded) {
      updateIntervalRef.current = setInterval(() => {
        const snapshot = provider.getSnapshot();
        setLocalCurrentTime(snapshot.currentTime);
      }, 100);
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [provider, playing, isDraggingSeek, isVideoLoaded]);

  useEffect(() => {
    if (!provider || !isVideoLoaded || isHost || playing === undefined) {
      return;
    }
    
    console.log('[CoWatch] Applying remote playing state:', playing);
    
    isApplyingRemoteChangeRef.current = true;
    
    if (playing) {
      provider.play().then(() => {
        console.log('[CoWatch] Started playing as viewer');
      }).catch((error) => {
        console.error('[CoWatch] Failed to play as viewer:', error);
      }).finally(() => {
        isApplyingRemoteChangeRef.current = false;
      });
    } else {
      provider.pause();
      console.log('[CoWatch] Paused as viewer');
      isApplyingRemoteChangeRef.current = false;
    }
  }, [provider, isHost, playing, isVideoLoaded]);

  useEffect(() => {
    if (!provider || !isVideoLoaded || isHost || typeof currentTime !== 'number') {
      return;
    }
    
    const diff = Math.abs(localCurrentTime - currentTime);
    console.log('[CoWatch] Time sync check - Local:', localCurrentTime, 'Remote:', currentTime, 'Diff:', diff);
    
    if (diff > 2 && !isDraggingSeek) {
      console.log('[CoWatch] Syncing time as viewer to:', currentTime);
      isApplyingRemoteChangeRef.current = true;
      provider.seek(currentTime);
      setLocalCurrentTime(currentTime);
      setTimeout(() => {
        isApplyingRemoteChangeRef.current = false;
      }, 500);
    }
  }, [provider, isHost, currentTime, isDraggingSeek, localCurrentTime, isVideoLoaded]);

  useEffect(() => {
    if (!provider || !isVideoLoaded || isHost || muted === undefined) return;
    
    isApplyingRemoteChangeRef.current = true;
    if (muted) {
      provider.mute();
    } else {
      provider.unmute();
    }
    setTimeout(() => {
      isApplyingRemoteChangeRef.current = false;
    }, 100);
  }, [provider, isHost, muted, isVideoLoaded]);

  useEffect(() => {
    if (!provider || !isVideoLoaded || isHost || typeof volume !== 'number') return;
    
    isApplyingRemoteChangeRef.current = true;
    provider.setVolume(volume);
    setLocalVolume(volume);
    setTimeout(() => {
      isApplyingRemoteChangeRef.current = false;
    }, 100);
  }, [provider, isHost, volume, isVideoLoaded]);

  useEffect(() => {
    if (!provider || !isVideoLoaded || isHost || typeof rate !== 'number') return;
    
    isApplyingRemoteChangeRef.current = true;
    provider.setRate(rate);
    setTimeout(() => {
      isApplyingRemoteChangeRef.current = false;
    }, 100);
  }, [provider, isHost, rate, isVideoLoaded]);

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
        console.log('[CoWatch] Set self as host:', userId);
      }
      
      setActiveTab(tabId);
      
      setTimeout(() => {
        const { sendToAllPeers } = usePeerConnectionStore.getState();
        sendToAllPeers(JSON.stringify({
          type: 'cowatch-load',
          payload: {
            url: urlToLoad,
            ownerId: userId,
            ownerName: nickname,
            tabId,
            provider: 'youtube',
            title
          }
        }));
        console.log('[CoWatch] Broadcasted video load to peers');
      }, 500);
      
    } catch (error) {
      console.error('Failed to load video:', error);
      toast.error('Failed to load video');
    }
  }, [url, userId, nickname, hostId, addTab, setActiveTab, updateTabMeta]);

  const handlePlay = useCallback(async () => {
    if (!provider || !isVideoLoaded) return;
    
    await provider.play();
    
    if (isHost) {
      broadcastControl({ cmd: 'play' });
    }
  }, [provider, isHost, broadcastControl, isVideoLoaded]);

  const handlePause = useCallback(() => {
    if (!provider || !isVideoLoaded) return;
    
    provider.pause();
    
    if (isHost) {
      broadcastControl({ cmd: 'pause' });
    }
  }, [provider, isHost, broadcastControl, isVideoLoaded]);

  const handleSeek = useCallback((time: number) => {
    if (!provider || !isVideoLoaded) return;
    
    provider.seek(time);
    setLocalCurrentTime(time);
    
    if (isHost) {
      broadcastControl({ cmd: 'seek', time });
    }
  }, [provider, isHost, broadcastControl, isVideoLoaded]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (!provider || !isVideoLoaded) return;
    
    setLocalVolume(newVolume);
    provider.setVolume(newVolume);
    
    if (isHost) {
      broadcastControl({ cmd: 'volume', volume: newVolume });
    }
  }, [provider, isHost, broadcastControl, isVideoLoaded]);

  const handleMuteToggle = useCallback(() => {
    if (!provider || !isVideoLoaded) return;
    
    const newMutedState = !muted;
    
    if (newMutedState) {
      provider.mute();
    } else {
      provider.unmute();
    }
    
    if (isHost) {
      broadcastControl({ cmd: newMutedState ? 'mute' : 'unmute' });
    }
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

  useEffect(() => {
    const checkConnection = () => {
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      try {
        sendToAllPeers(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        setConnectionStatus('connected');
      } catch (error) {
        console.warn('[CoWatch] Connection check failed:', error);
        setConnectionStatus('disconnected');
      }
    };

    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className={cn('w-full h-full flex flex-col bg-black', isOpen ? '' : 'hidden')}>
      {syncDelay && (
        <div className="absolute top-4 right-4 z-10 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 px-3 py-2 rounded-md shadow-lg">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">Sync delay: {syncDelay.toFixed(1)}s</span>
          </div>
        </div>
      )}
      
      <div className="absolute top-4 left-4 z-10">
        <div className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium",
          connectionStatus === 'connected'
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            : connectionStatus === 'syncing'
            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        )}>
          {connectionStatus === 'connected' ? (
            <Wifi className="w-3 h-3" />
          ) : connectionStatus === 'syncing' ? (
            <Wifi className="w-3 h-3 animate-pulse" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span>{connectionStatus}</span>
        </div>
      </div>

      {tabs.length > 0 && (
        <div className="bg-background border-b px-4 py-2">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-3 py-1 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                  activeTabId === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate max-w-[150px]">{tab.title || 'Loading...'}</span>
                  {tab.ownerName && (
                    <span className="text-xs opacity-70">({tab.ownerName})</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b">
        <div className="flex items-center gap-3 flex-1">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            className="max-w-md"
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadUrl();
            }}
          />
          <Button onClick={loadUrl} size="sm" disabled={!url.trim()}>
            Load
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            <span className={cn(
              "px-2 py-1 rounded-md text-xs font-medium",
              isHost
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            )}>
              {isHost ? '👑 Host' : '👁 Viewer'}
            </span>
            {activeTab && (
              <span className="text-muted-foreground/70 ml-2">
                {activeTab.ownerName}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCowatchMinimized(true)}>
            <Minimize className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            title="Show help for CoWatch"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
      
      <div className="flex-1 relative bg-black">
        <div
          ref={videoContainerRef}
          className="absolute inset-0"
          id={activeTab ? `cowatch-player-${activeTab.id}` : undefined}
        />
        {!activeTab && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-muted-foreground text-lg">Enter a YouTube URL to start CoWatch</div>
              <div className="text-muted-foreground/60 text-sm">Watch videos together in sync</div>
            </div>
          </div>
        )}
        {activeTab && !isVideoLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="text-center space-y-3">
              <Loader2 className="w-12 h-12 animate-spin text-white mx-auto" />
              <div className="text-white text-lg font-medium">Loading video...</div>
              <div className="text-white/70 text-sm">Please wait while we prepare your video</div>
            </div>
          </div>
        )}
      </div>
      
      {activeTab && isVideoLoaded && (
        <div className="bg-background border-t">
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
      
      {showHelp && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-background rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">CoWatch Help</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowHelp(false)}>
                ×
              </Button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium mb-1">👑 Host Controls</h4>
                <p className="text-muted-foreground">As a host, you can:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                  <li>Play/Pause the video</li>
                  <li>Seek to any position</li>
                  <li>Adjust volume and mute/unmute</li>
                  <li>Load new YouTube videos</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">👁 Viewer Experience</h4>
                <p className="text-muted-foreground">As a viewer, you can:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                  <li>Watch videos in sync with the host</li>
                  <li>Switch between different video tabs</li>
                  <li>Adjust your local volume (doesn't affect others)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">🔗 URL Formats</h4>
                <p className="text-muted-foreground">Supported YouTube URL formats:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                  <li>https://www.youtube.com/watch?v=VIDEO_ID</li>
                  <li>https://youtu.be/VIDEO_ID</li>
                  <li>https://www.youtube.com/embed/VIDEO_ID</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-1">🔧 Troubleshooting</h4>
                <ul className="list-disc list-inside space-y-1 ml-4 text-muted-foreground">
                  <li>If video is not syncing, check your connection</li>
                  <li>Try refreshing the page if issues persist</li>
                  <li>Make sure you have a stable internet connection</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
