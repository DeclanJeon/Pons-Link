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
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';

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

    // Canvas에서 비디오 스트림 생성
    let videoStream: MediaStream;
    if ('captureStream' in canvas) {
      videoStream = (canvas as any).captureStream(config.fps);
    } else if ('mozCaptureStream' in canvas) {
      videoStream = (canvas as any).mozCaptureStream(config.fps);
    } else {
      throw new Error('Canvas captureStream not supported');
    }

    if (!videoStream || videoStream.getTracks().length === 0) {
      throw new Error('Failed to create base stream from canvas');
    }

    // ✅ 파일 스트리밍 중이면 원본 비디오 엘리먼트에서 오디오 가져오기
    const fileStreamingStore = useFileStreamingStore.getState();
    const videoEl = fileStreamingStore.presentationVideoEl;
    let audioTrack: MediaStreamTrack | null = null;

    if (fileStreamingStore.isStreaming && videoEl && !videoEl.muted) {
      console.log('[AdaptiveStreamManager] 🎵 Attempting to capture audio from file streaming video');

      try {
        // 1. captureStream으로 오디오 시도
        let capturedStream: MediaStream | null = null;
        if (typeof (videoEl as any).captureStream === 'function') {
          capturedStream = (videoEl as any).captureStream();
        } else if (typeof (videoEl as any).mozCaptureStream === 'function') {
          capturedStream = (videoEl as any).mozCaptureStream();
        }

        audioTrack = capturedStream?.getAudioTracks()[0] || null;
        if (audioTrack) {
          console.log('[AdaptiveStreamManager] ✅ Audio track from captureStream');
        }

        // 2. VideoJsPlayer에서 미리 준비된 AudioContext 사용
        if (!audioTrack && (videoEl as any)._audioDestination) {
          try {
            const dest = (videoEl as any)._audioDestination;
            audioTrack = dest.stream.getAudioTracks()[0] || null;
            if (audioTrack) {
              console.log('[AdaptiveStreamManager] ✅ Audio track from prepared AudioContext');
            }
          } catch (e) {
            console.error('[AdaptiveStreamManager] Prepared AudioContext failed:', e);
          }
        }

        // 3. AudioContext Fallback
        if (!audioTrack) {
          const ctx = new AudioContext();
          const src = ctx.createMediaElementSource(videoEl);
          const dest = ctx.createMediaStreamDestination();

          // ✅ 게인 노드 추가
          const gainNode = ctx.createGain();
          gainNode.gain.value = 1.0;

          src.connect(gainNode);
          gainNode.connect(dest);

          audioTrack = dest.stream.getAudioTracks()[0] || null;
          console.log('[AdaptiveStreamManager] ✅ Audio captured via AudioContext');

          // 정리를 위해 AudioContext 저장
          (canvas as any)._audioContext = ctx;
        }
      } catch (e) {
        console.error('[AdaptiveStreamManager] Audio capture failed:', e);
      }
    }

    // ✅ 비디오 + 오디오 결합
    const combinedStream = new MediaStream();
    videoStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));

    if (audioTrack) {
      combinedStream.addTrack(audioTrack);
      console.log('[AdaptiveStreamManager] ✅ Audio track added to MediaRecorder stream');
    } else {
      console.log('[AdaptiveStreamManager] ⚠️ No audio track available (streaming static content only)');
    }

    // 가상 비디오 요소 생성 (결합된 스트림 사용)
    this.dummyVideoElement = document.createElement('video');
    this.dummyVideoElement.srcObject = combinedStream;
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
          if (videoStream) {
            videoStream.getTracks().forEach(t => t.stop());
          }
          if (this.dummyVideoElement) {
            this.dummyVideoElement.srcObject = null;
            this.dummyVideoElement = null;
          }
          // ✅ AudioContext 정리
          const ctx = (canvas as any)._audioContext;
          if (ctx && ctx.state !== 'closed') {
            ctx.close();
          }
          this.currentStream = null;
          this.staticContentCanvas = null;
        }
      };
    } catch (error) {
      this.mediaRecorderStreaming = null;
      videoStream.getTracks().forEach(t => t.stop());
      if (this.dummyVideoElement) {
        this.dummyVideoElement.srcObject = null;
        this.dummyVideoElement = null;
      }
      // ✅ AudioContext 정리
      const ctx = (canvas as any)._audioContext;
      if (ctx && ctx.state !== 'closed') {
        ctx.close();
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
    
    const device = getDeviceInfo();
    let desiredFps = config.fps;
    
    // 자막이 활성화된 경우 성능에 따라 FPS 자동 조절
    if (ext?.withSubtitles) {
      if (device.isIOS) {
        desiredFps = Math.min(desiredFps, 20);
      }
      
      if (device.performance === 'low') {
        desiredFps = Math.min(desiredFps, 15);
      } else if (device.performance === 'medium') {
        const area = canvas.width * canvas.height;
        desiredFps = area > 1280 * 720 ? Math.min(desiredFps, 20) : Math.min(desiredFps, 24);
      } else {
        const area = canvas.width * canvas.height;
        desiredFps = area > 1920 * 1080 ? Math.min(desiredFps, 24) : desiredFps;
      }
      
      console.log(`[AdaptiveStreamManager] Subtitles enabled - adjusted FPS to ${desiredFps} for device performance: ${device.performance}`);
    }
    
    let stream: MediaStream;
    
    if ('captureStream' in canvas) {
      stream = (canvas as any).captureStream(desiredFps);
    } else if ('mozCaptureStream' in canvas) {
      stream = (canvas as any).mozCaptureStream(desiredFps);
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
    
    toast.info(`Canvas streaming started (${desiredFps}fps, compatibility mode)`, { duration: 2000 });
    
    return {
      stream,
      strategy: 'canvas',
      config: { ...config, fps: desiredFps },
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
    const paragraphs = text.split(/\r?\n/);
    
    const sizeMap: Record<string, number> = {
      small: Math.round(h * 0.032),
      medium: Math.round(h * 0.04),
      large: Math.round(h * 0.05),
      xlarge: Math.round(h * 0.06)
    };
    const fontSize = sizeMap[st.style.fontSize] || Math.round(h * 0.04);
    const padX = Math.max(8, Math.round(fontSize * 0.6));
    const padY = Math.max(6, Math.round(fontSize * 0.4));
    const maxTextWidth = Math.floor(w * 0.8); // 80% 캔버스 폭 기준
    
    ctx.font = `${st.style.fontWeight === 'bold' ? 'bold' : 'normal'} ${fontSize}px ${st.style.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    
    // 자동 줄바꿈 적용
    const lines: string[] = [];
    paragraphs.forEach(p => {
      const wrapped = this.wrapTextByWidth(ctx, p, maxTextWidth);
      wrapped.forEach(l => lines.push(l));
    });
    
    if (lines.length === 0) return;
    
    const lineHeight = Math.round(fontSize * 1.3);
    const longest = lines.reduce((a, b) => (ctx.measureText(a).width > ctx.measureText(b).width ? a : b), '');
    const textWidth = Math.min(maxTextWidth, ctx.measureText(longest).width);
    const boxWidth = textWidth + padX * 2;
    const boxHeight = lines.length * lineHeight + padY * 2;
    
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
    
    const x = Math.floor(w / 2);
    const boxX = x - Math.floor(boxWidth / 2);
    const boxY = y - boxHeight;
    
    ctx.fillStyle = this.hexToRgba(st.style.backgroundColor, st.style.backgroundOpacity);
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
   * 텍스트를 지정된 너비에 맞게 자동 줄바꿈하는 헬퍼 메서드
   */
  private wrapTextByWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    
    const lines: string[] = [];
    let current = words[0];
    
    for (let i = 1; i < words.length; i++) {
      const candidate = current + ' ' + words[i];
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    
    lines.push(current);
    return lines;
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