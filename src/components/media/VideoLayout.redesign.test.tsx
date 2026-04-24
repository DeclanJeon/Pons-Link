import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoLayout } from './VideoLayout';

type MockParticipant = {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  isLocal: boolean;
  videoEnabled: boolean;
  isSharingScreen: boolean;
  isStreamingFile: boolean;
  isRelay: boolean;
  stream: { id: string } | null;
  connectionState: 'connected' | 'connecting' | 'disconnected' | 'failed';
  transcript?: string;
};

const { setMainContentParticipantMock } = vi.hoisted(() => ({
  setMainContentParticipantMock: vi.fn(),
}));

let viewModeState: 'speaker' | 'grid' | 'viewer' = 'speaker';
let participantsState: MockParticipant[] = [];
let widthState = 1440;
let isMobileState = false;
let isPortraitState = false;
let mainContentParticipantIdState: string | null = null;

vi.mock('@/components/media/VideoPreview', () => ({
  VideoPreview: ({ nickname, isLocalVideo }: { nickname: string; isLocalVideo: boolean }) => (
    <div data-testid={isLocalVideo ? 'local-video-preview' : `remote-video-preview-${nickname}`}>{nickname}</div>
  ),
}));

vi.mock('@/components/media/DraggableVideo', () => ({
  DraggableVideo: ({ nickname }: { nickname: string }) => <div data-testid={`draggable-${nickname}`}>{nickname}</div>,
}));

vi.mock('./SubtitleOverlay', () => ({
  SubtitleOverlay: ({ transcript }: { transcript: string }) => <div data-testid="subtitle-overlay">{transcript}</div>,
}));

vi.mock('./MobileSpeakerStrip', () => ({
  default: () => <div data-testid="mobile-speaker-strip">mobile speaker strip</div>,
}));

vi.mock('./MobileVideoLayout', () => ({
  MobileVideoLayout: () => <div data-testid="mobile-video-layout">mobile video layout</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock('@/hooks/useParticipants', () => ({
  useParticipants: () => participantsState,
}));

vi.mock('@/hooks/useResponsiveGrid', () => ({
  useResponsiveVideoGrid: () => ({
    containerClass: 'grid-container',
    gridClass: 'grid-layout',
    gap: 'gap-2',
    itemClass: 'grid-item',
    isMobile: false,
    layout: participantsState.length >= 4 ? 'custom-4' : 'default',
  }),
}));

vi.mock('@/hooks/useScreenOrientation', () => ({
  useScreenOrientation: () => ({ isPortrait: isPortraitState }),
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: isMobileState, width: widthState }),
}));

vi.mock('@/stores/useMediaDeviceStore', () => ({
  useMediaDeviceStore: () => ({
    switchCamera: vi.fn(),
    isMobile: false,
    hasMultipleCameras: false,
  }),
}));

vi.mock('@/stores/useTranscriptionStore', () => ({
  useTranscriptionStore: () => ({
    translationTargetLanguage: 'en',
  }),
}));

vi.mock('@/stores/useSubtitleStore', () => ({
  useSubtitleStore: () => ({}),
}));

vi.mock('@/stores/useUIManagementStore', () => ({
  useUIManagementStore: () => ({
    viewMode: viewModeState,
    mainContentParticipantId: mainContentParticipantIdState,
    setMainContentParticipant: setMainContentParticipantMock,
  }),
}));

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: (selector: (state: { userId: string }) => unknown) => selector({ userId: 'local-user' }),
}));

const localParticipant: MockParticipant = {
  userId: 'local-user',
  nickname: 'Hermes',
  isLocal: true,
  videoEnabled: true,
  isSharingScreen: false,
  isStreamingFile: false,
  isRelay: false,
  stream: { id: 'local-stream' },
  connectionState: 'connected',
};

const remoteA: MockParticipant = {
  userId: 'remote-a',
  nickname: 'Nova',
  isLocal: false,
  videoEnabled: true,
  isSharingScreen: false,
  isStreamingFile: false,
  isRelay: false,
  stream: { id: 'remote-a-stream' },
  connectionState: 'connected',
};

const remoteB: MockParticipant = {
  userId: 'remote-b',
  nickname: 'Mina',
  isLocal: false,
  videoEnabled: true,
  isSharingScreen: false,
  isStreamingFile: false,
  isRelay: false,
  stream: { id: 'remote-b-stream' },
  connectionState: 'connected',
};

describe('VideoLayout redesign slice 3', () => {
  beforeEach(() => {
    setMainContentParticipantMock.mockReset();
    participantsState = [localParticipant, remoteA, remoteB];
    viewModeState = 'speaker';
    widthState = 1440;
    isMobileState = false;
    isPortraitState = false;
    mainContentParticipantIdState = null;
  });

  it('shows focus-view framing and participant strip in speaker mode', () => {
    render(<VideoLayout />);

    expect(screen.getByTestId('remote-video-preview-Nova')).toBeInTheDocument();
    expect(screen.getByTestId('draggable-Hermes')).toBeInTheDocument();
  });

  it('shows content-view framing and viewer gallery in viewer mode', () => {
    viewModeState = 'viewer';
    mainContentParticipantIdState = 'remote-b';

    render(<VideoLayout />);

    expect(screen.getByTestId('remote-video-preview-Mina')).toBeInTheDocument();
  });

  it('shows group-view framing in grid mode without removing the grid layout', () => {
    viewModeState = 'grid';

    render(<VideoLayout />);

    expect(screen.getByTestId('remote-video-preview-Nova')).toBeInTheDocument();
    expect(screen.getByTestId('remote-video-preview-Mina')).toBeInTheDocument();
  });
});
