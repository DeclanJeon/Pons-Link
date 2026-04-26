import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MobileVideoLayout } from './MobileVideoLayout';
import type { Participant } from '@/hooks/useParticipants';

type MockVideoPreviewProps = {
  nickname: string;
  isLocalVideo: boolean;
  userId: string;
};

const mockParticipants = [
  { userId: 'local', nickname: 'Me', stream: null, audioEnabled: true, videoEnabled: true, isLocal: true, isSharingScreen: false, connectionState: 'connected' },
  { userId: 'r1', nickname: 'Alice', stream: null, audioEnabled: true, videoEnabled: true, isLocal: false, isSharingScreen: false, connectionState: 'connected' },
  { userId: 'r2', nickname: 'Bob', stream: null, audioEnabled: true, videoEnabled: true, isLocal: false, isSharingScreen: false, connectionState: 'connected' },
  { userId: 'r3', nickname: 'Carol', stream: null, audioEnabled: true, videoEnabled: false, isLocal: false, isSharingScreen: false, connectionState: 'connected' },
] satisfies Participant[];

vi.mock('@/hooks/useAdaptiveLayout', () => ({
  useAdaptiveLayout: () => ({
    containerPadding: '12px',
    videoGap: '8px',
    borderRadius: '12px',
    maxVideoWidth: '70%',
  }),
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ orientation: 'portrait', width: 375 }),
}));

vi.mock('./VideoPreview', () => ({
  VideoPreview: ({ nickname, isLocalVideo, userId }: MockVideoPreviewProps) => (
    <div data-testid={`video-${userId}`} data-local={isLocalVideo}>{nickname}</div>
  ),
}));

vi.mock('@/stores/useTranscriptionStore', () => ({
  useTranscriptionStore: () => ({
    translationTargetLanguage: 'ko',
  }),
}));

vi.mock('./SubtitleOverlay', () => ({
  SubtitleOverlay: ({ transcript, targetLang }: { transcript: { text: string }; targetLang: string }) => (
    <div data-testid="mobile-subtitle-overlay" data-target-lang={targetLang}>{transcript.text}</div>
  ),
}));

describe('MobileVideoLayout multi-participant', () => {
  beforeEach(() => cleanup());

  it('renders main remote participant and local participant', () => {
    render(<MobileVideoLayout participants={mockParticipants.slice(0, 2)} localUserId="local" />);
    expect(screen.getByTestId('video-r1')).toHaveTextContent('Alice');
    expect(screen.getByTestId('video-local')).toHaveTextContent('Me');
  });

  it('shows scrollable thumbnail strip when more than 1 remote participant', () => {
    render(<MobileVideoLayout participants={mockParticipants} localUserId="local" />);
    // Main area shows first remote (Alice)
    expect(screen.getByTestId('video-r1')).toBeInTheDocument();
    // Strip should show thumbnails for other remotes (Bob, Carol)
    const strip = screen.getByTestId('participant-strip');
    expect(strip).toBeInTheDocument();
    expect(strip).toHaveTextContent('Bob');
    expect(strip).toHaveTextContent('Carol');
  });

  it('tapping a thumbnail switches the main view to that participant', () => {
    render(<MobileVideoLayout participants={mockParticipants} localUserId="local" />);
    // Initially Alice is main
    expect(screen.getByTestId('video-r1')).toBeInTheDocument();
    // Tap Bob thumbnail
    const bobThumb = screen.getByTestId('thumb-r2');
    fireEvent.click(bobThumb);
    // Bob should now be main (only one Bob video element since he's removed from strip)
    expect(screen.getByTestId('video-r2')).toBeInTheDocument();
    expect(screen.queryByTestId('thumb-r2')).not.toBeInTheDocument();
    // Alice should now be in the strip
    expect(screen.getByTestId('thumb-r1')).toBeInTheDocument();
  });

  it('shows waiting message when no remote participants', () => {
    render(<MobileVideoLayout participants={[mockParticipants[0]]} localUserId="local" />);
    expect(screen.getByText(/waiting for remote/i)).toBeInTheDocument();
  });

  it('hides thumbnail strip when only 1 remote participant', () => {
    render(<MobileVideoLayout participants={mockParticipants.slice(0, 2)} localUserId="local" />);
    expect(screen.queryByTestId('participant-strip')).not.toBeInTheDocument();
  });

  it('passes Settings translation target language into mobile STT captions', () => {
    const participantsWithTranscript = [
      mockParticipants[0],
      {
        ...mockParticipants[1],
        transcript: { text: 'hello from mobile', isFinal: true, lang: 'en-US' },
      },
    ];

    render(<MobileVideoLayout participants={participantsWithTranscript} localUserId="local" />);

    expect(screen.getByTestId('mobile-subtitle-overlay')).toHaveTextContent('hello from mobile');
    expect(screen.getByTestId('mobile-subtitle-overlay')).toHaveAttribute('data-target-lang', 'ko');
  });
});
