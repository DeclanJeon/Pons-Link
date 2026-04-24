import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MobileVideoLayout } from './MobileVideoLayout';

const mockParticipants = [
  { userId: 'local', nickname: 'Me', stream: { id: 's1' }, videoEnabled: true, isLocal: true },
  { userId: 'r1', nickname: 'Alice', stream: { id: 's2' }, videoEnabled: true, isLocal: false },
  { userId: 'r2', nickname: 'Bob', stream: { id: 's3' }, videoEnabled: true, isLocal: false },
  { userId: 'r3', nickname: 'Carol', stream: { id: 's4' }, videoEnabled: false, isLocal: false },
];

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
  VideoPreview: ({ nickname, isLocalVideo, userId }: any) => (
    <div data-testid={`video-${userId}`} data-local={isLocalVideo}>{nickname}</div>
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
});
