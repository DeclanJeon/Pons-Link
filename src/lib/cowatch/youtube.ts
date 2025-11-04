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
  private isDestroyed: boolean = false;
  private playerElement: HTMLDivElement | null = null;
  private initPromise: Promise<void> | null = null;
  private stateChangeHandler: ((event: any) => void) | null = null;
  private readyHandler: ((event: any) => void) | null = null;
  private errorHandler: ((event: any) => void) | null = null;
  
  private lastEmittedState = {
    currentTime: 0,
    duration: 0,
    playing: false,
    muted: false,
    volume: 100,
    rate: 1
  };
  
  private readonly STATE_UPDATE_INTERVAL = 1000;
  private readonly TIME_THRESHOLD = 1.0;
  private readonly VOLUME_THRESHOLD = 5;

  constructor(container: HTMLElement, onReady: Ready, onState: State, onError: ErrorCb) {
    this.container = container;
    this.onReady = onReady;
    this.onState = onState;
    this.onError = onError;
    
    this.initializePlayer();
  }

  private async initializePlayer() {
    if (this.isDestroyed || this.initPromise) return this.initPromise;
    
    this.initPromise = (async () => {
      try {
        await loadAPI();
        
        if (this.isDestroyed) return;
        
        this.cleanupPlayerElement();
        
        this.playerElement = document.createElement('div');
        this.playerElement.id = `yt-player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.playerElement.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;';
        
        this.container.appendChild(this.playerElement);
        
        console.log('[YouTube] Creating player with unique ID:', this.playerElement.id);
        
        this.readyHandler = (event: any) => {
          if (this.isDestroyed) return;
          console.log('[YouTube] Player ready');
          this.isReady = true;
          this.isInitialized = true;
          this.onReady();
          this.startStateUpdates();
        };
        
        this.stateChangeHandler = (event: any) => {
          if (this.isDestroyed) return;
          this.emitState();
          
          if (event.data === window.YT.PlayerState.PLAYING) {
            if (this.stateUpdateInterval) {
              clearInterval(this.stateUpdateInterval);
              this.startStateUpdates();
            }
          }
        };
        
        this.errorHandler = (e: any) => {
          if (this.isDestroyed) return;
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
        };
        
        this.player = new window.YT.Player(this.playerElement.id, {
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
            enablejsapi: 1,
            origin: window.location.origin
          },
          events: {
            onReady: this.readyHandler,
            onStateChange: this.stateChangeHandler,
            onError: this.errorHandler
          }
        });
      } catch (error) {
        if (this.isDestroyed) return;
        console.error('[YouTube] Failed to initialize player:', error);
        this.onError(error);
        this.initPromise = null;
      }
    })();
    
    return this.initPromise;
  }

  private cleanupPlayerElement() {
    if (this.playerElement) {
      try {
        if (this.playerElement.parentNode === this.container) {
          this.container.removeChild(this.playerElement);
        }
      } catch (error) {
        console.warn('[YouTube] Error removing player element:', error);
      }
      this.playerElement = null;
    }
  }

  private startStateUpdates() {
    if (this.stateUpdateInterval) {
      clearInterval(this.stateUpdateInterval);
    }
    
    let consecutiveNoChanges = 0;
    const MAX_NO_CHANGES = 5;
    let lastUpdateTime = Date.now();
    
    const updateState = () => {
      if (!this.isDestroyed && this.player && this.player.getPlayerState) {
        try {
          const now = Date.now();
          const d = this.player.getDuration?.() || 0;
          const ct = this.player.getCurrentTime?.() || 0;
          const st = this.player.getPlayerState?.() || -1;
          const playing = st === 1;
          const muted = this.player.isMuted?.() || false;
          const volume = this.player.getVolume?.() || 100;
          const rate = this.player.getPlaybackRate?.() || 1;
          
          const hasChanged =
            Math.abs(this.lastEmittedState.currentTime - ct) > this.TIME_THRESHOLD ||
            this.lastEmittedState.playing !== playing ||
            this.lastEmittedState.muted !== muted ||
            Math.abs(this.lastEmittedState.volume - volume) > this.VOLUME_THRESHOLD ||
            Math.abs(this.lastEmittedState.rate - rate) > 0.1 ||
            Math.abs(this.lastEmittedState.duration - d) > 0.5;
          
          if (hasChanged) {
            consecutiveNoChanges = 0;
            lastUpdateTime = now;
            this.lastEmittedState = { currentTime: ct, duration: d, playing, muted, volume, rate };
            this.onState(this.lastEmittedState);
          } else {
            consecutiveNoChanges++;
            
            if (consecutiveNoChanges >= MAX_NO_CHANGES && this.stateUpdateInterval) {
              clearInterval(this.stateUpdateInterval);
              this.stateUpdateInterval = setInterval(updateState, 2000);
            }
          }
        } catch (error) {
          console.warn('[YouTube] Error in state update:', error);
        }
      }
    };
    
    this.stateUpdateInterval = setInterval(updateState, this.STATE_UPDATE_INTERVAL);
  }

  private emitState() {
    if (this.isDestroyed || !this.player || !this.player.getPlayerState) return;
    
    try {
      const d = this.player.getDuration?.() || 0;
      const ct = this.player.getCurrentTime?.() || 0;
      const st = this.player.getPlayerState?.() || -1;
      const playing = st === 1;
      const muted = this.player.isMuted?.() || false;
      const volume = this.player.getVolume?.() || 100;
      const rate = this.player.getPlaybackRate?.() || 1;
      
      const hasChanged = 
        Math.abs(this.lastEmittedState.currentTime - ct) > this.TIME_THRESHOLD ||
        this.lastEmittedState.playing !== playing ||
        this.lastEmittedState.muted !== muted ||
        Math.abs(this.lastEmittedState.volume - volume) > this.VOLUME_THRESHOLD ||
        Math.abs(this.lastEmittedState.rate - rate) > 0.1 ||
        Math.abs(this.lastEmittedState.duration - d) > 0.5;
      
      if (hasChanged) {
        this.lastEmittedState = { currentTime: ct, duration: d, playing, muted, volume, rate };
        this.onState(this.lastEmittedState);
      }
    } catch (error) {
      console.warn('[YouTube] Error emitting state:', error);
    }
  }

  async loadVideo(videoId: string): Promise<void> {
    if (this.isDestroyed) return Promise.reject(new Error('Provider destroyed'));
    
    if (!this.isInitialized || !this.player) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.isDestroyed) {
            clearInterval(checkInterval);
            reject(new Error('Provider destroyed'));
            return;
          }
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
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.isDestroyed) {
            clearInterval(checkInterval);
            reject(new Error('Provider destroyed'));
            return;
          }
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
      return Promise.resolve();
    }
    
    console.log('[YouTube] Loading video:', videoId);
    
    this.videoLoadPromise = new Promise((resolve, reject) => {
      if (this.isDestroyed) {
        reject(new Error('Provider destroyed'));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Video load timeout'));
      }, 15000);

      let isResolved = false;

      const stateChangeHandler = (event: any) => {
        if (this.isDestroyed || isResolved) return;
        
        const state = event.data;
        console.log('[YouTube] State change during load:', state);
        
        if (state === window.YT.PlayerState.PLAYING || 
            state === window.YT.PlayerState.PAUSED ||
            state === window.YT.PlayerState.CUED) {
          clearTimeout(timeout);
          isResolved = true;
          this.currentVideoId = videoId;
          console.log('[YouTube] Video loaded successfully');
          resolve();
        } else if (state === -1) {
          setTimeout(() => {
            if (!isResolved && !this.isDestroyed && this.player?.getPlayerState?.() === -1) {
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
    if (this.isDestroyed || !this.player || !this.isReady) return;
    
    if (this.videoLoadPromise) {
      try {
        await this.videoLoadPromise;
      } catch (error) {
        throw error;
      }
    }
    
    try {
      await this.player.playVideo();
    } catch (error) {
      console.error('[YouTube Provider] Failed to play:', error);
      throw error;
    }
  }

  pause() { 
    if (this.isDestroyed || !this.player || !this.isReady) return;
    try {
      this.player.pauseVideo();
    } catch (error) {
      console.error('[YouTube Provider] Failed to pause:', error);
    }
  }
  
  seek(time: number) { 
    if (this.isDestroyed || !this.player || !this.isReady) return;
    try {
      this.player.seekTo(time, true);
    } catch (error) {
      console.error('[YouTube Provider] Failed to seek:', error);
    }
  }
  
  mute() { 
    if (this.isDestroyed || !this.player || !this.isReady) return;
    try {
      this.player.mute();
    } catch (error) {
      console.error('[YouTube Provider] Failed to mute:', error);
    }
  }
  
  unmute() { 
    if (this.isDestroyed || !this.player || !this.isReady) return;
    try {
      this.player.unMute();
    } catch (error) {
      console.error('[YouTube Provider] Failed to unmute:', error);
    }
  }
  
  setVolume(v: number) {
    if (this.isDestroyed || !this.player || !this.isReady) return;
    try {
      this.player.setVolume(v);
    } catch (error) {
      console.error('[YouTube Provider] Failed to set volume:', error);
    }
  }
  
  setRate(r: number) { 
    if (this.isDestroyed || !this.player || !this.isReady) return;
    try {
      this.player.setPlaybackRate(r);
    } catch (error) {
      console.error('[YouTube Provider] Failed to set rate:', error);
    }
  }

  getCurrentTime(): number {
    if (this.isDestroyed) return 0;
    return this.player?.getCurrentTime?.() || 0;
  }
  
  getSnapshot() {
    if (this.isDestroyed || !this.player) {
      return { currentTime: 0, duration: 0, playing: false, muted: false, volume: 100, rate: 1 };
    }
    
    try {
      const d = this.player.getDuration?.() || 0;
      const ct = this.player.getCurrentTime?.() || 0;
      const st = this.player.getPlayerState?.() || -1;
      const playing = st === 1;
      const muted = this.player.isMuted?.() || false;
      const volume = this.player.getVolume?.() || 100;
      const rate = this.player.getPlaybackRate?.() || 1;
      
      return { currentTime: ct, duration: d, playing, muted, volume, rate };
    } catch (error) {
      console.warn('[YouTube] Error getting snapshot:', error);
      return { ...this.lastEmittedState };
    }
  }

  destroy() {
    console.log('[YouTube] Destroying provider');
    this.isDestroyed = true;
    
    if (this.stateUpdateInterval) {
      clearInterval(this.stateUpdateInterval);
      this.stateUpdateInterval = null;
    }
    
    this.videoLoadPromise = null;
    this.initPromise = null;
    
    if (this.player) {
      try {
        if (this.stateChangeHandler) {
          this.player.removeEventListener?.('onStateChange', this.stateChangeHandler);
        }
        if (this.readyHandler) {
          this.player.removeEventListener?.('onReady', this.readyHandler);
        }
        if (this.errorHandler) {
          this.player.removeEventListener?.('onError', this.errorHandler);
        }
        
        if (this.player.destroy) {
          this.player.destroy();
        }
      } catch (error) {
        console.warn('[YouTube] Error destroying player:', error);
      }
      
      this.player = null;
    }
    
    this.cleanupPlayerElement();
    
    this.stateChangeHandler = null;
    this.readyHandler = null;
    this.errorHandler = null;
    this.isReady = false;
    this.isInitialized = false;
    this.currentVideoId = null;
  }
}
