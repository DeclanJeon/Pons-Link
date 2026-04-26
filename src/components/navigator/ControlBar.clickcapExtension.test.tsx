import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ControlBar } from './ControlBar';
import { toast } from 'sonner';
import { subscribeToClickCapCaptureStream } from '@/features/clickcap/clickcapBridge';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/media/MobileCameraToggle', () => ({ MobileCameraToggle: () => <div /> }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const { mockStartClickCapCapture, mockStopClickCapCapture, mockStartClickCapBridgeCapture } = vi.hoisted(() => ({
  mockStartClickCapCapture: vi.fn(),
  mockStopClickCapCapture: vi.fn(),
  mockStartClickCapBridgeCapture: vi.fn(),
}));
const { mockPrepareClickCapCapture, subscribeCallbacks } = vi.hoisted(() => ({
  mockPrepareClickCapCapture: vi.fn(),
  subscribeCallbacks: [] as Array<{
    onStreamReady: Parameters<typeof subscribeToClickCapCaptureStream>[0]['onStreamReady'];
    onStreamStopped?: Parameters<typeof subscribeToClickCapCaptureStream>[0]['onStreamStopped'];
  }>,
}));

vi.mock('@/features/clickcap/clickcapBridge', () => ({
  startClickCapCapture: mockStartClickCapBridgeCapture,
  prepareClickCapCapture: mockPrepareClickCapCapture,
  subscribeToClickCapCaptureStream: (params: Parameters<typeof subscribeToClickCapCaptureStream>[0]) => {
    subscribeCallbacks.push(params);
    return vi.fn();
  },
}));

vi.mock('@/stores/useMediaDeviceStore', () => ({
  useMediaDeviceStore: () => ({
    isAudioEnabled: true,
    isVideoEnabled: true,
    isSharingScreen: false,
    toggleAudio: vi.fn(),
    toggleVideo: vi.fn(),
    toggleScreenShare: vi.fn(),
    startClickCapCapture: mockStartClickCapCapture,
    stopClickCapCapture: mockStopClickCapCapture,
    cleanup: vi.fn(),
  }),
}));

vi.mock('@/stores/useUIManagementStore', () => ({
  useUIManagementStore: () => ({
    activePanel: null,
    viewMode: 'speaker',
    setActivePanel: vi.fn(),
    setViewMode: vi.fn(),
    controlBarSize: 'md',
    isMobileDockVisible: true,
    mobileDockPosition: 'bottom',
    mobileDockSize: 'md',
    mobileDockAutoHideEnabled: false,
    setMobileDockVisible: vi.fn(),
    toggleMobileDock: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock('@/stores/useTranscriptionStore', () => ({
  useTranscriptionStore: () => ({
    isTranscriptionEnabled: false,
    toggleTranscription: vi.fn(),
  }),
}));

vi.mock('@/stores/usePeerConnectionStore', () => ({ usePeerConnectionStore: () => ({ cleanup: vi.fn() }) }));
vi.mock('@/stores/useSessionStore', () => ({ useSessionStore: () => ({ clearSession: vi.fn(), roomType: 'video-group', roomId: 'room-1' }) }));
vi.mock('@/stores/useRoomUpgradeStore', () => ({ useRoomUpgradeStore: () => ({ requestUpgrade: vi.fn() }) }));
vi.mock('@/stores/useChatStore', () => ({ useChatStore: (selector?: (state: { unreadCount: number }) => unknown) => selector ? selector({ unreadCount: 0 }) : { unreadCount: 0 } }));
vi.mock('@/stores/useRelayStore', () => ({ useRelayStore: (selector?: (state: { takeoverMode: boolean; takeoverPeerId: string | null; disableTakeover: () => void; terminateRelay: () => void }) => unknown) => selector ? selector({ takeoverMode: false, takeoverPeerId: null, disableTakeover: vi.fn(), terminateRelay: vi.fn() }) : {} }));
vi.mock('@/types/roomCapabilities', () => ({ isAudioRoom: () => false }));

const openMoreOptions = () => {
  fireEvent.pointerDown(screen.getByTitle('More options'));
};

describe('ControlBar ClickCap extension flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeCallbacks.length = 0;
    mockPrepareClickCapCapture.mockResolvedValue({ success: true, requestId: 'auto-req' });
  });

  it('does not render a ClickCap Capture action in desktop more options', () => {
    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    openMoreOptions();

    expect(screen.queryByText('ClickCap Capture')).not.toBeInTheDocument();
  });

  it('automatically registers the open Pons-Link room with ClickCap', async () => {
    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    await waitFor(() => expect(mockPrepareClickCapCapture).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockStartClickCapBridgeCapture).not.toHaveBeenCalled());
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('starts screen stream when ClickCap extension initiates Share Screen', async () => {
    mockStartClickCapCapture.mockResolvedValue(undefined);

    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    await waitFor(() => expect(mockPrepareClickCapCapture).toHaveBeenCalledTimes(1));
    expect(subscribeCallbacks.length).toBe(1);

    const cropArea = { x: 10, y: 20, width: 640, height: 360 };
    const view = { viewportWidth: 1280, viewportHeight: 720 };
    await waitFor(() => {
      subscribeCallbacks[0].onStreamReady({ requestId: 'auto-req', streamId: 'stream-456', cropArea, view });
    });

    await waitFor(() => expect(mockStartClickCapCapture).toHaveBeenCalledWith({ streamId: 'stream-456', cropArea, view }));
  });

  it('ignores stream events for a different request id', async () => {
    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    await waitFor(() => expect(mockPrepareClickCapCapture).toHaveBeenCalledTimes(1));
    expect(subscribeCallbacks.length).toBe(1);

    await waitFor(() => {
      subscribeCallbacks[0].onStreamReady({ requestId: 'req-other', streamId: 'stream-456' });
    });

    expect(mockStartClickCapCapture).not.toHaveBeenCalled();
  });

  it('does not show a user-facing error when silent auto registration fails', async () => {
    mockPrepareClickCapCapture.mockRejectedValue(new Error('Permission denied'));

    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    await waitFor(() => expect(mockPrepareClickCapCapture).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('stops ClickCap capture when the extension sends a stop event', async () => {
    mockStopClickCapCapture.mockResolvedValue(undefined);

    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    await waitFor(() => expect(mockPrepareClickCapCapture).toHaveBeenCalledTimes(1));
    expect(subscribeCallbacks.length).toBe(1);

    await waitFor(() => {
      subscribeCallbacks[0].onStreamStopped?.({ requestId: 'auto-req' });
    });

    await waitFor(() => expect(mockStopClickCapCapture).toHaveBeenCalledTimes(1));
  });
});
