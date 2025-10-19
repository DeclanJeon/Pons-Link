import { create } from 'zustand';
import { deviceManager } from '@/services/deviceManager';
import { DeviceInfo } from '@/lib/deviceUtils';
import { usePeerConnectionStore } from './usePeerConnectionStore';
import { useSignalingStore } from './useSignalingStore';
import { toast } from 'sonner';
import { StreamStateManager } from '@/services/streamStateManager';
import { useUIManagementStore } from './useUIManagementStore';
import { useSessionStore } from './useSessionStore';

interface ScreenShareResources {
  screenVideoEl: HTMLVideoElement | null;
  cameraVideoEl: HTMLVideoElement | null;
  audioContext: AudioContext | null;
  animationFrameId: number | null;
}

/**
 * 파일 스트리밍 전 원본 미디어 상태
 */
interface OriginalMediaState {
  stream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSharingScreen: boolean;
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
}

interface MediaDeviceState {
  localStream: MediaStream | null;
  audioInputs: DeviceInfo[];
  videoInputs: DeviceInfo[];
  audioOutputs: DeviceInfo[];
  selectedAudioDeviceId: string;
  selectedVideoDeviceId: string;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSharingScreen: boolean;
  originalStream: MediaStream | null;
  isMobile: boolean;
  hasMultipleCameras: boolean;
  isChangingDevice: boolean;
  streamStateManager: StreamStateManager;
  includeCameraInScreenShare: boolean;
  screenShareResources: ScreenShareResources | null;
  
  // 파일 스트리밍 관련
  isFileStreaming: boolean;
  originalMediaState: OriginalMediaState | null;
}

interface MediaDeviceActions {
  initialize: () => Promise<void>;
  changeAudioDevice: (deviceId: string) => Promise<void>;
  changeVideoDevice: (deviceId: string) => Promise<void>;
  switchCamera: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  setIncludeCameraInScreenShare: (include: boolean) => void;
  cleanup: () => void;
  
  // 파일 스트리밍 관련
  saveOriginalMediaState: () => void;
  restoreOriginalMediaState: () => Promise<boolean>;
  setFileStreaming: (isStreaming: boolean) => void;
}

export const useMediaDeviceStore = create<MediaDeviceState & MediaDeviceActions>((set, get) => ({
  localStream: null,
  audioInputs: [],
  videoInputs: [],
  audioOutputs: [],
  selectedAudioDeviceId: '',
  selectedVideoDeviceId: '',
  isAudioEnabled: true,
  isVideoEnabled: true,
  isSharingScreen: false,
  originalStream: null,
  isMobile: false,
  hasMultipleCameras: false,
  isChangingDevice: false,
  streamStateManager: new StreamStateManager(),
  includeCameraInScreenShare: false,
  screenShareResources: null,
  
  // 파일 스트리밍 관련
  isFileStreaming: false,
  originalMediaState: null,

  initialize: async () => {
    console.log('[MediaDeviceStore] Initializing...');
    try {
      await deviceManager.initialize();
      const stream = deviceManager.getCurrentStream();
      const devices = deviceManager.getDevices();
      const selected = deviceManager.getSelectedDevices();
      set({
        localStream: stream,
        audioInputs: devices.audioInputs,
        videoInputs: devices.videoInputs,
        audioOutputs: devices.audioOutputs,
        selectedAudioDeviceId: selected.audioDeviceId,
        selectedVideoDeviceId: selected.videoDeviceId,
        isMobile: deviceManager.isMobile,
        hasMultipleCameras: devices.videoInputs.length > 1,
      });
      deviceManager.onDeviceChange(() => {
        const updatedDevices = deviceManager.getDevices();
        set({
          audioInputs: updatedDevices.audioInputs,
          videoInputs: updatedDevices.videoInputs,
          audioOutputs: updatedDevices.audioOutputs,
          hasMultipleCameras: updatedDevices.videoInputs.length > 1,
        });
      });
      console.log('[MediaDeviceStore] Initialized successfully');
    } catch (error) {
      console.error('[MediaDeviceStore] Initialization failed:', error);
      toast.error('Unable to initialize media devices.');
    }
  },

  changeAudioDevice: async (deviceId: string) => {
    if (get().isChangingDevice) return;
    set({ isChangingDevice: true });
    try {
      const newStream = await deviceManager.changeAudioDevice(deviceId);
      const { webRTCManager } = usePeerConnectionStore.getState();
      if (webRTCManager) {
        await webRTCManager.replaceLocalStream(newStream);
      }
      set({ localStream: newStream, selectedAudioDeviceId: deviceId });
      useSignalingStore.getState().updateMediaState({ kind: 'audio', enabled: get().isAudioEnabled });
      toast.success('Microphone changed successfully.');
    } catch (error) {
      console.error('[MediaDeviceStore] Failed to change audio device:', error);
      toast.error('Failed to change microphone.');
    } finally {
      set({ isChangingDevice: false });
    }
  },

  changeVideoDevice: async (deviceId: string) => {
    if (get().isChangingDevice) return;
    set({ isChangingDevice: true });
    try {
      const newStream = await deviceManager.changeVideoDevice(deviceId);
      const { webRTCManager } = usePeerConnectionStore.getState();
      if (webRTCManager) {
        await webRTCManager.replaceLocalStream(newStream);
      }
      set({ localStream: newStream, selectedVideoDeviceId: deviceId });
      useSignalingStore.getState().updateMediaState({ kind: 'video', enabled: get().isVideoEnabled });
      toast.success('Camera changed successfully.');
    } catch (error) {
      console.error('[MediaDeviceStore] Failed to change video device:', error);
      toast.error('Failed to change camera.');
    } finally {
      set({ isChangingDevice: false });
    }
  },

  switchCamera: async () => {
    if (!get().isMobile || get().isChangingDevice) return;
    set({ isChangingDevice: true });
    try {
      const newStream = await deviceManager.switchCamera();
      const { webRTCManager } = usePeerConnectionStore.getState();
      if (webRTCManager) {
        await webRTCManager.replaceLocalStream(newStream);
      }
      const selected = deviceManager.getSelectedDevices();
      set({ localStream: newStream, selectedVideoDeviceId: selected.videoDeviceId });
      toast.success('Camera switched successfully.', { duration: 1500 });
    } catch (error) {
      console.error('[MediaDeviceStore] Failed to switch camera:', error);
      toast.error('Failed to switch camera.');
    } finally {
      set({ isChangingDevice: false });
    }
  },

  toggleAudio: () => {
    const { localStream, isAudioEnabled } = get();
    const newState = !isAudioEnabled;
    localStream?.getAudioTracks().forEach(track => { track.enabled = newState; });
    set({ isAudioEnabled: newState });
    useSignalingStore.getState().updateMediaState({ kind: 'audio', enabled: newState });
  },

  toggleVideo: () => {
    const { localStream, isVideoEnabled } = get();
    const newState = !isVideoEnabled;
    localStream?.getVideoTracks().forEach(track => { track.enabled = newState; });
    set({ isVideoEnabled: newState });
    useSignalingStore.getState().updateMediaState({ kind: 'video', enabled: newState });
  },
  
  toggleScreenShare: async () => {
    const { isSharingScreen } = get();
    if (isSharingScreen) {
      await get().stopScreenShare();
    } else {
      await get().startScreenShare();
    }
  },

  startScreenShare: async () => {
    const { localStream, streamStateManager, includeCameraInScreenShare } = get();
    const { webRTCManager } = usePeerConnectionStore.getState();
    const { setMainContentParticipant } = useUIManagementStore.getState();
    const localUserId = useSessionStore.getState().userId;

    if (!localStream || !webRTCManager || !localUserId) return;

    streamStateManager.captureState(localStream);
    set({ originalStream: localStream });

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true
      } as DisplayMediaStreamOptions);

      setMainContentParticipant(localUserId);
      
      const screenVideoEl = document.createElement("video");
      const cameraVideoEl = document.createElement("video");
      const audioContext = new AudioContext();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context could not be created.");

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const { width, height } = screenVideoTrack.getSettings();
      canvas.width = width || 1920;
      canvas.height = height || 1080;

      screenVideoEl.srcObject = new MediaStream([screenVideoTrack]);
      screenVideoEl.muted = true;
      await screenVideoEl.play();

      if (includeCameraInScreenShare) {
        cameraVideoEl.srcObject = localStream;
        cameraVideoEl.muted = true;
        await cameraVideoEl.play();
      }
      
      let animationFrameId: number;
      const drawLoop = () => {
        if (!get().isSharingScreen) {
            cancelAnimationFrame(animationFrameId);
            return;
        }
        ctx.drawImage(screenVideoEl, 0, 0, canvas.width, canvas.height);
        if (get().includeCameraInScreenShare) {
            const pipWidth = canvas.width * 0.2;
            const pipHeight = cameraVideoEl.videoHeight ? (cameraVideoEl.videoHeight / cameraVideoEl.videoWidth) * pipWidth : (pipWidth / 16) * 9;
            ctx.drawImage(cameraVideoEl, canvas.width - pipWidth - 20, canvas.height - pipHeight - 20, pipWidth, pipHeight);
        }
        animationFrameId = requestAnimationFrame(drawLoop);
      };

      const destination = audioContext.createMediaStreamDestination();
      if (screenStream.getAudioTracks().length > 0) {
        audioContext.createMediaStreamSource(screenStream).connect(destination);
      }
      if (localStream.getAudioTracks().length > 0) {
        audioContext.createMediaStreamSource(localStream).connect(destination);
      }
      
      const finalStream = new MediaStream([
        ...canvas.captureStream().getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      set({
        screenShareResources: { screenVideoEl, cameraVideoEl, audioContext, animationFrameId: null }
      });
      
      await webRTCManager.replaceLocalStream(finalStream);
      set({ isSharingScreen: true, localStream: finalStream });
      drawLoop();

      screenVideoTrack.onended = () => get().stopScreenShare();
      
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      sendToAllPeers(JSON.stringify({ type: 'screen-share-state', payload: { isSharing: true } }));
      toast.success("Screen sharing started successfully.");

    } catch (error) {
      console.error("Screen sharing failed:", error);
      if ((error as Error).name !== 'NotAllowedError') {
        toast.error("Unable to start screen sharing.");
      }
      set({ originalStream: null });
      setMainContentParticipant(null);
    }
  },

  stopScreenShare: async () => {
    const { originalStream, localStream: currentScreenStream, screenShareResources } = get();
    const { webRTCManager } = usePeerConnectionStore.getState();
    const { setMainContentParticipant } = useUIManagementStore.getState();

    if (!originalStream || !webRTCManager) return;
    
    if (screenShareResources) {
        if (screenShareResources.animationFrameId) {
            cancelAnimationFrame(screenShareResources.animationFrameId);
        }
        if (screenShareResources.screenVideoEl) {
            screenShareResources.screenVideoEl.srcObject = null;
        }
        if (screenShareResources.cameraVideoEl) {
            screenShareResources.cameraVideoEl.srcObject = null;
        }
        if (screenShareResources.audioContext && screenShareResources.audioContext.state !== 'closed') {
            await screenShareResources.audioContext.close();
        }
        set({ screenShareResources: null });
    }
    
    currentScreenStream?.getTracks().forEach(track => track.stop());

    await webRTCManager.replaceLocalStream(originalStream);
    
    set({ isSharingScreen: false, localStream: originalStream, originalStream: null });
    setMainContentParticipant(null);

    const { sendToAllPeers } = usePeerConnectionStore.getState();
    sendToAllPeers(JSON.stringify({ type: 'screen-share-state', payload: { isSharing: false } }));
    toast.info("Screen sharing stopped.");
  },

  setIncludeCameraInScreenShare: (include) => set({ includeCameraInScreenShare: include }),

  /**
   * 파일 스트리밍 전 원본 미디어 상태 저장
   * 파일 스트리밍 종료 시 복원하기 위함
   */
  saveOriginalMediaState: () => {
    const state = get();
    
    console.log('[MediaDeviceStore] Saving original media state...');
    
    const originalState: OriginalMediaState = {
      stream: state.localStream,
      isAudioEnabled: state.isAudioEnabled,
      isVideoEnabled: state.isVideoEnabled,
      isSharingScreen: state.isSharingScreen,
      selectedAudioDeviceId: state.selectedAudioDeviceId,
      selectedVideoDeviceId: state.selectedVideoDeviceId
    };
    
    set({ originalMediaState: originalState });
    
    console.log('[MediaDeviceStore] Original state saved:', {
      hasStream: !!originalState.stream,
      audioEnabled: originalState.isAudioEnabled,
      videoEnabled: originalState.isVideoEnabled,
      isSharing: originalState.isSharingScreen
    });
  },

  /**
   * 파일 스트리밍 종료 후 원본 상태 복원 (중요!)
   * 이 함수는 카메라 / 마이크 상태를 복원함
   * 스트림 전체를 교체하지 않고 트랙만 교체하여 연결을 유지함
   *
   * @returns 복원 성공 여부
   */
  restoreOriginalMediaState: async () => {
    const { originalMediaState, localStream: currentStream } = get();
    const { webRTCManager } = usePeerConnectionStore.getState();
    
    if (!originalMediaState) {
      console.warn('[MediaDeviceStore] No original state to restore');
      return false;
    }
    
    console.log('[MediaDeviceStore] Restoring original media state...');
    
    try {
      // 1. 현재 파일 스트리밍 트랙 정리 (기존 스트림은 유지)
      if (currentStream) {
        const currentVideoTracks = currentStream.getVideoTracks();
        const currentAudioTracks = currentStream.getAudioTracks();
        
        // 파일 스트리밍에서 사용한 트랙만 정지
        currentVideoTracks.forEach(track => {
          if (track.readyState === 'live') {
            console.log(`[MediaDeviceStore] Stopping file streaming video track: ${track.label}`);
            track.stop();
            currentStream.removeTrack(track);
          }
        });
        
        currentAudioTracks.forEach(track => {
          if (track.readyState === 'live') {
            console.log(`[MediaDeviceStore] Stopping file streaming audio track: ${track.label}`);
            track.stop();
            currentStream.removeTrack(track);
          }
        });
      }
      
      // 2. 원본 스트림의 트랙 준비
      let originalVideoTrack = null;
      let originalAudioTrack = null;
      let restoredStream = null;
      
      if (originalMediaState.stream) {
        originalVideoTrack = originalMediaState.stream.getVideoTracks()[0];
        originalAudioTrack = originalMediaState.stream.getAudioTracks()[0];
        
        // 트랙이 종료되었는지 확인
        const needsNewVideoTrack = originalVideoTrack && originalVideoTrack.readyState === 'ended';
        const needsNewAudioTrack = originalAudioTrack && originalAudioTrack.readyState === 'ended';
        
        if (needsNewVideoTrack || needsNewAudioTrack) {
          console.log('[MediaDeviceStore] Original tracks ended, creating new tracks...');
          
          try {
            restoredStream = await navigator.mediaDevices.getUserMedia({
              video: originalMediaState.isVideoEnabled ? {
                deviceId: originalMediaState.selectedVideoDeviceId ?
                  { exact: originalMediaState.selectedVideoDeviceId } : undefined
              } : false,
              audio: originalMediaState.isAudioEnabled ? {
                deviceId: originalMediaState.selectedAudioDeviceId ?
                  { exact: originalMediaState.selectedAudioDeviceId } : undefined
              } : false
            });
            
            originalVideoTrack = restoredStream.getVideoTracks()[0];
            originalAudioTrack = restoredStream.getAudioTracks()[0];
            
            console.log('[MediaDeviceStore] New stream created successfully');
          } catch (error) {
            console.error('[MediaDeviceStore] Failed to create new stream:', error);
            toast.error('Unable to restore camera/microphone. Please turn them on manually.');
            return false;
          }
        } else {
          // 기존 스트림의 트랙을 사용하되, 새로운 MediaStream 객체를 생성하여 UI 업데이트를 유도
          const newStream = new MediaStream();
          
          if (originalVideoTrack) {
            originalVideoTrack.enabled = originalMediaState.isVideoEnabled;
            newStream.addTrack(originalVideoTrack);
            console.log(`[MediaDeviceStore] Video track enabled: ${originalVideoTrack.enabled}`);
          }
          
          if (originalAudioTrack) {
            originalAudioTrack.enabled = originalMediaState.isAudioEnabled;
            newStream.addTrack(originalAudioTrack);
            console.log(`[MediaDeviceStore] Audio track enabled: ${originalAudioTrack.enabled}`);
          }
          
          restoredStream = newStream;
        }
      } else {
        // 원본 스트림이 없는 경우 (예: 파일 스트리밍 시작 전에 카메라/마이크가 꺼져있었음)
        if (originalMediaState.isVideoEnabled || originalMediaState.isAudioEnabled) {
          try {
            restoredStream = await navigator.mediaDevices.getUserMedia({
              video: originalMediaState.isVideoEnabled ? {
                deviceId: originalMediaState.selectedVideoDeviceId ?
                  { exact: originalMediaState.selectedVideoDeviceId } : undefined
              } : false,
              audio: originalMediaState.isAudioEnabled ? {
                deviceId: originalMediaState.selectedAudioDeviceId ?
                  { exact: originalMediaState.selectedAudioDeviceId } : undefined
              } : false
            });
            
            originalVideoTrack = restoredStream.getVideoTracks()[0];
            originalAudioTrack = restoredStream.getAudioTracks()[0];
            
            console.log('[MediaDeviceStore] New stream created from scratch');
          } catch (error) {
            console.error('[MediaDeviceStore] Failed to create new stream:', error);
            toast.error('Unable to restore camera/microphone. Please turn them on manually.');
            return false;
          }
        } else {
          // 오디오/비디오가 모두 비활성화된 상태였다면 빈 스트림 생성
          restoredStream = new MediaStream();
        }
      }
      
      // 3. WebRTC 매니저에 트랙만 교체 (스트림 전체를 교체하지 않음)
      if (webRTCManager) {
        console.log('[MediaDeviceStore] Replacing tracks in WebRTC manager...');
        
        // WebRTC 트랙 교체
        if (originalVideoTrack) {
          await webRTCManager.replaceSenderTrack('video', originalVideoTrack);
        }
        if (originalAudioTrack) {
          await webRTCManager.replaceSenderTrack('audio', originalAudioTrack);
        }
      }
      
      // 4. Store 상태 업데이트 (로컬 스트림도 함께 업데이트)
      set({
        localStream: restoredStream,
        isAudioEnabled: originalMediaState.isAudioEnabled,
        isVideoEnabled: originalMediaState.isVideoEnabled,
        isSharingScreen: originalMediaState.isSharingScreen,
        selectedAudioDeviceId: originalMediaState.selectedAudioDeviceId,
        selectedVideoDeviceId: originalMediaState.selectedVideoDeviceId,
        originalMediaState: null,
        isFileStreaming: false
      });
      
      // 5. 시그널링 서버에 상태 전송
      useSignalingStore.getState().updateMediaState({
        kind: 'audio',
        enabled: originalMediaState.isAudioEnabled
      });
      useSignalingStore.getState().updateMediaState({
        kind: 'video',
        enabled: originalMediaState.isVideoEnabled
      });
      
      // 6. 피어들에게 파일 스트리밍 종료 알림
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      sendToAllPeers(JSON.stringify({
        type: 'file-streaming-state',
        payload: { isStreaming: false, fileType: '' }
      }));
      
      console.log('[MediaDeviceStore] Original state restored successfully');
      return true;
      
    } catch (error) {
      console.error('[MediaDeviceStore] Failed to restore original state:', error);
      set({ originalMediaState: null, isFileStreaming: false });
      return false;
    }
  },

  /**
   * 파일 스트리밍 모드 설정
   * 
   * @param isStreaming - 스트리밍 여부
   */
  setFileStreaming: (isStreaming: boolean) => {
    console.log(`[MediaDeviceStore] File streaming mode: ${isStreaming ? 'ON' : 'OFF'}`);
    set({ isFileStreaming: isStreaming });
  },

  /**
   * 정리 (모든 미디어 리소스 해제)
   */
  cleanup: () => {
    console.log('[MediaDeviceStore] Starting cleanup...');
    
    const state = get();
    
    // 1. 화면 공유 리소스 정리
    if (state.screenShareResources) {
      const resources = state.screenShareResources;
      
      if (resources.animationFrameId) {
        cancelAnimationFrame(resources.animationFrameId);
      }
      
      if (resources.screenVideoEl) {
        resources.screenVideoEl.srcObject = null;
        resources.screenVideoEl.remove();
      }
      
      if (resources.cameraVideoEl) {
        resources.cameraVideoEl.srcObject = null;
        resources.cameraVideoEl.remove();
      }
      
      if (resources.audioContext && resources.audioContext.state !== 'closed') {
        resources.audioContext.close();
      }
    }
    
    // 2. 원본 스트림 정리
    if (state.originalStream) {
      state.originalStream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          console.log(`[MediaDeviceStore] Stopping original track: ${track.kind}`);
          track.stop();
        }
      });
    }
    
    // 3. 현재 스트림 정리
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          console.log(`[MediaDeviceStore] Stopping local track: ${track.kind}`);
          track.stop();
        }
      });
    }
    
    // 4. 원본 미디어 상태의 스트림도 정리
    if (state.originalMediaState?.stream) {
      state.originalMediaState.stream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          console.log(`[MediaDeviceStore] Stopping original media state track: ${track.kind}`);
          track.stop();
        }
      });
    }
    
    // 5. DeviceManager 정리
    deviceManager.cleanup();
    
    // 6. Store 상태 초기화
    set({
      localStream: null,
      audioInputs: [],
      videoInputs: [],
      audioOutputs: [],
      selectedAudioDeviceId: '',
      selectedVideoDeviceId: '',
      isAudioEnabled: true,
      isVideoEnabled: true,
      isSharingScreen: false,
      isChangingDevice: false,
      originalStream: null,
      includeCameraInScreenShare: false,
      screenShareResources: null,
      isFileStreaming: false,
      originalMediaState: null,
    });
    
    console.log('[MediaDeviceStore] Cleanup completed');
  }
}));
