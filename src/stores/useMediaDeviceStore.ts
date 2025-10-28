import { create } from 'zustand';
import { deviceManager } from '@/services/deviceManager';
import { DeviceInfo } from '@/lib/device/deviceUtils';
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
  isFileStreaming: boolean;
  originalMediaState: OriginalMediaState | null;
  localDisplayOverride: MediaStream | null;
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
  isFileStreaming: false,
  originalMediaState: null,
  localDisplayOverride: null,

  initialize: async () => {
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
    } catch (error) {
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
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: true } as DisplayMediaStreamOptions);
      setMainContentParticipant(localUserId);
      const screenVideoEl = document.createElement('video');
      const cameraVideoEl = document.createElement('video');
      const audioContext = new AudioContext();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no ctx');
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const s = screenVideoTrack.getSettings();
      canvas.width = s.width || 1920;
      canvas.height = s.height || 1080;
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
      set({ screenShareResources: { screenVideoEl, cameraVideoEl, audioContext, animationFrameId: null } });
      await webRTCManager.replaceLocalStream(finalStream);
      set({ isSharingScreen: true, localStream: finalStream });
      drawLoop();
      screenVideoTrack.onended = () => get().stopScreenShare();
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      sendToAllPeers(JSON.stringify({ type: 'screen-share-state', payload: { isSharing: true } }));
      toast.success('Screen sharing started successfully.');
    } catch (error) {
      set({ originalStream: null });
      const { setMainContentParticipant } = useUIManagementStore.getState();
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
    toast.info('Screen sharing stopped.');
  },

  setIncludeCameraInScreenShare: (include) => set({ includeCameraInScreenShare: include }),

  saveOriginalMediaState: () => {
    const state = get();
    const originalState: OriginalMediaState = {
      stream: state.localStream,
      isAudioEnabled: state.isAudioEnabled,
      isVideoEnabled: state.isVideoEnabled,
      isSharingScreen: state.isSharingScreen,
      selectedAudioDeviceId: state.selectedAudioDeviceId,
      selectedVideoDeviceId: state.selectedVideoDeviceId
    };
    set({ originalMediaState: originalState });
  },

  restoreOriginalMediaState: async () => {
    const { originalMediaState, localStream: currentStream } = get();
    const { webRTCManager } = usePeerConnectionStore.getState();
    if (!originalMediaState) return false;
    try {
      if (currentStream) {
        currentStream.getVideoTracks().forEach(track => {
          if (track.readyState === 'live') {
            track.stop();
            currentStream.removeTrack(track);
          }
        });
        currentStream.getAudioTracks().forEach(track => {
          if (track.readyState === 'live') {
            track.stop();
            currentStream.removeTrack(track);
          }
        });
      }
      let restoredStream: MediaStream | null = null;
      if (originalMediaState.stream) {
        const v = originalMediaState.stream.getVideoTracks()[0] || null;
        const a = originalMediaState.stream.getAudioTracks()[0] || null;
        if ((v && v.readyState === 'ended') || (a && a.readyState === 'ended')) {
          try {
            restoredStream = await navigator.mediaDevices.getUserMedia({
              video: originalMediaState.isVideoEnabled ? { deviceId: originalMediaState.selectedVideoDeviceId ? { exact: originalMediaState.selectedVideoDeviceId } : undefined } : false,
              audio: originalMediaState.isAudioEnabled ? { deviceId: originalMediaState.selectedAudioDeviceId ? { exact: originalMediaState.selectedAudioDeviceId } : undefined } : false
            });
          } catch (e) {
            toast.error('Unable to restore camera/microphone. Please turn them on manually.');
            return false;
          }
        } else {
          const newStream = new MediaStream();
          if (v) {
            v.enabled = originalMediaState.isVideoEnabled;
            newStream.addTrack(v);
          }
          if (a) {
            a.enabled = originalMediaState.isAudioEnabled;
            newStream.addTrack(a);
          }
          restoredStream = newStream;
        }
      } else {
        if (originalMediaState.isVideoEnabled || originalMediaState.isAudioEnabled) {
          try {
            restoredStream = await navigator.mediaDevices.getUserMedia({
              video: originalMediaState.isVideoEnabled ? { deviceId: originalMediaState.selectedVideoDeviceId ? { exact: originalMediaState.selectedVideoDeviceId } : undefined } : false,
              audio: originalMediaState.isAudioEnabled ? { deviceId: originalMediaState.selectedAudioDeviceId ? { exact: originalMediaState.selectedAudioDeviceId } : undefined } : false
            });
          } catch (e) {
            toast.error('Unable to restore camera/microphone. Please turn them on manually.');
            return false;
          }
        } else {
          restoredStream = new MediaStream();
        }
      }
      if (webRTCManager && restoredStream) {
        await webRTCManager.replaceLocalStream(restoredStream);
      } else if (webRTCManager) {
        await webRTCManager.replaceSenderTrack('video', undefined as unknown as MediaStreamTrack);
        await webRTCManager.replaceSenderTrack('audio', undefined as unknown as MediaStreamTrack);
      }
      set({
        localStream: restoredStream,
        isAudioEnabled: originalMediaState.isAudioEnabled,
        isVideoEnabled: originalMediaState.isVideoEnabled,
        isSharingScreen: originalMediaState.isSharingScreen,
        selectedAudioDeviceId: originalMediaState.selectedAudioDeviceId,
        selectedVideoDeviceId: originalMediaState.selectedVideoDeviceId,
        originalMediaState: null,
        isFileStreaming: false,
        localDisplayOverride: null
      });
      useSignalingStore.getState().updateMediaState({ kind: 'audio', enabled: originalMediaState.isAudioEnabled });
      useSignalingStore.getState().updateMediaState({ kind: 'video', enabled: originalMediaState.isVideoEnabled });
      const { sendToAllPeers } = usePeerConnectionStore.getState();
      sendToAllPeers(JSON.stringify({ type: 'file-streaming-state', payload: { isStreaming: false, fileType: '' } }));
      return true;
    } catch (error) {
      set({ originalMediaState: null, isFileStreaming: false, localDisplayOverride: null });
      return false;
    }
  },

  setFileStreaming: (isStreaming: boolean) => {
    set({ isFileStreaming: isStreaming });
  },

  cleanup: () => {
    const state = get();
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
    if (state.originalStream) {
      state.originalStream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
    }
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
    }
    if (state.originalMediaState?.stream) {
      state.originalMediaState.stream.getTracks().forEach(track => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
    }
    deviceManager.cleanup();
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
      localDisplayOverride: null
    });
  }
}));
