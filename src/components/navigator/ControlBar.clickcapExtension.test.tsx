import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ControlBar } from './ControlBar';
import { isClickCapInstalled } from '@/features/clickcap/clickcapBridge';
import { fetchClickCapExtensionMetadata, triggerClickCapExtensionDownload } from '@/features/clickcap/clickcapDownload';
import { toast } from 'sonner';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/media/MobileCameraToggle', () => ({ MobileCameraToggle: () => <div /> }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const { mockStartClickCapCapture, mockStartClickCapBridgeCapture } = vi.hoisted(() => ({
  mockStartClickCapCapture: vi.fn(),
  mockStartClickCapBridgeCapture: vi.fn(),
}));

vi.mock('@/features/clickcap/clickcapBridge', () => ({
  isClickCapInstalled: vi.fn(),
  startClickCapCapture: mockStartClickCapBridgeCapture,
}));
vi.mock('@/features/clickcap/clickcapDownload', () => ({
  fetchClickCapExtensionMetadata: vi.fn(),
  triggerClickCapExtensionDownload: vi.fn(),
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
  });

  it('renders a ClickCap Capture action in desktop more options', () => {
    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    openMoreOptions();

    expect(screen.getByText('ClickCap Capture')).toBeInTheDocument();
  });

  it('starts Pons-Link ClickCap media capture when the extension is installed', async () => {
    vi.mocked(isClickCapInstalled).mockResolvedValue(true);
    mockStartClickCapCapture.mockResolvedValue(undefined);
    mockStartClickCapBridgeCapture.mockResolvedValue({ success: true });

    render(<MemoryRouter><ControlBar /></MemoryRouter>);
    openMoreOptions();
    fireEvent.click(screen.getByText('ClickCap Capture'));

    await waitFor(() => expect(mockStartClickCapCapture).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockStartClickCapBridgeCapture).toHaveBeenCalledTimes(1));
    expect(fetchClickCapExtensionMetadata).not.toHaveBeenCalled();
    expect(triggerClickCapExtensionDownload).not.toHaveBeenCalled();
    expect(mockStartClickCapBridgeCapture).toHaveBeenCalledWith({ mode: 'area' });
  });

  it('downloads the extension package when ClickCap is not installed', async () => {
    vi.mocked(isClickCapInstalled).mockResolvedValue(false);
    vi.mocked(fetchClickCapExtensionMetadata).mockResolvedValue({
      status: 'available',
      extension: {
        id: 'clickcap',
        name: 'ClickCap - Smart Screen Recorder',
        version: '1.0.1',
        downloadUrl: 'http://localhost:6650/api/clickcap-extension/download',
        fileName: 'clickcap-extension-1.0.1.zip',
        installInstructions: ['Download', 'Unzip'],
      },
    });

    render(<MemoryRouter><ControlBar /></MemoryRouter>);
    openMoreOptions();
    fireEvent.click(screen.getByText('ClickCap Capture'));

    await waitFor(() => expect(fetchClickCapExtensionMetadata).toHaveBeenCalledTimes(1));
    expect(triggerClickCapExtensionDownload).toHaveBeenCalledWith({
      downloadUrl: 'http://localhost:6650/api/clickcap-extension/download',
      fileName: 'clickcap-extension-1.0.1.zip',
    });
    expect(mockStartClickCapCapture).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('ClickCap download started. Unzip it, load it in Chrome extensions, then click ClickCap Capture again.');
  });

  it('falls back to in-page capture when extension capture command fails', async () => {
    vi.mocked(isClickCapInstalled).mockResolvedValue(true);
    mockStartClickCapCapture.mockResolvedValue(undefined);
    mockStartClickCapBridgeCapture.mockResolvedValue({ success: false, error: 'extension unavailable' });

    render(<MemoryRouter><ControlBar /></MemoryRouter>);
    openMoreOptions();
    fireEvent.click(screen.getByText('ClickCap Capture'));

    await waitFor(() => expect(mockStartClickCapBridgeCapture).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockStartClickCapCapture).toHaveBeenCalledTimes(1));
    expect(toast.info).toHaveBeenCalledWith('ClickCap extension capture command failed. Falling back to in-page capture.');
  });

  it('shows an error when installed ClickCap media capture cannot start', async () => {
    vi.mocked(isClickCapInstalled).mockResolvedValue(true);
    mockStartClickCapCapture.mockRejectedValue(new Error('Permission denied'));
    mockStartClickCapBridgeCapture.mockResolvedValue({ success: true });

    render(<MemoryRouter><ControlBar /></MemoryRouter>);
    openMoreOptions();
    fireEvent.click(screen.getByText('ClickCap Capture'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Permission denied'));
  });
});
