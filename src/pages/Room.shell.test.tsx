import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Room from './Room';
import type { RoomType } from '@/types/room.types';

const {
  navigateMock,
  initMediaMock,
  cleanupMediaMock,
  cleanupPeerConnectionMock,
  setViewModeMock,
  closePanelMock,
  isPanelOpenMock,
  clearSessionMock,
  setLocalTranscriptMock,
  sendTranscriptionMock,
  toggleTranscriptionMock,
  startSpeechMock,
  stopSpeechMock,
  clearUpgradeRequestMock,
  approveUpgradeMock,
  rejectUpgradeMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  initMediaMock: vi.fn().mockResolvedValue(undefined),
  cleanupMediaMock: vi.fn(),
  cleanupPeerConnectionMock: vi.fn(),
  setViewModeMock: vi.fn(),
  closePanelMock: vi.fn(),
  isPanelOpenMock: vi.fn((panel: string) => panel === 'chat'),
  clearSessionMock: vi.fn(),
  setLocalTranscriptMock: vi.fn(),
  sendTranscriptionMock: vi.fn(),
  toggleTranscriptionMock: vi.fn(),
  startSpeechMock: vi.fn(),
  stopSpeechMock: vi.fn(),
  clearUpgradeRequestMock: vi.fn(),
  approveUpgradeMock: vi.fn(),
  rejectUpgradeMock: vi.fn(),
}));

let roomTypeState: RoomType = 'video-group';

vi.mock('@/components/media/ContentLayout', () => ({
  ContentLayout: () => <div data-testid="content-layout">content layout</div>,
}));

vi.mock('@/components/navigator/DraggableControlBar', () => ({
  default: () => <div data-testid="legacy-control-bar">legacy control bar</div>,
}));

vi.mock('@/components/setting/GlobalConnectionStatus', () => ({
  GlobalConnectionStatus: () => <div data-testid="connection-status">connection status</div>,
}));

vi.mock('@/components/functions/chat/ChatPanel', () => ({
  ChatPanel: () => <div data-testid="chat-panel">chat panel</div>,
}));

vi.mock('@/components/functions/whiteboard/WhiteboardPanel', () => ({
  WhiteboardPanel: () => <div data-testid="whiteboard-panel">whiteboard panel</div>,
}));

vi.mock('@/components/functions/relay/RelayControlPanel', () => ({
  RelayControlPanel: () => <div data-testid="relay-panel">relay panel</div>,
}));

vi.mock('@/components/functions/cowatch/CoWatchPanel', () => ({
  default: () => <div data-testid="cowatch-panel">cowatch panel</div>,
}));

vi.mock('@/components/setting/SettingsPanel', () => ({
  default: () => <div data-testid="settings-panel">settings panel</div>,
}));

vi.mock('@/components/functions/fileStreaming/FileStreamingPanel', () => ({
  FileStreamingPanel: () => <div data-testid="file-streaming-panel">file streaming panel</div>,
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => 'desktop',
  getResponsiveClasses: (_deviceInfo: string, classes: Record<string, string>) => classes.desktop ?? classes.tablet ?? classes.mobile ?? '',
}));

vi.mock('@/hooks/useAutoHideControls', () => ({
  useAutoHideControls: vi.fn(),
}));

vi.mock('@/hooks/useRoomOrchestrator', () => ({
  useRoomOrchestrator: vi.fn(),
}));

vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    start: startSpeechMock,
    stop: stopSpeechMock,
    isSupported: true,
  }),
}));

vi.mock('@/hooks/useTurnCredentials', () => ({
  useTurnCredentials: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  analytics: {
    roomJoin: vi.fn(),
    roomLeave: vi.fn(),
  },
}));

vi.mock('@/stores/useMediaDeviceStore', () => ({
  useMediaDeviceStore: (selector?: (state: any) => any) => {
    const state = { localStream: { id: 'local-stream' }, initialize: initMediaMock, cleanup: cleanupMediaMock };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/useParticipantProfileStore', () => ({
  useParticipantProfileStore: (selector?: (state: any) => any) => {
    const state = { setLocalAvatar: vi.fn(), setLocalUserId: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/usePeerConnectionStore', () => ({
  usePeerConnectionStore: (selector?: (state: any) => any) => {
    const state = { cleanup: cleanupPeerConnectionMock, peers: new Map() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: (selector?: (state: any) => any) => {
    const state = { userId: 'user-1', nickname: 'Host One', clearSession: clearSessionMock, setSession: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/useRoomUpgradeStore', () => ({
  useRoomUpgradeStore: (selector?: (state: any) => any) => {
    const state = { activeRequest: null, approveUpgrade: approveUpgradeMock, rejectUpgrade: rejectUpgradeMock, lastMigration: null, clearRequest: clearUpgradeRequestMock };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/useTranscriptionStore', () => ({
  useTranscriptionStore: (selector?: (state: any) => any) => {
    const state = { isTranscriptionEnabled: false, transcriptionLanguage: 'en-US', setLocalTranscript: setLocalTranscriptMock, sendTranscription: sendTranscriptionMock, toggleTranscription: toggleTranscriptionMock };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/useChatStore', () => ({
  useChatStore: (selector?: (state: any) => any) => {
    const state = { unreadCount: 2, fileTransfers: new Map([['transfer-1', {}]]) };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/useSignalingStore', () => ({
  useSignalingStore: (selector?: (state: any) => any) => {
    const state = { status: 'connected' };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/stores/useUIManagementStore', () => ({
  useUIManagementStore: () => ({
    isPanelOpen: isPanelOpenMock,
    closePanel: closePanelMock,
    setViewMode: setViewModeMock,
  }),
}));

vi.mock('@/stores/useDeviceMetadataStore', () => ({
  useDeviceMetadataStore: {
    getState: () => ({
      broadcastMetadata: vi.fn(),
    }),
  },
}));

vi.mock('@/types/roomCapabilities', () => ({
  DEFAULT_ROOM_TYPE: 'video-group',
  getDefaultViewMode: () => 'speaker',
  isValidRoomType: (value: string | null) => value === roomTypeState,
}));

vi.mock('@/utils/nickname', () => ({
  generateRandomNickname: () => 'Generated Nickname',
}));

vi.mock('@/utils/session.utils', () => ({
  sessionManager: {
    getNickname: () => 'Stored Nickname',
    saveNickname: vi.fn(),
  },
}));

vi.mock('@/lib/avatar/dicebear', () => ({
  getRandomAvatarPreset: () => ({ id: 'preset-1', seed: 'preset-1' }),
  getStoredAvatarPreset: () => null,
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'generated-user-id',
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const renderRoom = (roomType: RoomType = 'video-group') => {
  roomTypeState = roomType;

  return render(
    <MemoryRouter initialEntries={[`/room/${encodeURIComponent('Feature Demo Room')}?type=${roomType}`]}>
      <Routes>
        <Route path="/room/:roomTitle" element={<Room />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('Room shell after migration to DraggableControlBar layout', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    initMediaMock.mockClear();
    cleanupMediaMock.mockClear();
    cleanupPeerConnectionMock.mockClear();
    setViewModeMock.mockClear();
    closePanelMock.mockClear();
    isPanelOpenMock.mockClear();
    clearSessionMock.mockClear();
    setLocalTranscriptMock.mockClear();
    sendTranscriptionMock.mockClear();
    toggleTranscriptionMock.mockClear();
    startSpeechMock.mockClear();
    stopSpeechMock.mockClear();
  });

  it('renders the core room surface with ContentLayout and DraggableControlBar', () => {
    renderRoom('video-group');

    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
    expect(screen.getByTestId('content-layout')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-control-bar')).toBeInTheDocument();
  });

  it('mounts open room panels via Suspense', () => {
    renderRoom('video-group');

    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
  });

  it('omits the old RoomTopRail / RoomStageShell / RoomContextRail / RoomBottomDock shell', () => {
    renderRoom('video-group');

    expect(screen.queryByRole('region', { name: 'Room top rail' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Room stage shell' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Room context rail' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Room bottom dock' })).not.toBeInTheDocument();
  });
});
