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

  constructor(container: HTMLElement, onReady: Ready, onState: State, onError: ErrorCb) {
    this.container = container;
    this.onReady = onReady;
    this.onState = onState;
    this.onError = onError;
    
    this.initializePlayer();
  }

  private async initializePlayer() {
    if (this.isDestroyed) return;
    
    try {
      await loadAPI();
      
      if (this.isDestroyed) return;
      
      // React가 관리하지 않는 별도 div 생성
      this.playerElement = document.createElement('div');
      this.playerElement.id = `yt-player-${Date.now()}`;
      this.playerElement.style.cssText = 'width:100%;height:100%;position:absolute;top:0;left:0;';
      
      // React 관리 밖에서 추가
      this.container.appendChild(this.playerElement);
      
      console.log('[YouTube] Creating player...');
      
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
          onReady: (event: any) => {
            if (this.isDestroyed) return;
            console.log('[YouTube] Player ready');
            this.isReady = true;
            this.isInitialized = true;
            this.onReady();
            this.startStateUpdates();
          },
          onStateChange: (event: any) => {
            if (this.isDestroyed) return;
            this.emitState();
          },
          onError: (e: any) => {
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
          }
        }
      });
    } catch (error) {
      if (this.isDestroyed) return;
      console.error('[YouTube] Failed to initialize player:', error);
      this.onError(error);
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
  
  private startStateUpdates() {
    if (this.stateUpdateInterval) {
      clearInterval(this.stateUpdateInterval);
    }
    
    this.stateUpdateInterval = setInterval(() => {
      if (!this.isDestroyed) {
        this.emitState();
      }
    }, 500);
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
      
      this.onState({ currentTime: ct, duration: d, playing, muted, volume, rate });
    } catch (error) {
      console.warn('[YouTube] Error emitting state:', error);
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
    console.log('[YouTube] Destroying provider');
    this.isDestroyed = true;
    
    if (this.stateUpdateInterval) {
      clearInterval(this.stateUpdateInterval);
      this.stateUpdateInterval = null;
    }
    
    // YouTube Player destroy
    try {
      if (this.player?.destroy) {
        this.player.destroy();
      }
    } catch (error) {
      console.warn('[YouTube] Error destroying player:', error);
    }
    
    // playerElement 제거 (React 외부에서 생성한 것)
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
    
    this.player = null;
    this.isReady = false;
    this.isInitialized = false;
    this.currentVideoId = null;
  }
}
