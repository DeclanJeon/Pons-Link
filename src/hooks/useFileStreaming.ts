import { useRef, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { StreamStateManager } from '@/services/streamStateManager';
import { VideoLoader } from '@/services/videoLoader';
import { RecoveryManager } from '@/services/recoveryManager';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { useFileStreamingStore } from '@/stores/useFileStreamingStore';
import { AdaptiveStreamManager } from '@/services/adaptiveStreamManager';
import { subtitleTransport } from '@/services/subtitleTransport';
import { getDeviceInfo, isIOS } from '@/lib/device/deviceDetector';
import { getStrategyDescription } from '@/lib/media/streamingStrategy';
import { createBroadcaster } from '@/services/dataBroadcaster';
import { analytics } from '@/lib/analytics';

interface UseFileStreamingProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  webRTCManager: {
    sendToAllPeers: (data: ArrayBuffer | string) => void;
    replaceSenderTrack: (kind: 'audio' | 'video', track?: MediaStreamTrack) => Promise<boolean>;
  };
  localStream: MediaStream | null;
  peers: Map<string, {
    userId: string;
    nickname: string;
    stream?: MediaStream;
    audioEnabled: boolean;
    videoEnabled: boolean;
    isSharingScreen: boolean;
    connectionState: 'connecting' | 'connected' | 'disconnected' | 'failed';
  }>;
  isStreaming: boolean;
  setIsStreaming: (value: boolean) => void;
  streamQuality: 'low' | 'medium' | 'high';
  fileType: string;
}

interface DebugInfo {
  canvasReady: boolean;
  streamCreated: boolean;
  streamActive: boolean;
  trackCount: number;
  peersConnected: number;
  videoState: string;
  videoTime: number;
  fps: number;
  frameDrops: number;
  audioEnabled: boolean;
  errors: string[];
  isIOS: boolean;
  streamingStrategy: string;
  deviceInfo: string;
  networkQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  averageRTT?: number;
  rttVariance?: number;
  congestionWindow?: number;
  inSlowStart?: boolean;
  bufferedAmount?: number;
  transferSpeed?: number;
  broadcasterBytes?: number;
  sendRate?: number;
}

interface OriginalTrackState {
  video: MediaStreamTrack | null;
  audio: MediaStreamTrack | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
}

export const useFileStreaming = ({
  canvasRef,
  videoRef,
  webRTCManager,
  localStream,
  peers,
  isStreaming,
  setIsStreaming,
  streamQuality,
  fileType
}: UseFileStreamingProps) => {
  const streamRef = useRef<MediaStream | null>(null);
  const fileStreamRef = useRef<MediaStream | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const videoLoadedRef = useRef<boolean>(false);
  const frameCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const originalTracksRef = useRef<OriginalTrackState>({
    video: null,
    audio: null,
    videoEnabled: false,
    audioEnabled: false
  });
  const broadcasterRef = useRef<ReturnType<typeof createBroadcaster> | null>(null);
  const sentBytesRef = useRef<number>(0);
  const lastSentUpdateRef = useRef<number>(Date.now());
  const seqRef = useRef<number>(1);
  const enableFramingRef = useRef<boolean>(false);
  const streamStateManager = useRef(new StreamStateManager());
  const videoLoader = useRef(new VideoLoader());
  const recoveryManager = useRef(new RecoveryManager());
  const adaptiveStreamManager = useRef<AdaptiveStreamManager | null>(null);
  const recoveryAttemptRef = useRef<boolean>(false);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const { saveOriginalMediaState, restoreOriginalMediaState, setFileStreaming } = useMediaDeviceStore();
  const { currentPage, totalPages } = useFileStreamingStore();
  const [videoState, setVideoState] = useState({
    isPaused: true,
    currentTime: 0,
    duration: 0,
    volume: 50,
    isMuted: false
  });
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    canvasReady: false,
    streamCreated: false,
    streamActive: false,
    trackCount: 0,
    peersConnected: 0,
    videoState: 'not loaded',
    videoTime: 0,
    fps: 0,
    frameDrops: 0,
    audioEnabled: false,
    errors: [],
    isIOS: isIOS(),
    streamingStrategy: 'not initialized',
    deviceInfo: '',
    networkQuality: undefined,
    averageRTT: undefined,
    rttVariance: undefined,
    congestionWindow: undefined,
    inSlowStart: undefined,
    bufferedAmount: undefined,
    transferSpeed: undefined,
    broadcasterBytes: 0,
    sendRate: 0
  });

  useEffect(() => {
    const deviceInfo = getDeviceInfo();
    setDebugInfo(prev => ({
      ...prev,
      isIOS: deviceInfo.isIOS,
      deviceInfo: JSON.stringify(deviceInfo, null, 2)
    }));
    if (process.env.NODE_ENV === 'development') {
      console.log('[FileStreaming] Device Info:', deviceInfo);
    }
  }, []);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      const { activeTransfers } = usePeerConnectionStore.getState();
      if (activeTransfers.size > 0) {
        const transfer = Array.from(activeTransfers.values())[0];
        if (transfer && transfer.metrics) {
          updateDebugInfo({
            transferSpeed: transfer.metrics.speed || 0,
            averageRTT: transfer.metrics.averageRTT || 0,
            rttVariance: transfer.metrics.rttVariance || 0,
            congestionWindow: transfer.metrics.congestionWindow || 0,
            inSlowStart: transfer.metrics.inSlowStart || false,
            bufferedAmount: transfer.metrics.bufferedAmount || 0
          });
        }
      }
      const now = Date.now();
      const elapsed = Math.max(0.001, (now - lastSentUpdateRef.current) / 1000);
      const rate = sentBytesRef.current / elapsed;
      updateDebugInfo({
        broadcasterBytes: broadcasterRef.current?.size() ?? 0,
        sendRate: rate
      });
      sentBytesRef.current = 0;
      lastSentUpdateRef.current = now;
    }, 500);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const updateDebugInfo = useCallback((updates: Partial<DebugInfo>) => {
    setDebugInfo(prev => ({ ...prev, ...updates }));
  }, []);

  const logError = useCallback((error: string) => {
    console.error(`[FileStreaming] ${error}`);
    updateDebugInfo({
      errors: [...debugInfo.errors, `${new Date().toLocaleTimeString()}: ${error}`].slice(-5)
    });
  }, [debugInfo.errors, updateDebugInfo]);

  const cleanupObjectUrl = useCallback(() => {
    if (currentObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(currentObjectUrlRef.current);
        currentObjectUrlRef.current = null;
        console.log('[FileStreaming] Object URL cleaned up');
      } catch (error) {
        console.error('[FileStreaming] Failed to clean up object URL', error);
      }
    }
  }, []);

  const getAdaptiveStreamManager = useCallback(() => {
    if (!adaptiveStreamManager.current) {
      adaptiveStreamManager.current = new AdaptiveStreamManager();
      const strategyInfo = adaptiveStreamManager.current.getInfo();
      setDebugInfo(prev => ({
        ...prev,
        streamingStrategy: strategyInfo.strategy.strategy
      }));
      if (process.env.NODE_ENV === 'development') {
        console.log('[FileStreaming] AdaptiveStreamManager initialized');
        console.log('[FileStreaming] Strategy:', getStrategyDescription(strategyInfo.strategy));
      }
      if (strategyInfo.device.isIOS) {
        toast.info('iOS device detected - Using optimized streaming', { duration: 3000 });
      }
    }
    return adaptiveStreamManager.current;
  }, []);

  const handleFileSelect = useCallback(async (
    file: File,
    setSelectedFile: (file: File) => void,
    setFileType: (type: string) => void
  ) => {
    try {
      if (isStreaming) {
        await stopStreaming();
      }
      videoLoadedRef.current = false;
      cleanupObjectUrl();
      setSelectedFile(file);
      if (file.type.startsWith('video/')) {
        setFileType('video');
        if (!videoRef?.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await loadVideoWithRecovery(file);
      } else if (file.type === 'application/pdf') {
        setFileType('pdf');
        await loadPDF(file);
      } else if (file.type.startsWith('image/')) {
        setFileType('image');
        await loadImage(file);
      } else {
        setFileType('other');
        await loadGenericFile(file);
      }
      toast.success(`File loaded: ${file.name}`);
      updateDebugInfo({ canvasReady: true });
    } catch (error) {
      logError(`Failed to load file: ${error}`);
      const result = await recoveryManager.current.handleFileLoadFailure(error as Error, file);
      if (result.suggestion) {
        toast.error(result.suggestion);
      } else {
        toast.error('Failed to load file');
      }
    }
  }, [isStreaming, videoRef, cleanupObjectUrl, updateDebugInfo, logError]);

  const loadVideoWithRecovery = useCallback(async (file: File) => {
    if (!videoRef?.current) {
      logError('Video element not found - videoRef is null or undefined');
      toast.error('Video player not initialized');
      return;
    }
    const validation = VideoLoader.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    try {
      const url = URL.createObjectURL(file);
      currentObjectUrlRef.current = url;
      const video = videoRef.current;
      video.src = url;
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video load timeout'));
        }, 10000);
        const handleLoadedData = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadeddata', handleLoadedData);
          video.removeEventListener('error', handleError);
          resolve(true);
        };
        const handleError = () => {
          clearTimeout(timeout);
          video.removeEventListener('loadeddata', handleLoadedData);
          video.removeEventListener('error', handleError);
          reject(new Error('Failed to load video'));
        };
        video.addEventListener('loadeddata', handleLoadedData);
        video.addEventListener('error', handleError);
        video.load();
      });
      videoLoadedRef.current = true;
      updateDebugInfo({
        videoState: 'ready',
        videoTime: 0,
        canvasReady: true
      });
    } catch (error) {
      logError(`Failed to load video: ${error}`);
      cleanupObjectUrl();
      throw error;
    }
  }, [videoRef, logError, updateDebugInfo, cleanupObjectUrl]);

  const loadPDF = useCallback(async (file: File) => {
    try {
      updateDebugInfo({ canvasReady: true });
    } catch (error) {
      logError(`Failed to load PDF: ${error}`);
      throw error;
    }
  }, [updateDebugInfo, logError]);

  const loadImage = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = (e) => reject(new Error(`Failed to load image: ${e.toString()}`));
        img.src = url;
      });
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const maxWidth = 1920;
        const maxHeight = 1080;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
      }
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [canvasRef]);

  const loadGenericFile = useCallback(async (file: File) => {
    if (file.type.startsWith('text/')) {
      const text = await file.text();
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = 1280;
        canvas.height = 720;
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = 'black';
          ctx.font = '16px monospace';
          const lines = text.split('\n').slice(0, 30);
          lines.forEach((line, index) => {
            ctx.fillText(line.substring(0, 100), 10, 30 + index * 20);
          });
        }
      }
    } else {
      toast.warning('This file type cannot be directly streamed.');
    }
  }, [canvasRef]);

  const wrapChunk = useCallback((seq: number, buffer: ArrayBuffer) => {
    if (!enableFramingRef.current) return buffer;
    const header = new ArrayBuffer(13);
    const view = new DataView(header);
    view.setUint8(0, 9);
    view.setUint32(1, seq);
    view.setFloat64(5, Date.now());
    const out = new Uint8Array(header.byteLength + buffer.byteLength);
    out.set(new Uint8Array(header), 0);
    out.set(new Uint8Array(buffer), header.byteLength);
    return out.buffer;
  }, []);

  const startStreaming = useCallback(async (file: File) => {
    if (!webRTCManager) {
      toast.error('WebRTC Manager not initialized');
      return;
    }
    try {
      analytics.feature('file_streaming_start');
      saveOriginalMediaState();
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        const audioTrack = localStream.getAudioTracks()[0];
        originalTracksRef.current = {
          video: videoTrack || null,
          audio: audioTrack || null,
          videoEnabled: videoTrack?.enabled || false,
          audioEnabled: audioTrack?.enabled || false
        };
      }
      const mediaDeviceState = useMediaDeviceStore.getState();
      streamStateManager.current.captureState(localStream, {
        isAudioEnabled: mediaDeviceState.isAudioEnabled,
        isVideoEnabled: mediaDeviceState.isVideoEnabled,
        isSharingScreen: mediaDeviceState.isSharingScreen
      });
      setFileStreaming(true);
      enableFramingRef.current = true;
      broadcasterRef.current = createBroadcaster(
        (data) => {
          webRTCManager.sendToAllPeers(data);
        },
        { maxBytesPerSec: 6291456, burstBytes: 262144, tickMs: 16, maxQueueBytes: 52428800 },
        (bytes) => {
          sentBytesRef.current += bytes;
        }
      );
      const manager = getAdaptiveStreamManager();
      if (fileType === 'video' && videoRef.current) {
        const video = videoRef.current;
        if (video.readyState < 3) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Video load timeout')), 10000);
            video.addEventListener('canplay', () => {
              clearTimeout(timeout);
              resolve(true);
            }, { once: true });
          });
        }
        const embedSubtitles = useSubtitleStore.getState().isEnabled;
        const result = await manager.createStream(
          video,
          (blob, timestamp) => {
            blob.arrayBuffer().then(buffer => {
              const seq = seqRef.current++;
              const framed = wrapChunk(seq, buffer);
              broadcasterRef.current?.enqueue(framed);
            });
          },
          { embedSubtitles }
        );
        streamCleanupRef.current = result.cleanup;
        fileStreamRef.current = result.stream;
        streamRef.current = result.stream;
        updateDebugInfo({
          streamCreated: true,
          trackCount: result.stream.getTracks().length,
          streamActive: result.stream.getTracks().some(t => t.readyState === 'live'),
          peersConnected: peers.size,
          streamingStrategy: result.strategy,
          fps: result.config.fps
        });
        const { activeTransfers } = usePeerConnectionStore.getState();
        if (activeTransfers.size > 0) {
          const transfer = Array.from(activeTransfers.values())[0];
          if (transfer && transfer.metrics) {
            updateDebugInfo({
              transferSpeed: transfer.metrics.speed || 0,
              averageRTT: transfer.metrics.averageRTT || 0,
              rttVariance: transfer.metrics.rttVariance || 0,
              congestionWindow: transfer.metrics.congestionWindow || 0,
              inSlowStart: transfer.metrics.inSlowStart || false,
              bufferedAmount: transfer.metrics.bufferedAmount || 0
            });
          }
        }
        if (video.paused) {
          await video.play();
          setVideoState(prev => ({ ...prev, isPaused: false }));
        }
        if (result.strategy !== 'mediarecorder') {
          await replaceStreamTracksForFileStreaming(result.stream);
        }
      } else if ((fileType === 'pdf' || fileType === 'image') && canvasRef.current) {
        const canvas = canvasRef.current;
        if (canvas.width === 0 || canvas.height === 0) {
          throw new Error('Canvas is not ready for streaming');
        }
        const result = await manager.createStaticStream(canvas, (blob, timestamp) => {
          blob.arrayBuffer().then(buffer => {
            const seq = seqRef.current++;
            const framed = wrapChunk(seq, buffer);
            broadcasterRef.current?.enqueue(framed);
          });
        });
        streamCleanupRef.current = result.cleanup;
        fileStreamRef.current = result.stream;
        streamRef.current = result.stream;
        updateDebugInfo({
          streamCreated: true,
          trackCount: result.stream.getTracks().length,
          streamActive: result.stream.getTracks().some(t => t.readyState === 'live'),
          peersConnected: peers.size,
          streamingStrategy: result.strategy,
          fps: result.config.fps,
          isIOS: getDeviceInfo().isIOS,
          deviceInfo: JSON.stringify(getDeviceInfo())
        });
        if (result.strategy !== 'mediarecorder') {
          await replaceStreamTracksForFileStreaming(result.stream);
        }
        const { sendToAllPeers } = usePeerConnectionStore.getState();
        sendToAllPeers(JSON.stringify({
          type: 'pdf-metadata',
          payload: {
            currentPage,
            totalPages,
            fileName: file.name
          }
        }));
        toast.success(`${fileType === 'pdf' ? 'PDF' : 'Image'} streaming started (${result.config.fps}fps)`, { duration: 3000 });
      }
      setIsStreaming(true);
    } catch (error) {
      logError(`Failed to start streaming: ${error}`);
      toast.error(`Streaming failed: ${error}`);
      await restoreOriginalMediaState();
      setFileStreaming(false);
    }
  }, [fileType, webRTCManager, localStream, peers, canvasRef, videoRef, getAdaptiveStreamManager, currentPage, totalPages, saveOriginalMediaState, setFileStreaming, setIsStreaming, updateDebugInfo, logError, restoreOriginalMediaState, wrapChunk]);

  const lastPdfSignalRef = useRef<{ page: number; time: number } | null>(null);

  const updateStream = useCallback(() => {
    if (!isStreaming) return;
    const manager = getAdaptiveStreamManager();
    manager.forceStreamUpdate();
    if (fileType === 'pdf') {
      const now = Date.now();
      const last = lastPdfSignalRef.current;
      const shouldSend = !last || last.page !== currentPage || now - last.time > 300;
      if (shouldSend) {
        const { sendToAllPeers } = usePeerConnectionStore.getState();
        sendToAllPeers(JSON.stringify({
          type: 'pdf-page-change',
          payload: {
            currentPage,
            totalPages,
            timestamp: now
          }
        }));
        lastPdfSignalRef.current = { page: currentPage, time: now };
      }
    }
  }, [isStreaming, fileType, getAdaptiveStreamManager, currentPage, totalPages]);

  const replaceStreamTracksForFileStreaming = useCallback(async (newStream: MediaStream) => {
    if (!localStream || !webRTCManager) return;
    const newVideoTrack = newStream.getVideoTracks()[0];
    const newAudioTrack = newStream.getAudioTracks()[0];
    try {
      if (newVideoTrack) {
        const originalVideoTrack = localStream.getVideoTracks()[0];
        if (originalVideoTrack) {
          localStream.removeTrack(originalVideoTrack);
          if (originalVideoTrack.readyState === 'live') originalVideoTrack.stop();
        }
        localStream.addTrack(newVideoTrack);
        newVideoTrack.enabled = true;
        await webRTCManager.replaceSenderTrack('video', newVideoTrack);
      }
      if (newAudioTrack) {
        const originalAudioTrack = localStream.getAudioTracks()[0];
        if (originalAudioTrack) {
          localStream.removeTrack(originalAudioTrack);
          if (originalAudioTrack.readyState === 'live') originalAudioTrack.stop();
        }
        localStream.addTrack(newAudioTrack);
        newAudioTrack.enabled = true;
        await webRTCManager.replaceSenderTrack('audio', newAudioTrack);
      }
    } catch (error) {
      console.error('[FileStreaming] Error replacing tracks:', error);
      throw error;
    }
  }, [localStream, webRTCManager]);

  const stopStreaming = useCallback(async () => {
    try {
      analytics.feature('file_streaming_stop');
      if (videoRef.current && fileType === 'video') {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setVideoState(prev => ({ ...prev, isPaused: true, currentTime: 0 }));
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
        streamCleanupRef.current = null;
      }
      if (adaptiveStreamManager.current) {
        adaptiveStreamManager.current.cleanup();
      }
      if (fileStreamRef.current) {
        fileStreamRef.current.getTracks().forEach(track => {
          if (track.readyState === 'live') track.stop();
        });
        fileStreamRef.current = null;
      }
      broadcasterRef.current?.stop();
      broadcasterRef.current = null;
      const storeRestored = await restoreOriginalMediaState();
      if (!storeRestored) {
        toast.error('Failed to restore camera/microphone state. Please re-enable manually.');
      }
      setFileStreaming(false);
      setIsStreaming(false);
      originalTracksRef.current = {
        video: null,
        audio: null,
        videoEnabled: false,
        audioEnabled: false
      };
      updateDebugInfo({
        streamCreated: false,
        streamActive: false,
        trackCount: 0,
        audioEnabled: false,
        broadcasterBytes: 0,
        sendRate: 0
      });
      toast.info('File streaming stopped.');
    } catch (error) {
      logError(`Error during stop streaming: ${error}`);
      toast.error('Error stopping stream. Please refresh the page.');
      setFileStreaming(false);
      setIsStreaming(false);
    }
  }, [fileType, setIsStreaming, updateDebugInfo, setVideoState, restoreOriginalMediaState, setFileStreaming, logError]);

  const cleanupResources = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    cleanupObjectUrl();
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
      streamCleanupRef.current = null;
    }
    if (adaptiveStreamManager.current) {
      adaptiveStreamManager.current.cleanup();
      adaptiveStreamManager.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (fileStreamRef.current) {
      fileStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      fileStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
    broadcasterRef.current?.stop();
    broadcasterRef.current = null;
    videoLoadedRef.current = false;
    frameCountRef.current = 0;
    streamStateManager.current.reset();
    recoveryManager.current.reset();
    originalTracksRef.current = {
      video: null,
      audio: null,
      videoEnabled: false,
      audioEnabled: false
    };
  }, [cleanupObjectUrl, canvasRef, videoRef]);

  useEffect(() => {
    return () => {
      if (isStreaming) {
        stopStreaming();
      }
      cleanupResources();
    };
  }, []);

  return {
    debugInfo,
    videoState,
    handleFileSelect,
    startStreaming,
    stopStreaming,
    updateStream,
    updateDebugInfo,
    cleanupResources
  };
};
