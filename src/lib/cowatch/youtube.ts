type Ready = (videoData?: { title: string; thumbnail: string }) => void;
type State = (s: { currentTime: number; duration: number; playing: boolean; muted: boolean; volume: number; rate: number }) => void;
type ErrorCb = (e: any) => void;

declare global {
  interface Window { 
    YT: any; 
    onYouTubeIframeAPIReady?: () => void;
  }
}

const loadAPI = (): Promise<void> =>
  new Promise((res, rej) => {
    if (window.YT && window.YT.Player) {
      return res();
    }
    
    const timeout = setTimeout(() => {
      rej(new Error('YouTube API loading timeout'));
    }, 10000);
    
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => {
      clearTimeout(timeout);
      rej(new Error('Failed to load YouTube API script'));
    };
    document.head.appendChild(s);
    
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      res();
    };
  });

const parseVideoId = (url: string): string | null => {
  try {
    const u = new URL(url);
    
    if (u.hostname.includes('youtu.be')) {
      const pathParts = u.pathname.split('/');
      return pathParts[pathParts.length - 1] || null;
    }
    
    if (u.searchParams.has('v')) {
      return u.searchParams.get('v');
    }
    
    const paths = u.pathname.split('/');
    const idx = paths.indexOf('embed');
    if (idx >= 0 && paths[idx + 1]) {
      return paths[idx + 1];
    }
    
    const shortsIdx = paths.indexOf('shorts');
    if (shortsIdx >= 0 && paths[shortsIdx + 1]) {
      return paths[shortsIdx + 1];
    }
    
    return null;
  } catch (error) {
    console.warn('[YouTube] Failed to parse video ID from URL:', url, error);
    return null;
  }
};

const fetchVideoMetadata = async (videoId: string): Promise<{ title: string; thumbnail: string } | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.warn('[YouTube] Failed to fetch metadata, status:', response.status);
      return null;
    }
    
    const data = await response.json();
    return {
      title: data.title || 'Unknown Title',
      thumbnail: data.thumbnail_url || ''
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn('[YouTube] Metadata fetch timeout');
    } else {
      console.warn('[YouTube] Failed to fetch video metadata:', error);
    }
    return null;
  }
};

export class YouTubeProvider {
  private player: any = null;
  private container: HTMLElement;
  private onReady: Ready;
  private onState: State;
  private onError: ErrorCb;
  private stateUpdateInterval: NodeJS.Timeout | null = null;
  private isReady: boolean = false;
  private videoLoadPromise: Promise<void> | null = null;
  private currentVideoId: string | null = null;
  private isInitialized: boolean = false;

  constructor(container: HTMLElement, onReady: Ready, onState: State, onError: ErrorCb) {
    this.container = container;
    this.onReady = onReady;
    this.onState = onState;
    this.onError = onError;
    
    this.initializePlayer();
  }

  private async initializePlayer() {
    try {
      await loadAPI();
      
      this.container.innerHTML = '';
      
      const playerContainer = document.createElement('div');
      playerContainer.id = `youtube-player-${Date.now()}`;
      playerContainer.style.width = '100%';
      playerContainer.style.height = '100%';
      playerContainer.style.position = 'absolute';
      playerContainer.style.top = '0';
      playerContainer.style.left = '0';
      
      this.container.appendChild(playerContainer);
      
      console.log('[YouTube Provider] Creating player...');
      
      this.player = new window.YT.Player(playerContainer, {
        width: '100%',
        height: '100%',
        playerVars: {
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          autoplay: 0,
          controls: 1,
          fs: 1,
          iv_load_policy: 3,
          cc_load_policy: 1,
          hl: 'en',
          enablejsapi: 1
        },
        events: {
          onReady: (event: any) => {
            console.log('[YouTube Provider] Player ready event fired');
            this.isReady = true;
            this.isInitialized = true;
            this.onReady();
            this.startStateUpdates();
          },
          onStateChange: (event: any) => {
            console.log('[YouTube Provider] State changed:', event.data);
            this.emitState();
            
            if (event.data === window.YT.PlayerState.ENDED) {
              console.log('[YouTube] Video ended');
            } else if (event.data === window.YT.PlayerState.PLAYING) {
              console.log('[YouTube] Video playing');
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              console.log('[YouTube] Video paused');
            } else if (event.data === window.YT.PlayerState.BUFFERING) {
              console.log('[YouTube] Video buffering');
            } else if (event.data === window.YT.PlayerState.CUED) {
              console.log('[YouTube] Video cued');
            }
          },
          onError: (e: any) => {
            console.error('[YouTube] Player error:', e.data);
            let errorMessage = 'YouTube player error';
            
            switch (e.data) {
              case 2:
                errorMessage = 'Invalid video ID';
                break;
              case 5:
                errorMessage = 'HTML5 player error';
                break;
              case 100:
                errorMessage = 'Video not found or private';
                break;
              case 101:
              case 150:
                errorMessage = 'Video cannot be embedded';
                break;
            }
            
            this.onError(new Error(errorMessage));
          }
        }
      });
    } catch (error) {
      console.error('[YouTube] Failed to initialize player:', error);
      this.onError(error);
    }
  }

  async loadVideo(videoId: string): Promise<void> {
    if (!this.isInitialized || !this.player) {
      console.warn('[YouTube Provider] Player not initialized yet, waiting...');
      
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.isInitialized && this.player) {
            clearInterval(checkInterval);
            this.loadVideo(videoId).then(resolve).catch(reject);
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Player initialization timeout'));
        }, 10000);
      });
    }
    
    if (!this.isReady) {
      console.warn('[YouTube Provider] Player not ready yet, waiting...');
      
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.isReady) {
            clearInterval(checkInterval);
            this.loadVideo(videoId).then(resolve).catch(reject);
          }
        }, 100);
        
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Player ready timeout'));
        }, 10000);
      });
    }
    
    if (this.currentVideoId === videoId) {
      console.log('[YouTube Provider] Video already loaded:', videoId);
      return Promise.resolve();
    }
    
    console.log('[YouTube Provider] Loading video:', videoId);
    
    this.videoLoadPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, 15000);

      let isResolved = false;

      const stateChangeHandler = (event: any) => {
        const state = event.data;
        console.log('[YouTube Provider] Load state change:', state);
        
        if (isResolved) return;
        
        if (state === window.YT.PlayerState.PLAYING || 
            state === window.YT.PlayerState.PAUSED ||
            state === window.YT.PlayerState.CUED) {
          clearTimeout(timeout);
          isResolved = true;
          this.currentVideoId = videoId;
          console.log('[YouTube Provider] Video loaded successfully:', videoId);
          resolve();
        } else if (state === -1) {
          setTimeout(() => {
            if (!isResolved && this.player?.getPlayerState?.() === -1) {
              clearTimeout(timeout);
              isResolved = true;
              reject(new Error('Video load failed'));
            }
          }, 3000);
        }
      };

      try {
        this.player.addEventListener('onStateChange', stateChangeHandler);
        this.player.loadVideoById(videoId);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });

    return this.videoLoadPromise;
  }

  async play(): Promise<void> {
    if (!this.player || !this.isReady) {
      console.warn('[YouTube Provider] Cannot play - player not ready');
      return;
    }
    
    if (this.videoLoadPromise) {
      try {
        await this.videoLoadPromise;
      } catch (error) {
        console.error('[YouTube Provider] Failed to wait for video load:', error);
        throw error;
      }
    }
    
    try {
      await this.player.playVideo();
      console.log('[YouTube Provider] Playing video');
    } catch (error) {
      console.error('[YouTube Provider] Failed to play:', error);
      throw error;
    }
  }
  
  private startStateUpdates() {
    if (this.stateUpdateInterval) {
      clearInterval(this.stateUpdateInterval);
    }
    
    this.stateUpdateInterval = setInterval(() => {
      this.emitState();
    }, 500);
  }

  private emitState() {
    if (!this.player || !this.player.getPlayerState) return;
    
    try {
      const d = this.player.getDuration?.() || 0;
      const ct = this.player.getCurrentTime?.() || 0;
      const st = this.player.getPlayerState?.() || -1;
      const playing = st === 1;
      const muted = this.player.isMuted?.() || false;
      const volume = this.player.getVolume?.() || 100;
      const rate = this.player.getPlaybackRate?.() || 1;
      
      this.onState({ currentTime: ct, duration: d, playing, muted, volume, rate });
    } catch (error) {
      console.warn('[YouTube] Error emitting state:', error);
    }
  }

  pause() { 
    if (!this.player || !this.isReady) return;
    try {
      this.player.pauseVideo();
      console.log('[YouTube Provider] Pausing video');
    } catch (error) {
      console.error('[YouTube Provider] Failed to pause:', error);
    }
  }
  
  seek(time: number) { 
    if (!this.player || !this.isReady) return;
    try {
      this.player.seekTo(time, true);
      console.log('[YouTube Provider] Seeking to:', time);
    } catch (error) {
      console.error('[YouTube Provider] Failed to seek:', error);
    }
  }
  
  mute() { 
    if (!this.player || !this.isReady) return;
    try {
      this.player.mute();
      console.log('[YouTube Provider] Muting');
    } catch (error) {
      console.error('[YouTube Provider] Failed to mute:', error);
    }
  }
  
  unmute() { 
    if (!this.player || !this.isReady) return;
    try {
      this.player.unMute();
      console.log('[YouTube Provider] Unmuting');
    } catch (error) {
      console.error('[YouTube Provider] Failed to unmute:', error);
    }
  }
  
  setVolume(v: number) {
    if (!this.player || !this.isReady) return;
    try {
      this.player.setVolume(v);
      console.log('[YouTube Provider] Setting volume:', v);
    } catch (error) {
      console.error('[YouTube Provider] Failed to set volume:', error);
    }
  }
  
  setRate(r: number) { 
    if (!this.player || !this.isReady) return;
    try {
      this.player.setPlaybackRate(r);
      console.log('[YouTube Provider] Setting playback rate:', r);
    } catch (error) {
      console.error('[YouTube Provider] Failed to set rate:', error);
    }
  }

  getCurrentTime(): number {
    return this.player?.getCurrentTime?.() || 0;
  }
  
  getSnapshot() {
    if (!this.player) {
      return { currentTime: 0, duration: 0, playing: false, muted: false, volume: 100, rate: 1 };
    }
    
    const d = this.player.getDuration?.() || 0;
    const ct = this.player.getCurrentTime?.() || 0;
    const st = this.player.getPlayerState?.() || -1;
    const playing = st === 1;
    const muted = this.player.isMuted?.() || false;
    const volume = this.player.getVolume?.() || 100;
    const rate = this.player.getPlaybackRate?.() || 1;
    
    return { currentTime: ct, duration: d, playing, muted, volume, rate };
  }

  destroy() {
    if (this.stateUpdateInterval) {
      clearInterval(this.stateUpdateInterval);
      this.stateUpdateInterval = null;
    }
    
    try {
      this.player?.destroy?.();
    } catch (error) {
      console.warn('[YouTube] Error destroying player:', error);
    }
    
    this.player = null;
    this.isReady = false;
    this.isInitialized = false;
    this.currentVideoId = null;
    this.container.innerHTML = '';
  }
}
