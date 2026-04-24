import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VideoPreview } from './VideoPreview';

vi.mock('./PonsCastReceiverViewer', () => ({
  PonsCastReceiverViewer: ({ nickname, userId }: { nickname: string; userId: string }) => (
    <div data-testid="ponscast-receiver" data-user-id={userId}>{nickname} PonsCast receiver</div>
  ),
}));

vi.mock('@/hooks/useVideoFullscreen', () => ({
  useVideoFullscreen: () => ({ isFullscreen: false, handleDoubleClick: vi.fn() }),
}));

vi.mock('@/stores/useSubtitleStore', () => ({
  useSubtitleStore: () => ({ isEnabled: true }),
}));

const deviceState = {
  localMetadata: { preferredObjectFit: 'cover' },
  remoteMetadata: new Map(),
  setPreferredObjectFit: vi.fn(),
};

vi.mock('@/stores/useDeviceMetadataStore', () => ({
  useDeviceMetadataStore: Object.assign(
    vi.fn((selector?: (state: typeof deviceState) => unknown) => (selector ? selector(deviceState) : deviceState)),
    { getState: () => deviceState },
  ),
}));

describe('VideoPreview PonsCast receiver branch', () => {
  it('renders the binary PonsCast receiver for remote file streaming without a media stream', () => {
    render(
      <VideoPreview
        stream={null}
        isVideoEnabled
        nickname="Nova"
        isLocalVideo={false}
        isFileStreaming
        userId="remote-a"
      />,
    );

    expect(screen.getByTestId('ponscast-receiver')).toHaveAttribute('data-user-id', 'remote-a');
  });

  it('renders the binary PonsCast receiver when a remote placeholder stream has no video tracks', () => {
    const placeholderStream = { getVideoTracks: () => [] } as unknown as MediaStream;

    render(
      <VideoPreview
        stream={placeholderStream}
        isVideoEnabled
        nickname="Nova"
        isLocalVideo={false}
        isFileStreaming
        userId="remote-a"
      />,
    );

    expect(screen.getByTestId('ponscast-receiver')).toBeInTheDocument();
  });

  it('keeps local file streaming on the normal preview path', () => {
    render(
      <VideoPreview
        stream={null}
        isVideoEnabled
        nickname="Me"
        isLocalVideo
        isFileStreaming
        userId="local-a"
      />,
    );

    expect(screen.queryByTestId('ponscast-receiver')).not.toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
  });
});
