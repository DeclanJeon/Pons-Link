/**
 * @fileoverview 적응형 스트리밍 관리자 - iOS MediaRecorder 전략 포함 완전 구현
 * @module services/adaptiveStreamManager
 * @description 비디오, PDF, 이미지 모두 지원하는 통합 스트리밍 관리자
 */

import {
  selectStreamingStrategy,
  StreamingStrategy,
  StrategySelection,
  StreamingConfig
} from '@/lib/media/streamingStrategy';
import { MediaRecorderStreaming, MediaRecorderStreamingEvents } from './mediaRecorderStreaming';
import { getDeviceInfo } from '@/lib/device/deviceDetector';
import { toast } from 'sonner';
import { useSubtitleStore } from '@/stores/useSubtitleStore';

/**
 * 스트림 생성 결과 인터페이스
 */
export interface StreamCreationResult {
  stream: MediaStream;
  strategy: StreamingStrategy;
  config: StreamingConfig;
  cleanup: () => void;
}

/**
 * 적응형 스트리밍 관리자 클래스
 */
export class AdaptiveStreamManager {
  private currentStrategy: StrategySelection;
  private mediaRecorderStreaming: MediaRecorderStreaming | null = null;
  private canvasAnimationId: number | null = null;
  private currentStream: MediaStream | null = null;
  private staticContentCanvas: HTMLCanvasElement | null = null;
  private dummyVideoElement: HTMLVideoElement | null = null;
  
  constructor() {
    this.currentStrategy = selectStreamingStrategy();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[AdaptiveStreamManager] Initialized with strategy:', this.currentStrategy.strategy);
    }
  }
  
  /**
   * 디바이스 및 전략 정보 반환
   */
  getInfo(): { device: ReturnType<typeof getDeviceInfo>; strategy: StrategySelection } {
    return {
      device: getDeviceInfo(),
      strategy: this.currentStrategy
    };
  }
  
  /**
   * 비디오 스트림 생성 (기존 로직)
   */
  async createStream(
    videoElement: HTMLVideoElement,
    onChunkReady?: (blob: Blob, timestamp: number) => void,
    options?: { embedSubtitles?: boolean }
  ): Promise<StreamCreationResult> {
    const { strategy, config, fallbacks } = this.currentStrategy;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AdaptiveStreamManager] Creating stream with strategy: ${strategy}`);
    }
    
    // 자막 임베드 옵션이 있으면 캔버스 경로를 강제로 사용
    if (options?.embedSubtitles) {
      return await this.createCanvasStream(videoElement, config, { withSubtitles: true });
    }
    
    try {
      switch (strategy) {
        case 'mediarecorder':
          return await this.createMediaRecorderStream(videoElement, config, onChunkReady);
        
        case 'capturestream':
          return await this.createCaptureStream(videoElement, config);
        
        case 'canvas':
          return await this.createCanvasStream(videoElement, config);
        
        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }
    } catch (error) {
      console.error(`[AdaptiveStreamManager] Strategy ${strategy} failed:`, error);
      
      for (const fallbackStrategy of fallbacks) {
        console.log(`[AdaptiveStreamManager] Trying fallback: ${fallbackStrategy}`);
        
        try {
          switch (fallbackStrategy) {
            case 'capturestream':
              return await this.createCaptureStream(videoElement, config);
            
            case 'canvas':
              return await this.createCanvasStream(videoElement, config);
          }
        } catch (fallbackError) {
          console.error(`[AdaptiveStreamManager] Fallback ${fallbackStrategy} failed:`, fallbackError);
          continue;
        }
      }
      
      throw new Error('All streaming strategies failed');
    }
  }

  /**
   * 정적 콘텐츠(PDF/이미지) 스트림 생성
   * @param canvas - 렌더링된 Canvas 요소
   * @param onChunkReady - MediaRecorder 사용 시 청크 콜백
   */
  async createStaticStream(
    canvas: HTMLCanvasElement,
    onChunkReady?: (blob: Blob, timestamp: number) => void
  ): Promise<StreamCreationResult> {
    console.log('[AdaptiveStreamManager] Creating static content stream (PDF/Image)');
    
    this.staticContentCanvas = canvas;
    const { strategy, config, fallbacks } = this.currentStrategy;
    
    // 정적 콘텐츠용 설정 오버라이드
    const staticConfig: StreamingConfig = {
      ...config,
      fps: 3,
      videoBitsPerSecond: Math.floor(config.videoBitsPerSecond * 0.5),
      audioBitsPerSecond: 0,
      timeslice: 1000,
      chunkSize: 16 * 1024
    };
    
    try {
      switch (strategy) {
        case 'mediarecorder':
          return await this.createStaticMediaRecorderStream(canvas, staticConfig, onChunkReady);
        
        case 'capturestream':
          return await this.createStaticCaptureStream(canvas, staticConfig);
        
        case 'canvas':
          return await this.createStaticCanvasStream(canvas, staticConfig);
        
        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }
    } catch (error) {
      console.error(`[AdaptiveStreamManager] Static stream strategy ${strategy} failed:`, error);
      
      for (const fallbackStrategy of fallbacks) {
        try {
          switch (fallbackStrategy) {
            case 'capturestream':
              return await this.createStaticCaptureStream(canvas, staticConfig);
            case 'canvas':
              return await this.createStaticCanvasStream(canvas, staticConfig);
          }
        } catch (fallbackError) {
          continue;
        }
      }
      
      throw new Error('All static streaming strategies failed');
    }
  }

  /**
   * 정적 콘텐츠용 MediaRecorder 스트림 (iOS 14.3+ 최적화)
   */
  private async createStaticMediaRecorderStream(
    canvas: HTMLCanvasElement,
    config: StreamingConfig,
    onChunkReady?: (blob: Blob, timestamp: number) => void
  ): Promise<StreamCreationResult> {
    console.log('[AdaptiveStreamManager] Using MediaRecorder for static content (iOS optimized)');
    
    // Canvas에서 기본 스트림 생성
    let baseStream: MediaStream;
    if ('captureStream' in canvas) {
      baseStream = (canvas as any).captureStream(config.fps);
    } else if ('mozCaptureStream' in canvas) {
      baseStream = (canvas as any).mozCaptureStream(config.fps);
    } else {
      throw new Error('Canvas captureStream not supported');
    }
    
    if (!baseStream || baseStream.getTracks().length === 0) {
      throw new Error('Failed to create base stream from canvas');
    }
    
    // 가상 비디오 요소 생성
    this.dummyVideoElement = document.createElement('video');
    this.dummyVideoElement.srcObject = baseStream;
    this.dummyVideoElement.muted = true;
    this.dummyVideoElement.playsInline = true;
    
    try {
      await this.dummyVideoElement.play();
    } catch (playError) {
      console.warn('[AdaptiveStreamManager] Dummy video play failed:', playError);
    }
    
    // MediaRecorder 이벤트 핸들러
    const events: MediaRecorderStreamingEvents = {
      onChunkReady: (blob: Blob, timestamp: number) => {
        if (onChunkReady) {
          onChunkReady(blob, timestamp);
        }
      },
      onError: (error: Error) => {
        console.error('[AdaptiveStreamManager] MediaRecorder error:', error);
        toast.error(`Streaming error: ${error.message}`);
      },
      onStateChange: (state: 'inactive' | 'recording' | 'paused') => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[AdaptiveStreamManager] MediaRecorder state:', state);
        }
      },
      onBitrateUpdate: (bitrate: number) => {
        if (bitrate < 100000) {
          console.warn('[AdaptiveStreamManager] Low bitrate detected:', bitrate);
        }
      }
    };
    
    this.mediaRecorderStreaming = new MediaRecorderStreaming(events);
    
    try {
      await this.mediaRecorderStreaming.start(this.dummyVideoElement, config);
      
      // 더미 스트림 반환 (실제 전송은 MediaRecorder가 처리)
      const dummyStream = new MediaStream();
      this.currentStream = dummyStream;
      
      toast.success('Static content streaming started (iOS MediaRecorder)', { duration: 2000 });
      
      return {
        stream: dummyStream,
        strategy: 'mediarecorder',
        config,
        cleanup: () => {
          if (this.mediaRecorderStreaming) {
            this.mediaRecorderStreaming.stop();
            this.mediaRecorderStreaming = null;
          }
          if (baseStream) {
            baseStream.getTracks().forEach(t => t.stop());
          }
          if (this.dummyVideoElement) {
            this.dummyVideoElement.srcObject = null;
            this.dummyVideoElement = null;
          }
          this.currentStream = null;
          this.staticContentCanvas = null;
        }
      };
    } catch (error) {
      this.mediaRecorderStreaming = null;
      baseStream.getTracks().forEach(t => t.stop());
      if (this.dummyVideoElement) {
        this.dummyVideoElement.srcObject = null;
        this.dummyVideoElement = null;
      }
      throw error;
    }
  }

  /**
   * 정적 콘텐츠용 captureStream (iOS 15+)
   */
  private async createStaticCaptureStream(
    canvas: HTMLCanvasElement,
    config: StreamingConfig
  ): Promise<StreamCreationResult> {
    console.log('[AdaptiveStreamManager] Using captureStream for static content');
    
    let stream: MediaStream;
    
    if ('captureStream' in canvas) {
      stream = (canvas as any).captureStream(config.fps);
    } else if ('mozCaptureStream' in canvas) {
      stream = (canvas as any).mozCaptureStream(config.fps);
    } else {
      throw new Error('Canvas captureStream not supported');
    }
    
    if (!stream || stream.getTracks().length === 0) {
      throw new Error('Failed to create static captureStream');
    }
    
    this.currentStream = stream;
    this.staticContentCanvas = canvas;
    
    toast.success(`Static content streaming started (${config.fps}fps)`, { duration: 2000 });
    
    return {
      stream,
      strategy: 'capturestream',
      config,
      cleanup: () => {
        if (this.currentStream) {
          this.currentStream.getTracks().forEach(track => track.stop());
          this.currentStream = null;
        }
        this.staticContentCanvas = null;
      }
    };
  }

  /**
   * 정적 콘텐츠용 Canvas fallback (iOS < 14.3)
   */
  private async createStaticCanvasStream(
    canvas: HTMLCanvasElement,
    config: StreamingConfig
  ): Promise<StreamCreationResult> {
    console.log('[AdaptiveStreamManager] Using Canvas fallback for static content');
    
    let stream: MediaStream;
    
    if ('captureStream' in canvas) {
      stream = (canvas as any).captureStream(config.fps);
    } else if ('mozCaptureStream' in canvas) {
      stream = (canvas as any).mozCaptureStream(config.fps);
    } else {
      throw new Error('Canvas captureStream not supported');
    }
    
    this.currentStream = stream;
    this.staticContentCanvas = canvas;
    
    toast.info(`Static content streaming (${config.fps}fps, compatibility mode)`, { duration: 2000 });
    
    return {
      stream,
      strategy: 'canvas',
      config,
      cleanup: () => {
        if (this.currentStream) {
          this.currentStream.getTracks().forEach(track => track.stop());
          this.currentStream = null;
        }
        this.staticContentCanvas = null;
      }
    };
  }

  /**
   * 정적 콘텐츠 스트림 업데이트 (페이지 전환 등)
   */
  forceStreamUpdate(): void {
    if (!this.currentStream && !this.mediaRecorderStreaming) {
      console.warn('[AdaptiveStreamManager] No active stream to update');
      return;
    }
    
    // MediaRecorder 사용 중이면 자동으로 다음 청크에 반영됨
    if (this.mediaRecorderStreaming) {
      console.log('[AdaptiveStreamManager] MediaRecorder will capture changes in next chunk (~1s)');
      return;
    }
    
    // captureStream 사용 중이면 즉시 프레임 요청
    if (this.currentStream) {
      const videoTrack = this.currentStream.getVideoTracks()[0];
      if (videoTrack && 'requestFrame' in videoTrack) {
        (videoTrack as any).requestFrame();
        console.log('[AdaptiveStreamManager] Forced frame update via requestFrame');
      } else {
        console.warn('[AdaptiveStreamManager] requestFrame not supported on this track');
      }
    }
  }

  /**
   * MediaRecorder 스트림 생성 (비디오용)
   */
  private async createMediaRecorderStream(
    videoElement: HTMLVideoElement,
    config: StreamingConfig,
    onChunkReady?: (blob: Blob, timestamp: number) => void
  ): Promise<StreamCreationResult> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AdaptiveStreamManager] Using MediaRecorder strategy');
    }
    
    const events: MediaRecorderStreamingEvents = {
      onChunkReady: (blob, timestamp) => {
        if (onChunkReady) {
          onChunkReady(blob, timestamp);
        }
      },
      onError: (error) => {
        console.error('[AdaptiveStreamManager] MediaRecorder error:', error);
        toast.error(`Streaming error: ${error.message}`);
      },
      onStateChange: (state) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[AdaptiveStreamManager] MediaRecorder state:', state);
        }
      },
      onBitrateUpdate: (bitrate) => {
        if (bitrate < 500000) {
          console.warn('[AdaptiveStreamManager] Low bitrate detected:', bitrate);
        }
      }
    };
    
    this.mediaRecorderStreaming = new MediaRecorderStreaming(events);
    
    try {
      await this.mediaRecorderStreaming.start(videoElement, config);
      
      const dummyStream = new MediaStream();
      this.currentStream = dummyStream;
      
      toast.success('MediaRecorder streaming started (iOS optimized)', { duration: 2000 });
      
      return {
        stream: dummyStream,
        strategy: 'mediarecorder',
        config,
        cleanup: () => {
          this.mediaRecorderStreaming?.stop();
          this.mediaRecorderStreaming = null;
          this.currentStream = null;
        }
      };
    } catch (error) {
      this.mediaRecorderStreaming = null;
      throw error;
    }
  }
  
  /**
   * captureStream 스트림 생성 (비디오용)
   */
  private async createCaptureStream(
    videoElement: HTMLVideoElement,
    config: StreamingConfig
  ): Promise<StreamCreationResult> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AdaptiveStreamManager] Using captureStream strategy');
    }
    
    let stream: MediaStream | null = null;
    
    if ('captureStream' in videoElement) {
      try {
        stream = (videoElement as any).captureStream(config.fps);
      } catch (e) {
        console.warn('[AdaptiveStreamManager] captureStream failed:', e);
      }
    }
    
    if (!stream && 'mozCaptureStream' in videoElement) {
      try {
        stream = (videoElement as any).mozCaptureStream(config.fps);
      } catch (e) {
        console.warn('[AdaptiveStreamManager] mozCaptureStream failed:', e);
      }
    }
    
    if (!stream || stream.getTracks().length === 0) {
      throw new Error('Failed to create captureStream');
    }
    
    this.currentStream = stream;
    
    toast.success(`Video streaming started (${config.fps}fps)`, { duration: 2000 });
    
    return {
      stream,
      strategy: 'capturestream',
      config,
      cleanup: () => {
        if (this.currentStream) {
          this.currentStream.getTracks().forEach(track => track.stop());
          this.currentStream = null;
        }
      }
    };
  }
  
  /**
   * Canvas 스트림 생성 (비디오용 fallback)
   */
  private async createCanvasStream(
    videoElement: HTMLVideoElement,
    config: StreamingConfig,
    ext?: { withSubtitles?: boolean }
  ): Promise<StreamCreationResult> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AdaptiveStreamManager] Using Canvas fallback strategy');
    }
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    canvas.width = videoElement.videoWidth || 1280;
    canvas.height = videoElement.videoHeight || 720;
    
    console.log(`[AdaptiveStreamManager] Canvas size: ${canvas.width}x${canvas.height}`);
    
    let stream: MediaStream;
    
    if ('captureStream' in canvas) {
      stream = (canvas as any).captureStream(config.fps);
    } else if ('mozCaptureStream' in canvas) {
      stream = (canvas as any).mozCaptureStream(config.fps);
    } else {
      throw new Error('Canvas captureStream not supported');
    }
    
    const draw = () => {
      if (!videoElement.paused && !videoElement.ended) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        if (ext?.withSubtitles) this.drawSubtitles(ctx, canvas.width, canvas.height);
      }
      this.canvasAnimationId = requestAnimationFrame(draw);
    };
    
    draw();
    
    this.currentStream = stream;
    
    toast.info(`Canvas streaming started (${config.fps}fps, compatibility mode)`, { duration: 2000 });
    
    return {
      stream,
      strategy: 'canvas',
      config,
      cleanup: () => {
        if (this.canvasAnimationId) {
          cancelAnimationFrame(this.canvasAnimationId);
          this.canvasAnimationId = null;
        }
        if (this.currentStream) {
          this.currentStream.getTracks().forEach(t => t.stop());
          this.currentStream = null;
        }
      }
    };
  }
  
  /**
   * 자막 그리기 헬퍼 메서드
   */
  private drawSubtitles(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const st = useSubtitleStore.getState();
    if (!st.isEnabled || !st.currentCue) return;
    const raw = st.currentCue.text || '';
    const text = raw.replace(/<[^>]+>/g, '');
    const lines = text.split(/\r?\n/);
    const sizeMap: Record<string, number> = {
      small: Math.round(h * 0.032),
      medium: Math.round(h * 0.04),
      large: Math.round(h * 0.05),
      xlarge: Math.round(h * 0.06)
    };
    const fontSize = sizeMap[st.style.fontSize] || Math.round(h * 0.04);
    const padX = Math.max(8, Math.round(fontSize * 0.6));
    const padY = Math.max(6, Math.round(fontSize * 0.4));
    ctx.font = `${st.style.fontWeight === 'bold' ? 'bold' : 'normal'} ${fontSize}px ${st.style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const metrics = lines.map(line => ctx.measureText(line));
    const textWidth = Math.min(w * 0.9, Math.max(...metrics.map(m => m.width)));
    const lineHeight = Math.round(fontSize * 1.3);
    const boxWidth = textWidth + padX * 2;
    const boxHeight = lines.length * lineHeight + padY * 2;
    const bg = this.hexToRgba(st.style.backgroundColor, st.style.backgroundOpacity);
    let x = w / 2;
    let y;
    if (st.position === 'top') {
      y = Math.max(boxHeight + padY, Math.round(h * 0.1));
    } else if (st.position === 'bottom') {
      y = h - Math.round(h * 0.08);
    } else if (st.position === 'custom') {
      y = h * (st.customPosition.y / 100);
    } else {
      y = h - Math.round(h * 0.08);
    }
    const boxX = x - boxWidth / 2;
    const boxY = y - boxHeight;
    ctx.fillStyle = bg;
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    if (st.style.edgeStyle === 'uniform') {
      ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.08));
      ctx.strokeStyle = st.style.edgeColor;
    } else {
      ctx.shadowColor = st.style.edgeColor;
      ctx.shadowBlur = st.style.edgeStyle === 'dropshadow' ? Math.round(fontSize * 0.15) : 0;
      if (st.style.edgeStyle === 'raised') ctx.shadowOffsetY = -Math.round(fontSize * 0.06);
      else if (st.style.edgeStyle === 'depressed') ctx.shadowOffsetY = Math.round(fontSize * 0.06);
      else ctx.shadowOffsetY = 0;
    }
    ctx.fillStyle = st.style.color;
    lines.forEach((line, i) => {
      const ty = boxY + padY + lineHeight * (i + 1) - Math.round(fontSize * 0.2);
      if (st.style.edgeStyle === 'uniform') ctx.strokeText(line, x, ty);
      ctx.fillText(line, x, ty);
    });
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }

  /**
   * hex → rgba 변환 헬퍼 메서드
   */
  private hexToRgba(hex: string, alpha: number) {
    const h = hex.replace('#', '');
    if (h.length === 3) {
      const r = parseInt(h[0] + h[0], 16);
      const g = parseInt(h[1] + h[1], 16);
      const b = parseInt(h[2] + h[2], 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  
  /**
   * 스트리밍 상태 확인
   */
  isStreaming(): boolean {
    if (this.mediaRecorderStreaming) {
      return this.mediaRecorderStreaming.isStreaming();
    }
    
    return this.currentStream !== null;
  }
  
  /**
   * 모든 리소스 정리
   */
  cleanup(): void {
    if (this.mediaRecorderStreaming) {
      this.mediaRecorderStreaming.stop();
      this.mediaRecorderStreaming = null;
    }
    
    if (this.canvasAnimationId) {
      cancelAnimationFrame(this.canvasAnimationId);
      this.canvasAnimationId = null;
    }
    
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => track.stop());
      this.currentStream = null;
    }
    
    if (this.dummyVideoElement) {
      this.dummyVideoElement.srcObject = null;
      this.dummyVideoElement = null;
    }
    
    this.staticContentCanvas = null;
  }
}