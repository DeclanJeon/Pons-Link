import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ControlBar } from './ControlBar';

const toggleTranscriptionMock = vi.fn();
let transcriptionEnabled = false;
let transcriptionStatus: 'off' | 'starting' | 'live' | 'fallback' | 'error' = 'off';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/components/media/MobileCameraToggle', () => ({ MobileCameraToggle: () => <div /> }));
vi.mock('sonner', () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

vi.mock('@/stores/useMediaDeviceStore', () => ({
  useMediaDeviceStore: () => ({
    isAudioEnabled: true,
    isVideoEnabled: true,
    isSharingScreen: false,
    toggleAudio: vi.fn(),
    toggleVideo: vi.fn(),
    toggleScreenShare: vi.fn(),
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
    isTranscriptionEnabled: transcriptionEnabled,
    transcriptionStatus,
    toggleTranscription: toggleTranscriptionMock,
  }),
}));

vi.mock('@/stores/usePeerConnectionStore', () => ({ usePeerConnectionStore: () => ({ cleanup: vi.fn() }) }));
vi.mock('@/stores/useSessionStore', () => ({ useSessionStore: () => ({ clearSession: vi.fn(), roomType: 'video-group', roomId: 'room-1' }) }));
vi.mock('@/stores/useRoomUpgradeStore', () => ({ useRoomUpgradeStore: () => ({ requestUpgrade: vi.fn() }) }));
vi.mock('@/stores/useChatStore', () => ({ useChatStore: (selector?: (state: { unreadCount: number }) => unknown) => selector ? selector({ unreadCount: 0 }) : { unreadCount: 0 } }));
vi.mock('@/stores/useRelayStore', () => ({ useRelayStore: (selector?: (state: { takeoverMode: boolean; takeoverPeerId: string | null; disableTakeover: () => void; terminateRelay: () => void }) => unknown) => selector ? selector({ takeoverMode: false, takeoverPeerId: null, disableTakeover: vi.fn(), terminateRelay: vi.fn() }) : {} }));
vi.mock('@/types/roomCapabilities', () => ({ isAudioRoom: () => false }));

describe('ControlBar live captions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transcriptionEnabled = false;
    transcriptionStatus = 'off';
  });

  it('shows a live captions toggle on desktop', () => {
    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    expect(screen.getByTitle('Enable live captions')).toBeInTheDocument();
  });

  it('toggles captions when clicked', () => {
    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    fireEvent.click(screen.getByTitle('Enable live captions'));

    expect(toggleTranscriptionMock).toHaveBeenCalledTimes(1);
  });

  it('marks the captions button active when enabled', () => {
    transcriptionEnabled = true;
    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    expect(screen.getByTitle('Disable live captions')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the dock compact and uses only the caption icon as the starting indicator', () => {
    transcriptionEnabled = true;
    transcriptionStatus = 'starting';

    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    expect(screen.queryByText('Starting captions')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Live captions starting' })).toHaveClass('sr-only');
    expect(screen.getByTitle('Disable live captions').querySelector('svg')).toHaveClass('text-cyan-200');
  });

  it('keeps the dock compact and pulses the caption icon when captions are streaming', () => {
    transcriptionEnabled = true;
    transcriptionStatus = 'live';

    render(<MemoryRouter><ControlBar /></MemoryRouter>);

    expect(screen.queryByText('Captions live')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Live captions streaming' })).toHaveClass('sr-only');
    expect(screen.getByTitle('Disable live captions').querySelector('svg')).toHaveClass('text-emerald-300');
  });
});
