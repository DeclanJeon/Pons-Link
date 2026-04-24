import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMediaDeviceStore } from './useMediaDeviceStore';

class FakeMediaStream {
  getTracks() { return []; }
  getAudioTracks() { return []; }
  getVideoTracks() { return []; }
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

const mockWebRTCManager = {
  replaceLocalStream: vi.fn().mockResolvedValue(undefined),
  replaceSenderTrack: vi.fn().mockResolvedValue(undefined),
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
    cleanup: vi.fn(),
  },
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
      streamStateManager: { captureState: vi.fn() } as any,
      includeCameraInScreenShare: false,
      screenShareResources: null,
      isFileStreaming: false,
      originalMediaState: null,
      localDisplayOverride: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
