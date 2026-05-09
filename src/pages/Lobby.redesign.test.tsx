import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Lobby from './Lobby';
import type { RoomType } from '@/types/room.types';

const {
  navigateMock,
  initializeMock,
  cleanupMock,
  setNavigatingToRoomMock,
  updateNicknameMock,
  toggleAudioMock,
  changeAudioDeviceMock,
  changeVideoDeviceMock,
  cleanupMediaDeviceMock,
  setSessionMock,
  setLocalAvatarMock,
  setLocalAvatarUrlMock,
  setLocalUserIdMock,
  toastErrorMock,
  toastSuccessMock,
  saveNicknameMock,
  saveAvatarPresetMock,
  deviceSelectorMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  initializeMock: vi.fn(),
  cleanupMock: vi.fn(),
  setNavigatingToRoomMock: vi.fn(),
  updateNicknameMock: vi.fn(),
  toggleAudioMock: vi.fn(),
  changeAudioDeviceMock: vi.fn(),
  changeVideoDeviceMock: vi.fn(),
  cleanupMediaDeviceMock: vi.fn(),
  setSessionMock: vi.fn(),
  setLocalAvatarMock: vi.fn(),
  setLocalAvatarUrlMock: vi.fn(),
  setLocalUserIdMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  saveNicknameMock: vi.fn(),
  saveAvatarPresetMock: vi.fn(),
  deviceSelectorMock: vi.fn(),
}));

type LobbyState = {
  roomTitle: string;
  roomType: RoomType;
  nickname: string;
};

let lobbyState: LobbyState = {
  roomTitle: 'Feature Demo Room',
  roomType: 'video-group',
  nickname: 'Host One',
};

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => 'desktop',
  getResponsiveClasses: (_deviceInfo: string, classes: Record<string, string>) => classes.desktop ?? classes.tablet ?? classes.mobile ?? '',
}));

vi.mock('@/components/media/VideoPreview', () => ({
  VideoPreview: ({ nickname }: { nickname: string }) => <div data-testid="video-preview">Video preview for {nickname}</div>,
}));

vi.mock('@/components/lobby/AvatarPicker', () => ({
  AvatarPicker: ({ onSelect }: { onSelect: (preset: { id: string; seed: string }) => void }) => (
    <div data-testid="avatar-picker">
      <button type="button" onClick={() => onSelect({ id: 'preset-2', seed: 'preset-2' })}>
        Choose avatar
      </button>
    </div>
  ),
}));

vi.mock('@/components/setting/DeviceSelector', () => ({
  DeviceSelector: (props: {
    showVideoSelector: boolean;
    onAudioDeviceChange: (deviceId: string) => void;
    onVideoDeviceChange: (deviceId: string) => void;
  }) => {
    deviceSelectorMock(props);
    return (
      <div data-testid="device-selector" data-show-video-selector={String(props.showVideoSelector)}>
        <button type="button" onClick={() => props.onAudioDeviceChange('audio-device-2')}>
          Select audio device
        </button>
        <button type="button" onClick={() => props.onVideoDeviceChange('video-device-2')}>
          Select video device
        </button>
      </div>
    );
  },
}));

vi.mock('@/stores/useLobbyStore', () => ({
  useLobbyStore: () => ({
    connectionDetails: {
      roomTitle: lobbyState.roomTitle,
      roomType: lobbyState.roomType,
      nickname: lobbyState.nickname,
    },
    isInitialized: true,
    initialize: initializeMock,
    cleanup: cleanupMock,
    setNavigatingToRoom: setNavigatingToRoomMock,
    updateNickname: updateNicknameMock,
  }),
}));

vi.mock('@/stores/useMediaDeviceStore', () => ({
  useMediaDeviceStore: () => ({
    localStream: { id: 'local-stream' },
    audioInputs: [{ deviceId: 'audio-device-1', label: 'Primary mic' }],
    videoInputs: [{ deviceId: 'video-device-1', label: 'Primary camera' }],
    selectedAudioDeviceId: 'audio-device-1',
    selectedVideoDeviceId: 'video-device-1',
    isAudioEnabled: true,
    isVideoEnabled: true,
    toggleAudio: toggleAudioMock,
    changeAudioDevice: changeAudioDeviceMock,
    changeVideoDevice: changeVideoDeviceMock,
    cleanup: cleanupMediaDeviceMock,
  }),
}));

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: () => ({
    setSession: setSessionMock,
  }),
}));

vi.mock('@/stores/useParticipantProfileStore', () => ({
  useParticipantProfileStore: () => ({
    setLocalAvatar: setLocalAvatarMock,
    setLocalAvatarUrl: setLocalAvatarUrlMock,
    setLocalUserId: setLocalUserIdMock,
  }),
}));

vi.mock('@/utils/session.utils', () => ({
  sessionManager: {
    getNickname: vi.fn(() => 'Stored Nickname'),
    saveNickname: saveNicknameMock,
  },
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'generated-user-id',
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock('@/utils/nickname', () => ({
  generateRandomNickname: () => 'Generated Nickname',
}));

vi.mock('@/lib/avatar/dicebear', () => ({
  getDefaultAvatarPresets: () => [
    { id: 'preset-1', seed: 'preset-1' },
    { id: 'preset-2', seed: 'preset-2' },
  ],
  getInitialAvatarPreset: () => ({ id: 'preset-1', seed: 'preset-1' }),
  saveAvatarPreset: saveAvatarPresetMock,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const renderLobby = (roomType: RoomType = 'video-group') => {
  lobbyState = {
    roomTitle: 'Feature Demo Room',
    roomType,
    nickname: 'Host One',
  };

  return render(
    <MemoryRouter initialEntries={[`/lobby/${encodeURIComponent(lobbyState.roomTitle)}?type=${roomType}`]}>
      <Routes>
        <Route path="/lobby/:roomTitle" element={<Lobby />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('Lobby redesign slice 1', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    initializeMock.mockReset();
    cleanupMock.mockReset();
    setNavigatingToRoomMock.mockReset();
    updateNicknameMock.mockReset();
    toggleAudioMock.mockReset();
    changeAudioDeviceMock.mockReset();
    changeVideoDeviceMock.mockReset();
    cleanupMediaDeviceMock.mockReset();
    setSessionMock.mockReset();
    setLocalAvatarMock.mockReset();
    setLocalAvatarUrlMock.mockReset();
    setLocalUserIdMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
    saveNicknameMock.mockReset();
    saveAvatarPresetMock.mockReset();
    deviceSelectorMock.mockReset();
    window.localStorage.clear();
  });

  it('video-group renders warm welcome shell with identity, preview, readiness, join regions', async () => {
    renderLobby('video-group');

    expect(screen.getByRole('region', { name: 'Lobby identity' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Preview stage' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Readiness panel' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Join footer' })).toBeInTheDocument();
    expect(screen.getByText(/your space is ready/i)).toBeInTheDocument();
    expect(screen.getByText(/open room/i)).toBeInTheDocument();
    expect(screen.getByTestId('video-preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join room/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(initializeMock).toHaveBeenCalledWith('Feature Demo Room', 'Stored Nickname', 'video-group');
    });
  });

  it('audio-group renders same shell with audio-first preview and voice-room copy', () => {
    renderLobby('audio-group');

    expect(screen.getByRole('region', { name: 'Lobby identity' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Preview stage' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Readiness panel' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Join footer' })).toBeInTheDocument();
    expect(screen.getByText(/camera stays off here/i)).toBeInTheDocument();
    expect(screen.getByTestId('avatar-picker')).toBeInTheDocument();
    expect(screen.queryByTestId('video-preview')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enter voice room/i })).toBeInTheDocument();
  });

  it('nickname editing persists updated nickname via updateNickname and session save', async () => {
    renderLobby('video-group');

    const nicknameInput = screen.getByRole('textbox', { name: /nickname input/i });
    fireEvent.focus(nicknameInput);
    fireEvent.change(nicknameInput, { target: { value: 'Updated Nickname' } });
    fireEvent.click(screen.getByRole('button', { name: /save nickname/i }));

    await waitFor(() => {
      expect(updateNicknameMock).toHaveBeenCalledWith('Updated Nickname');
    });
    expect(saveNicknameMock).toHaveBeenCalledWith('Updated Nickname');
  });

  it('device selector parity: audio-group hides camera selector, video-group shows it', () => {
    renderLobby('audio-group');
    expect(deviceSelectorMock).toHaveBeenLastCalledWith(expect.objectContaining({ showVideoSelector: false }));

    deviceSelectorMock.mockReset();

    renderLobby('video-group');
    expect(deviceSelectorMock).toHaveBeenLastCalledWith(expect.objectContaining({ showVideoSelector: true }));
  });

  it('join CTA navigates to matching room route and calls setNavigatingToRoom and setSession', async () => {
    renderLobby('audio-group');

    fireEvent.click(screen.getByRole('button', { name: /enter voice room/i }));

    await waitFor(() => {
      expect(setNavigatingToRoomMock).toHaveBeenCalledWith(true);
    });
    expect(setSessionMock).toHaveBeenCalledWith('generated-user-id', 'Host One', 'Feature Demo Room', 'audio-group');
    expect(navigateMock).toHaveBeenCalledWith('/room/Feature%20Demo%20Room?type=audio-group');
  });
});
