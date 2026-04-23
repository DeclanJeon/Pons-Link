import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioRoomLayout } from './AudioRoomLayout';

type MockParticipant = {
  userId: string;
  nickname: string;
  isLocal: boolean;
  isSharingScreen: boolean;
  isStreamingFile: boolean;
  isRelay: boolean;
  stream: { id: string } | null;
  connectionState: 'connected' | 'connecting' | 'disconnected' | 'failed';
};

let participantsState: MockParticipant[] = [];
let mainContentParticipantIdState: string | null = null;

vi.mock('@/hooks/useParticipants', () => ({
  useParticipants: () => participantsState,
}));

vi.mock('@/lib/avatar/dicebear', () => ({
  getStoredAvatarPreset: () => ({ id: 'preset-1', seed: 'preset-1', url: 'avatar://preset-1' }),
}));

vi.mock('@/stores/useUIManagementStore', () => ({
  useUIManagementStore: () => ({
    mainContentParticipantId: mainContentParticipantIdState,
  }),
}));

vi.mock('./AudioParticipantCard', () => ({
  AudioParticipantCard: ({ participant }: { participant: MockParticipant }) => (
    <div data-testid={`audio-card-${participant.nickname}`}>{participant.nickname}</div>
  ),
}));

vi.mock('./VideoPreview', () => ({
  VideoPreview: ({ nickname }: { nickname: string }) => <div data-testid="shared-stage-preview">{nickname}</div>,
}));

describe('AudioRoomLayout redesign slice 6', () => {
  beforeEach(() => {
    participantsState = [
      {
        userId: 'local-user',
        nickname: 'Hermes',
        isLocal: true,
        isSharingScreen: false,
        isStreamingFile: false,
        isRelay: false,
        stream: { id: 'local-stream' },
        connectionState: 'connected',
      },
      {
        userId: 'remote-a',
        nickname: 'Nova',
        isLocal: false,
        isSharingScreen: false,
        isStreamingFile: false,
        isRelay: false,
        stream: { id: 'remote-a-stream' },
        connectionState: 'connected',
      },
      {
        userId: 'remote-b',
        nickname: 'Mina',
        isLocal: false,
        isSharingScreen: true,
        isStreamingFile: false,
        isRelay: false,
        stream: { id: 'remote-b-stream' },
        connectionState: 'connected',
      },
    ];
    mainContentParticipantIdState = null;
  });

  it('renders a premium voice lounge shell with session summary and guidance', () => {
    render(<AudioRoomLayout />);

    expect(screen.getByRole('region', { name: 'Audio room summary' })).toBeInTheDocument();
    expect(screen.getByText('Voice lounge')).toBeInTheDocument();
    expect(screen.getByText('Avatar-first presence')).toBeInTheDocument();
    expect(screen.getByText('Audio room focus')).toBeInTheDocument();
    expect(screen.getByText('People present')).toBeInTheDocument();
  });

  it('shows a shared stage when audio rooms have an active shared participant', () => {
    render(<AudioRoomLayout />);

    expect(screen.getByRole('region', { name: 'Audio shared stage' })).toBeInTheDocument();
    expect(screen.getByText('Shared surface live')).toBeInTheDocument();
    expect(screen.getByTestId('shared-stage-preview')).toHaveTextContent('Mina');
  });

  it('keeps participant lounge cards visible for the remaining people', () => {
    render(<AudioRoomLayout />);

    expect(screen.getByRole('region', { name: 'Voice lounge participant grid' })).toBeInTheDocument();
    expect(screen.getByTestId('audio-card-Hermes')).toBeInTheDocument();
    expect(screen.getByTestId('audio-card-Nova')).toBeInTheDocument();
    expect(screen.queryByTestId('audio-card-Mina')).not.toBeInTheDocument();
  });
});
