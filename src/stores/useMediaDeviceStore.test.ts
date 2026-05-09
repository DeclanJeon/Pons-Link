import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMediaDeviceStore } from './useMediaDeviceStore';
import type { StreamStateManager } from '@/services/streamStateManager';

class FakeMediaStream {
  constructor(private readonly tracks: Array<{ kind: string }> = []) {}
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === 'video'); }
}
Object.defineProperty(globalThis, 'MediaStream', {
  value: FakeMediaStream,
  writable: true,
  configurable: true,
});

const mockReplaceLocalStream = vi.fn();
const mockReplaceSenderTrack = vi.fn();
const mockSendToAllPeers = vi.fn();
const mockUpdateMediaState = vi.fn();
const mockSetMainContentParticipant = vi.fn();
const {
  mockClickCapCleanup,
  mockCreateClickCapCaptureStream,
  mockMediaQualitySettings,
} = vi.hoisted(() => ({
  mockClickCapCleanup: vi.fn(async () => undefined),
  mockCreateClickCapCaptureStream: vi.fn(),
  mockMediaQualitySettings: {
    videoQualityPreset: 'auto',
    audioProcessingMode: 'voice-focus',
    cameraPrivacyMode: 'camera',
  },
}));

const mockWebRTCManager = {
  replaceLocalStream: vi.fn().mockResolvedValue(undefined),
  replaceSenderTrack: vi.fn().mockResolvedValue(undefined),
  setOutboundVideoQualityPreset: vi.fn().mockResolvedValue(undefined),
};

vi.mock('./usePeerConnectionStore', () => ({
  usePeerConnectionStore: {
    getState: () => ({
      webRTCManager: mockWebRTCManager,
      sendToAllPeers: mockSendToAllPeers,
      peers: new Map(),
    }),
  },
}));

vi.mock('./useSignalingStore', () => ({
  useSignalingStore: {
    getState: () => ({
      updateMediaState: mockUpdateMediaState,
      status: 'connected',
    }),
  },
}));

vi.mock('./useUIManagementStore', () => ({
  useUIManagementStore: {
    getState: () => ({
      setMainContentParticipant: mockSetMainContentParticipant,
      activePanel: 'none',
      openPanel: vi.fn(),
      closePanel: vi.fn(),
    }),
  },
}));

vi.mock('./useSessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      userId: 'test-user-id',
      nickname: 'TestUser',
      roomId: 'test-room',
      roomType: 'video-group',
    }),
  },
}));

vi.mock('@/services/deviceManager', () => ({
  deviceManager: {
    initialize: vi.fn(),
    getCurrentStream: vi.fn(),
    getDevices: vi.fn(() => ({ audioInputs: [], videoInputs: [], audioOutputs: [] })),
    getSelectedDevices: vi.fn(() => ({ audioDeviceId: '', videoDeviceId: '' })),
    isMobile: false,
    onDeviceChange: vi.fn(),
    changeAudioDevice: vi.fn(),
    changeVideoDevice: vi.fn(),
	    switchCamera: vi.fn(),
	    setStreamSettings: vi.fn(),
	    applyStreamSettings: vi.fn(),
	    cleanup: vi.fn(),
	  },
	}));

	vi.mock('./useMediaQualityStore', () => ({
	  useMediaQualityStore: {
	    getState: () => ({
	      ...mockMediaQualitySettings,
	      getMediaQualitySettings: () => ({ ...mockMediaQualitySettings }),
	    }),
	  },
	}));

	vi.mock('./useParticipantProfileStore', () => ({
	  useParticipantProfileStore: {
	    getState: () => ({
	      localProfile: { avatarUrl: '', userId: 'test-user-id' },
	    }),
	  },
	}));

vi.mock('@/services/clickcapCaptureStream', () => ({
  createClickCapCaptureStream: mockCreateClickCapCaptureStream,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('useMediaDeviceStore error boundaries', () => {
  beforeEach(() => {
    useMediaDeviceStore.setState(useMediaDeviceStore.getInitialState?.() || {
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
      streamStateManager: { captureState: vi.fn() } as Partial<StreamStateManager> as StreamStateManager,
      includeCameraInScreenShare: false,
      screenShareResources: null,
      isFileStreaming: false,
	      originalMediaState: null,
	      localDisplayOverride: null,
	      avatarVideoSession: null,
	      clickCapCaptureSession: null,
    });
    mockWebRTCManager.replaceLocalStream.mockResolvedValue(undefined);
    mockWebRTCManager.replaceSenderTrack.mockResolvedValue(undefined);
    mockWebRTCManager.setOutboundVideoQualityPreset.mockResolvedValue(undefined);
    mockMediaQualitySettings.videoQualityPreset = 'auto';
    mockMediaQualitySettings.audioProcessingMode = 'voice-focus';
    mockMediaQualitySettings.cameraPrivacyMode = 'camera';
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts ClickCap Cast by replacing the local WebRTC stream without enabling screen share', async () => {
    const originalStream = new MediaStream();
    const clickCapStream = new MediaStream();
    const sourceStream = new MediaStream();
    mockCreateClickCapCaptureStream.mockResolvedValue({
      stream: clickCapStream,
      sourceStream,
      cleanup: mockClickCapCleanup,
      metadata: { sourceType: 'clickcap-crop', width: 1280, height: 720, fps: 30, hasAudio: false },
    });
    useMediaDeviceStore.setState({ localStream: originalStream, isAudioEnabled: true, isVideoEnabled: true });

    await useMediaDeviceStore.getState().startClickCapCapture();

    expect(mockCreateClickCapCaptureStream).toHaveBeenCalledWith(expect.objectContaining({
      fps: 30,
      includeSourceAudio: true,
      includeMicAudio: true,
      micStream: originalStream,
    }));
    expect(mockWebRTCManager.replaceLocalStream).toHaveBeenCalledWith(clickCapStream);
    expect(useMediaDeviceStore.getState().localStream).toBe(clickCapStream);
    expect(useMediaDeviceStore.getState().originalStream).toBe(originalStream);
    expect(useMediaDeviceStore.getState().isSharingScreen).toBe(false);
    expect(useMediaDeviceStore.getState().isClickCapSharing).toBe(true);
    expect(mockSetMainContentParticipant).toHaveBeenCalledWith('test-user-id');
    expect(mockSendToAllPeers).toHaveBeenCalledWith(JSON.stringify({ type: 'clickcap-capture-state', payload: { isSharing: true } }));
  });

  it('falls back to local capture when extension streamId capture is unavailable', async () => {
    const originalStream = new MediaStream();
    const localClickCapStream = new MediaStream();
    const fallbackSourceStream = new MediaStream();
    mockCreateClickCapCaptureStream
      .mockRejectedValueOnce(new Error('No streamId support'))
      .mockResolvedValueOnce({
        stream: localClickCapStream,
        sourceStream: fallbackSourceStream,
        cleanup: mockClickCapCleanup,
        metadata: { sourceType: 'clickcap-display', width: 1920, height: 1080, fps: 30, hasAudio: true },
      });
    useMediaDeviceStore.setState({ localStream: originalStream, isAudioEnabled: true, isVideoEnabled: true });

    await useMediaDeviceStore.getState().startClickCapCapture({ streamId: 'stream-id-123' });

    expect(mockCreateClickCapCaptureStream).toHaveBeenCalledTimes(2);
    expect(mockCreateClickCapCaptureStream).toHaveBeenNthCalledWith(1, expect.objectContaining({ streamId: 'stream-id-123' }));
    expect(mockCreateClickCapCaptureStream).toHaveBeenNthCalledWith(2, expect.not.objectContaining({ streamId: 'stream-id-123' }));

    const { toast } = await import('sonner');
    expect(toast.info).toHaveBeenCalledWith('ClickCap extension stream capture not available in browser context. Falling back to local capture.');
    expect(useMediaDeviceStore.getState().isSharingScreen).toBe(false);
    expect(useMediaDeviceStore.getState().isClickCapSharing).toBe(true);
    expect(useMediaDeviceStore.getState().localStream).toBe(localClickCapStream);
  });

  it('stops ClickCap capture by cleaning up and restoring the original stream', async () => {
    const originalStream = new MediaStream();
    const clickCapStream = new MediaStream();
    const sourceStream = new MediaStream();
    mockCreateClickCapCaptureStream.mockResolvedValue({
      stream: clickCapStream,
      sourceStream,
      cleanup: mockClickCapCleanup,
      metadata: { sourceType: 'clickcap-crop', width: 1280, height: 720, fps: 30, hasAudio: false },
    });
    useMediaDeviceStore.setState({ localStream: originalStream, isAudioEnabled: true, isVideoEnabled: true });
    await useMediaDeviceStore.getState().startClickCapCapture();

    await useMediaDeviceStore.getState().stopClickCapCapture();

    expect(mockClickCapCleanup).toHaveBeenCalledTimes(1);
    expect(mockWebRTCManager.replaceLocalStream).toHaveBeenLastCalledWith(originalStream);
    expect(useMediaDeviceStore.getState().localStream).toBe(originalStream);
    expect(useMediaDeviceStore.getState().originalStream).toBeNull();
    expect(useMediaDeviceStore.getState().isSharingScreen).toBe(false);
    expect(useMediaDeviceStore.getState().isClickCapSharing).toBe(false);
    expect(mockSetMainContentParticipant).toHaveBeenLastCalledWith(null);
    expect(mockSendToAllPeers).toHaveBeenLastCalledWith(JSON.stringify({ type: 'clickcap-capture-state', payload: { isSharing: false } }));
  });

  it('shows toast error when startScreenShare fails and rolls back state', async () => {
    const { startScreenShare } = useMediaDeviceStore.getState();

    // mock localStream and webRTCManager presence
    const fakeStream = new MediaStream();
    useMediaDeviceStore.setState({ localStream: fakeStream, originalStream: fakeStream });

    vi.stubGlobal('navigator', {
      ...navigator,
      mediaDevices: {
        ...navigator.mediaDevices,
        getDisplayMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    });

    await startScreenShare();

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Screen sharing failed. Please check permissions and try again.');
    const state = useMediaDeviceStore.getState();
    expect(state.originalStream).toBeNull();
  });

  it('shows toast error when changeAudioDevice fails', async () => {
    const { deviceManager } = await import('@/services/deviceManager');
    const { changeAudioDevice } = useMediaDeviceStore.getState();

    vi.mocked(deviceManager.changeAudioDevice).mockRejectedValue(new Error('Device not found'));

    await changeAudioDevice('fake-device-id');

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Failed to change microphone.');
    expect(useMediaDeviceStore.getState().isChangingDevice).toBe(false);
  });

  it('shows toast error when changeVideoDevice fails', async () => {
    const { deviceManager } = await import('@/services/deviceManager');
    const { changeVideoDevice } = useMediaDeviceStore.getState();

    vi.mocked(deviceManager.changeVideoDevice).mockRejectedValue(new Error('Device not found'));

    await changeVideoDevice('fake-device-id');

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Failed to change camera.');
    expect(useMediaDeviceStore.getState().isChangingDevice).toBe(false);
  });

  it('shows toast error when switchCamera fails', async () => {
    const { deviceManager } = await import('@/services/deviceManager');
    const { switchCamera } = useMediaDeviceStore.getState();

    useMediaDeviceStore.setState({ isMobile: true });
    vi.mocked(deviceManager.switchCamera).mockRejectedValue(new Error('No rear camera'));

    await switchCamera();

    const { toast } = await import('sonner');
    expect(toast.error).toHaveBeenCalledWith('Failed to switch camera.');
    expect(useMediaDeviceStore.getState().isChangingDevice).toBe(false);
  });

  it('applies media quality settings without replacing the local peer stream', async () => {
    const { deviceManager } = await import('@/services/deviceManager');
    const videoTrack = {
      kind: 'video',
      readyState: 'live',
      applyConstraints: vi.fn().mockResolvedValue(undefined),
    };
    const audioTrack = {
      kind: 'audio',
      readyState: 'live',
      applyConstraints: vi.fn().mockResolvedValue(undefined),
    };
    const localStream = new MediaStream([videoTrack, audioTrack] as unknown as MediaStreamTrack[]);
    mockMediaQualitySettings.videoQualityPreset = 'standard';
    mockMediaQualitySettings.audioProcessingMode = 'natural';

    useMediaDeviceStore.setState({
      localStream,
      isAudioEnabled: true,
      isVideoEnabled: true,
      isSharingScreen: false,
      isClickCapSharing: false,
      isFileStreaming: false,
      isChangingDevice: false,
    });

    await useMediaDeviceStore.getState().applyMediaQualitySettings();

    expect(deviceManager.setStreamSettings).toHaveBeenCalledWith(expect.objectContaining({
      videoQualityPreset: 'standard',
      audioProcessingMode: 'natural',
      cameraPrivacyMode: 'camera',
    }));
    expect(deviceManager.applyStreamSettings).not.toHaveBeenCalled();
    expect(mockWebRTCManager.replaceLocalStream).not.toHaveBeenCalled();
    expect(mockWebRTCManager.setOutboundVideoQualityPreset).toHaveBeenCalledWith('standard');
    expect(videoTrack.applyConstraints).toHaveBeenCalledWith(expect.objectContaining({
      width: { ideal: 1280 },
      height: { ideal: 720 },
    }));
    expect(audioTrack.applyConstraints).toHaveBeenCalledWith(expect.objectContaining({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    }));
  });
});
