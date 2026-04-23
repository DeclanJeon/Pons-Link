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
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  initMediaMock: vi.fn().mockResolvedValue(undefined),
  cleanupMediaMock: vi.fn(),
  cleanupPeerConnectionMock: vi.fn(),
}));

let roomTypeState: RoomType = 'video-group';
let activePanelState: 'none' | 'chat' | 'whiteboard' | 'settings' | 'fileStreaming' | 'relay' | 'cowatch' = 'none';
let openPanelsState = new Set<string>();

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
  CoWatchPanel: () => <div data-testid="cowatch-panel">cowatch panel</div>,
}));

vi.mock('@/components/setting/SettingsPanel', () => ({
  default: () => <div data-testid="settings-panel">settings panel</div>,
}));

vi.mock('@/components/functions/fileStreaming/FileStreamingPanel', () => ({
  FileStreamingPanel: () => <div data-testid="file-streaming-panel">file streaming panel</div>,
}));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => 'desktop',
  getResponsiveClasses: (_deviceInfo: string, classes: Record<string, string>) => classes.desktop ?? classes.tablet ?? classes.mobile ?? '',
}));
vi.mock('@/hooks/useAutoHideControls', () => ({ useAutoHideControls: vi.fn() }));
vi.mock('@/hooks/useRoomOrchestrator', () => ({ useRoomOrchestrator: vi.fn() }));
vi.mock('@/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({ start: vi.fn(), stop: vi.fn(), isSupported: true }),
}));
vi.mock('@/hooks/useTurnCredentials', () => ({ useTurnCredentials: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ analytics: { roomJoin: vi.fn(), roomLeave: vi.fn() } }));
vi.mock('@/stores/useMediaDeviceStore', () => ({
  useMediaDeviceStore: () => ({ localStream: { id: 'local-stream' }, initialize: initMediaMock, cleanup: cleanupMediaMock }),
}));
vi.mock('@/stores/useParticipantProfileStore', () => ({
  useParticipantProfileStore: () => ({ setLocalAvatar: vi.fn(), setLocalUserId: vi.fn() }),
}));
vi.mock('@/stores/usePeerConnectionStore', () => ({
  usePeerConnectionStore: () => ({ cleanup: cleanupPeerConnectionMock, peers: new Map() }),
}));
vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: () => ({ userId: 'user-1', nickname: 'Host One', clearSession: vi.fn(), setSession: vi.fn() }),
}));
vi.mock('@/stores/useRoomUpgradeStore', () => ({
  useRoomUpgradeStore: () => ({ activeRequest: null, approveUpgrade: vi.fn(), rejectUpgrade: vi.fn(), lastMigration: null, clearRequest: vi.fn() }),
}));
vi.mock('@/stores/useTranscriptionStore', () => ({
  useTranscriptionStore: () => ({ isTranscriptionEnabled: false, transcriptionLanguage: 'en-US', setLocalTranscript: vi.fn(), sendTranscription: vi.fn(), toggleTranscription: vi.fn() }),
}));
vi.mock('@/stores/useChatStore', () => ({
  useChatStore: (selector: (state: { unreadCount: number; fileTransfers: Map<string, unknown> }) => unknown) => selector({ unreadCount: 0, fileTransfers: new Map() }),
}));
vi.mock('@/stores/useUIManagementStore', () => ({
  useUIManagementStore: () => ({
    isPanelOpen: (panel: string) => openPanelsState.has(panel),
    closePanel: vi.fn(),
    setViewMode: vi.fn(),
    viewMode: 'speaker',
    activePanel: activePanelState,
  }),
}));
vi.mock('@/stores/useDeviceMetadataStore', () => ({
  useDeviceMetadataStore: { getState: () => ({ broadcastMetadata: vi.fn() }) },
}));
vi.mock('@/types/roomCapabilities', () => ({
  DEFAULT_ROOM_TYPE: 'video-group',
  getDefaultViewMode: () => 'speaker',
  isValidRoomType: (value: string | null) => value === roomTypeState,
}));
vi.mock('@/utils/nickname', () => ({ generateRandomNickname: () => 'Generated Nickname' }));
vi.mock('@/utils/session.utils', () => ({ sessionManager: { getNickname: () => 'Stored Nickname', saveNickname: vi.fn() } }));
vi.mock('@/lib/avatar/dicebear', () => ({ getRandomAvatarPreset: () => ({ id: 'preset-1', seed: 'preset-1' }), getStoredAvatarPreset: () => null }));
vi.mock('nanoid', () => ({ nanoid: () => 'generated-user-id' }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
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

describe('Room collaboration modes slice 5', () => {
  beforeEach(() => {
    activePanelState = 'none';
    openPanelsState = new Set();
  });

  it('treats whiteboard as a board session mode instead of only a popup panel', () => {
    activePanelState = 'whiteboard';
    openPanelsState = new Set(['whiteboard']);

    renderRoom();

    expect(screen.getAllByText('Board mode').length).toBeGreaterThan(0);
    expect(screen.getByText('Collaborative whiteboard is steering the session right now.')).toBeInTheDocument();
    expect(screen.getByTestId('active-surface-label')).toHaveTextContent('Whiteboard');
  });

  it('treats CoWatch as a watch session mode while keeping the room shell intact', () => {
    activePanelState = 'cowatch';
    openPanelsState = new Set(['cowatch']);

    renderRoom();

    expect(screen.getAllByText('Watch mode').length).toBeGreaterThan(0);
    expect(screen.getByText('Shared watching is the active stage while people and chat stay attached.')).toBeInTheDocument();
    expect(screen.getByTestId('active-surface-label')).toHaveTextContent('CoWatch');
  });

  it('treats PonsCast as a cast session mode while preserving the file streaming surface', () => {
    activePanelState = 'fileStreaming';
    openPanelsState = new Set(['fileStreaming']);

    renderRoom();

    expect(screen.getAllByText('Cast mode').length).toBeGreaterThan(0);
    expect(screen.getByText('PonsCast takes the stage while files and playback stay visible as room context.')).toBeInTheDocument();
    expect(screen.getAllByText('PonsCast').length).toBeGreaterThan(0);
  });
});
