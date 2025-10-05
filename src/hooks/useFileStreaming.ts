/**
 * @fileoverview 파일 스트리밍 Hook - iOS 최적화 및 자막 브로드캐스트
 * @module hooks/useFileStreaming
 * @description 파일 선택, 스트림 생성, 중지 등 파일 스트리밍 관련 로직을 관리합니다.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { StreamStateManager } from '@/services/streamStateManager';
import { VideoLoader } from '@/services/videoLoader';
import { RecoveryManager } from '@/services/recoveryManager';
import { useMediaDeviceStore } from '@/stores/useMediaDeviceStore';
import { useSubtitleStore } from '@/stores/useSubtitleStore';
import { usePeerConnectionStore } from '@/stores/usePeerConnectionStore';
import { AdaptiveStreamManager } from '@/services/adaptiveStreamManager';
import { getDeviceInfo, isIOS } from '@/lib/deviceDetector';
import { getStrategyDescription } from '@/lib/streamingStrategy';

interface UseFileStreamingProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoRef: React.RefObject<HTMLVideoElement>;
  webRTCManager: any;
  localStream: MediaStream | null;
  peers: Map<string, any>;
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
  // Refs
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
  
  // Managers
  const streamStateManager = useRef(new StreamStateManager());
  const videoLoader = useRef(new VideoLoader());
  const recoveryManager = useRef(new RecoveryManager());
  const adaptiveStreamManager = useRef<AdaptiveStreamManager | null>(null);
  
  const recoveryAttemptRef = useRef<boolean>(false);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  
  // Stores
  const { 
    saveOriginalMediaState, 
    restoreOriginalMediaState, 
    setFileStreaming 
  } = useMediaDeviceStore();
  
  // State
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
    deviceInfo: ''
  });
  
  /**
   * 디바이스 정보 감지 및 초기화
   */
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
  
  // FPS 측정
  useEffect(() => {
    if (!isStreaming) return;
    
    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastFrameTimeRef.current;
      
      if (elapsed > 0) {
        const fps = Math.round((frameCountRef.current / elapsed) * 1000);
        setDebugInfo(prev => ({ ...prev, fps }));
      }
      
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;
    }, 1000);
    
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
      URL.revokeObjectURL(currentObjectUrlRef.current);
      currentObjectUrlRef.current = null;
      console.log('[FileStreaming] Object URL cleaned up');
    }
  }, []);

  /**
   * AdaptiveStreamManager Lazy Initialization
   */
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

  /**
   * 파일 선택 처리
   */
  const handleFileSelect = async (
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
          console.log('[FileStreaming] Waiting for video element to be ready...');
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
      
      const result = await recoveryManager.current.handleFileLoadFailure(
        error as Error,
        file
      );
      
      if (result.suggestion) {
        toast.error(result.suggestion);
      } else {
        toast.error('Failed to load file');
      }
    }
  };

  /**
   * 비디오 로드 (복구 메커니즘 포함)
   */
  const loadVideoWithRecovery = async (file: File) => {
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
        const handleLoadedData = () => {
          video.removeEventListener('loadeddata', handleLoadedData);
          video.removeEventListener('error', handleError);
          resolve(true);
        };
        
        const handleError = () => {
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
      
      console.log('[FileStreaming] Video loaded successfully');
    } catch (error) {
      logError(`Failed to load video: ${error}`);
      throw error;
    }
  };
  
  const loadPDF = async (file: File) => {
    try {
      updateDebugInfo({ canvasReady: true });
    } catch (error) {
      logError(`Failed to load PDF: ${error}`);
      throw error;
    }
  };
  
  const loadImage = async (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
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
    
    URL.revokeObjectURL(url);
  };
  
  const loadGenericFile = async (file: File) => {
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
            ctx.fillText(line.substring(0, 100), 10, 30 + (index * 20));
          });
        }
      }
    } else {
      toast.warning('This file type cannot be directly streamed.');
    }
  };

  /**
   * 스트리밍 시작 시 자막 브로드캐스트
   */
  const broadcastSubtitlesOnStreamStart = useCallback(() => {
    const { tracks, activeTrackId, broadcastTrack, broadcastSubtitleState } = useSubtitleStore.getState();
    
    if (activeTrackId && tracks.has(activeTrackId)) {
      console.log('[FileStreaming] Broadcasting active subtitle track on stream start');
      
      broadcastTrack(activeTrackId);
      broadcastSubtitleState();
      
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      const enablePacket = {
        type: 'subtitle-remote-enable',
        payload: {
          trackId: activeTrackId,
          enabled: true
        }
      };
      
      sendToAllPeers(JSON.stringify(enablePacket));
      
      toast.success('Subtitle track shared with participants', { duration: 2000 });
    } else {
      console.log('[FileStreaming] No active subtitle track to broadcast');
    }
  }, []);

  /**
   * 스트리밍 시작 (iOS 최적화)
   */
  const startStreaming = useCallback(async (file: File) => {
    if (!webRTCManager) {
      toast.error('WebRTC Manager not initialized');
      return;
    }
    
    try {
      console.log('[FileStreaming] Starting streaming with adaptive strategy...');
      
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
        
        console.log('[FileStreaming] Saved original tracks');
      }
      
      const mediaDeviceState = useMediaDeviceStore.getState();
      streamStateManager.current.captureState(localStream, {
        isAudioEnabled: mediaDeviceState.isAudioEnabled,
        isVideoEnabled: mediaDeviceState.isVideoEnabled,
        isSharingScreen: mediaDeviceState.isSharingScreen
      });
      
      setFileStreaming(true);
      
      console.log('[FileStreaming] Original state saved, preparing adaptive stream...');
      
      const manager = getAdaptiveStreamManager();
      
      if (fileType === 'video' && videoRef.current) {
        const video = videoRef.current;
        
        if (video.readyState < 3) {
          console.log('[FileStreaming] Waiting for video to be ready...');
          
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Video load timeout'));
            }, 10000);
            
            const checkReady = () => {
              if (video.readyState >= 3) {
                clearTimeout(timeout);
                clearInterval(checkInterval);
                resolve(true);
              }
            };
            
            video.addEventListener('canplay', () => {
              clearTimeout(timeout);
              clearInterval(checkInterval);
              resolve(true);
            }, { once: true });
            
            const checkInterval = setInterval(checkReady, 100);
            checkReady();
          });
        }
        
        console.log('[FileStreaming] Video is ready, creating adaptive stream...');
        
        const result = await manager.createStream(
          video,
          (blob, timestamp) => {
            blob.arrayBuffer().then(buffer => {
              const { sendToAllPeers } = webRTCManager;
              sendToAllPeers(buffer);
            });
          }
        );
        
        streamCleanupRef.current = result.cleanup;
        fileStreamRef.current = result.stream;
        streamRef.current = result.stream;
        
        console.log(`[FileStreaming] Stream created with strategy: ${result.strategy}`);
        
        updateDebugInfo({
          streamCreated: true,
          trackCount: result.stream.getTracks().length,
          streamActive: result.stream.getTracks().some(t => t.readyState === 'live'),
          peersConnected: peers.size,
          streamingStrategy: result.strategy,
          fps: result.config.fps
        });
        
        if (video.paused) {
          try {
            await video.play();
            setVideoState(prev => ({ ...prev, isPaused: false }));
            console.log('[FileStreaming] Video playback started');
          } catch (playError) {
            console.warn('[FileStreaming] Auto-play failed:', playError);
            toast.warning('Please click play to start streaming');
          }
        }
        
        if (result.strategy !== 'mediarecorder') {
          await replaceStreamTracksForFileStreaming(result.stream);
        }
        
        broadcastSubtitlesOnStreamStart();
        
      } else if (canvasRef.current) {
        const result = await manager.createStream(
          document.createElement('video')
        );
        
        streamCleanupRef.current = result.cleanup;
        fileStreamRef.current = result.stream;
        streamRef.current = result.stream;
        
        await replaceStreamTracksForFileStreaming(result.stream);
        
        broadcastSubtitlesOnStreamStart();
      }
      
      setIsStreaming(true);
      
      if (isIOS()) {
        toast.success('File streaming started (iOS optimized)', { duration: 3000 });
      } else {
        toast.success('Started file streaming');
      }
      
    } catch (error) {
      logError(`Failed to start streaming: ${error}`);
      toast.error(`Streaming failed: ${error}`);
      
      await restoreOriginalMediaState();
      setFileStreaming(false);
      
      if (!recoveryAttemptRef.current) {
        recoveryAttemptRef.current = true;
        
        setTimeout(() => {
          recoveryAttemptRef.current = false;
        }, 5000);
        
        if (fileType === 'video' && videoRef.current) {
          console.log('[FileStreaming] Attempting video reload...');
          videoRef.current.load();
          setTimeout(() => {
            startStreaming(file);
          }, 1000);
        }
      }
    }
  }, [fileType, streamQuality, webRTCManager, localStream, peers, setIsStreaming, updateDebugInfo, setVideoState, saveOriginalMediaState, restoreOriginalMediaState, setFileStreaming, getAdaptiveStreamManager, broadcastSubtitlesOnStreamStart]);

  /**
   * 스트림 트랙 교체
   */
  const replaceStreamTracksForFileStreaming = async (newStream: MediaStream) => {
    if (!localStream || !webRTCManager) return;
    
    const newVideoTrack = newStream.getVideoTracks()[0];
    const newAudioTrack = newStream.getAudioTracks()[0];
    
    if (newVideoTrack) {
      const originalVideoTrack = localStream.getVideoTracks()[0];
      
      if (originalVideoTrack) {
        webRTCManager.replaceTrack(originalVideoTrack, newVideoTrack, localStream);
        localStream.removeTrack(originalVideoTrack);
        localStream.addTrack(newVideoTrack);
      } else {
        localStream.addTrack(newVideoTrack);
        webRTCManager.addTrackToAllPeers(newVideoTrack, localStream);
      }
      
      newVideoTrack.enabled = true;
      console.log('[FileStreaming] File streaming video track replaced and enabled');
    }
    
    if (newAudioTrack) {
      const originalAudioTrack = localStream.getAudioTracks()[0];
      
      if (originalAudioTrack) {
        webRTCManager.replaceTrack(originalAudioTrack, newAudioTrack, localStream);
        localStream.removeTrack(originalAudioTrack);
        localStream.addTrack(newAudioTrack);
      } else {
        localStream.addTrack(newAudioTrack);
        webRTCManager.addTrackToAllPeers(newAudioTrack, localStream);
      }
      
      newAudioTrack.enabled = true;
      console.log('[FileStreaming] File streaming audio track replaced and enabled');
    }
  };

  /**
   * 스트리밍 중지
   */
  const stopStreaming = useCallback(async () => {
    console.log('[FileStreaming] Stopping stream with state restoration...');
    
    try {
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
          if (track.readyState === 'live') {
            track.stop();
          }
        });
        fileStreamRef.current = null;
      }
      
      console.log('[FileStreaming] Restoring MediaDeviceStore state...');
      const storeRestored = await restoreOriginalMediaState();
      
      if (!storeRestored) {
        console.error('[FileStreaming] Failed to restore MediaDeviceStore state');
        toast.error('카메라/마이크로 복구하는 데 실패했습니다. 페이지를 새로고침해주세요.');
      } else {
        console.log('[FileStreaming] MediaDeviceStore state restored successfully');
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
        audioEnabled: false
      });
      
      toast.info('파일 스트리밍이 종료되었습니다.');
      
    } catch (error) {
      logError(`Error during stop streaming: ${error}`);
      toast.error('Error stopping stream. Please refresh the page.');
      
      setFileStreaming(false);
      setIsStreaming(false);
    }
  }, [fileType, setIsStreaming, updateDebugInfo, setVideoState, restoreOriginalMediaState, setFileStreaming]);

  /**
   * 리소스 정리
   */
  const cleanupResources = useCallback(() => {
    console.log('[FileStreaming] Cleaning up resources...');
    
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
    
    console.log('[FileStreaming] Resource cleanup completed');
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
    updateDebugInfo,
    cleanupResources
  };
};
