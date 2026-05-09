import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('@/lib/media/cameraReframe', () => ({
  DEFAULT_CAMERA_REFRAME_POSITION: { x: 50, y: 44 },
  blendReframePosition: (current: { x: number; y: number }, next: { x: number; y: number }) => next || current,
  detectCameraReframePosition: vi.fn(async () => null),
}));

let localCameraPrivacyMode = 'camera';
let localVideoMirrored = true;

vi.mock('@/stores/useMediaQualityStore', () => ({
  useMediaQualityStore: (selector?: (state: { cameraPrivacyMode: string; localVideoMirrored: boolean }) => unknown) => {
    const state = { cameraPrivacyMode: localCameraPrivacyMode, localVideoMirrored };
    return selector ? selector(state) : state;
  },
}));

const deviceState = {
  localMetadata: { preferredObjectFit: 'balanced' },
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
  beforeEach(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });
    deviceState.localMetadata.preferredObjectFit = 'balanced';
    deviceState.remoteMetadata.clear();
    localCameraPrivacyMode = 'camera';
    localVideoMirrored = true;
    vi.clearAllMocks();
  });

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

  it('uses a dynamic portrait frame while preserving the camera crop in balanced mode', () => {
    const cameraStream = {
      getVideoTracks: () => [{ getSettings: () => ({ width: 720, height: 1280 }) }],
    } as unknown as MediaStream;

    const { container } = render(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Me"
        isLocalVideo
        userId="local-a"
      />,
    );

    const videos = container.querySelectorAll('video');
    expect(videos).toHaveLength(2);
    expect(videos[0]).toHaveAttribute('aria-hidden', 'true');
    expect(videos[0].className).not.toContain('blur');
    expect(container.querySelector('[data-video-display-mode="balanced"]')).toHaveStyle({
      aspectRatio: '0.5625',
      height: '100%',
    });
    expect(videos[1]).toHaveClass('object-cover');
  });

  it('keeps camera option controls above dynamic framing video layers', () => {
    const cameraStream = {
      getVideoTracks: () => [{ getSettings: () => ({ width: 720, height: 1280 }) }],
    } as unknown as MediaStream;

    render(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Me"
        isLocalVideo
        userId="local-a"
      />,
    );

    const settingsButton = screen.getByLabelText('Video display settings');
    const reframeButton = screen.getByLabelText('Reframe camera / 얼굴 중앙 맞춤');
    const fullscreenButton = screen.getByLabelText('Enter fullscreen / 전체화면으로 보기');
    const controlsLayer = settingsButton.parentElement;

    expect(controlsLayer).toHaveClass('z-30');
    expect(fullscreenButton.parentElement).toBe(controlsLayer);
    expect(reframeButton.parentElement).toBe(controlsLayer);
    expect(settingsButton).toHaveClass('h-9', 'w-9');
    expect(reframeButton).toHaveClass('h-9', 'w-9');
    expect(fullscreenButton).toHaveClass('h-9', 'w-9');
  });

  it('keeps the participant name badge above dynamic framing video layers', () => {
    const cameraStream = {
      getVideoTracks: () => [{ getSettings: () => ({ width: 720, height: 1280 }) }],
    } as unknown as MediaStream;

    render(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Me"
        isLocalVideo
        userId="local-a"
      />,
    );

    expect(screen.getByText('Me (You)')).toHaveClass('z-20');
  });

  it('shows a shared live avatar status above the camera tile', () => {
    localCameraPrivacyMode = 'live-avatar';
    const cameraStream = {
      getVideoTracks: () => [{ getSettings: () => ({ width: 1280, height: 720 }) }],
    } as unknown as MediaStream;

    render(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Me"
        isLocalVideo
        userId="local-a"
      />,
    );

    expect(screen.getByLabelText('Camera status: Live Avatar')).toHaveTextContent('Live Avatar');
  });

  it('keeps fill mode edge-to-edge with cover cropping', () => {
    deviceState.localMetadata.preferredObjectFit = 'fill';
    const cameraStream = { getVideoTracks: () => [{}] } as unknown as MediaStream;

    const { container } = render(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Me"
        isLocalVideo
        userId="local-a"
      />,
    );

    const videos = container.querySelectorAll('video');
    expect(videos).toHaveLength(1);
    expect(videos[0]).toHaveStyle({ objectFit: 'cover' });
  });

  it('switches the local tile to center face framing from the reframe control', () => {
    const cameraStream = { getVideoTracks: () => [{}] } as unknown as MediaStream;

    render(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Me"
        isLocalVideo
        userId="local-a"
      />,
    );

    fireEvent.click(screen.getByLabelText('Reframe camera / 얼굴 중앙 맞춤'));

    expect(deviceState.setPreferredObjectFit).toHaveBeenCalledWith('reframe');
  });

  it('uses a full-frame self view for center face mode before detection updates', () => {
    deviceState.localMetadata.preferredObjectFit = 'reframe';
    const cameraStream = { getVideoTracks: () => [{}] } as unknown as MediaStream;

    const { container } = render(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Me"
        isLocalVideo
        userId="local-a"
      />,
    );

    const video = container.querySelector('video[data-video-display-mode="reframe"]');
    expect(video).toHaveStyle({
      objectFit: 'contain',
      objectPosition: '50% 44%',
    });
  });

  it('mirrors only the local camera preview when mirror self view is enabled', () => {
    deviceState.localMetadata.preferredObjectFit = 'fill';
    const cameraStream = { getVideoTracks: () => [{}] } as unknown as MediaStream;

    const { container, rerender } = render(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Me"
        isLocalVideo
        userId="local-a"
      />,
    );

    expect(container.querySelector('video[data-video-display-mode="fill"]')).toHaveStyle({
      transform: 'scaleX(-1)',
    });

    deviceState.remoteMetadata.set('remote-a', { preferredObjectFit: 'fill' });

    rerender(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Nova"
        isLocalVideo={false}
        userId="remote-a"
      />,
    );

    expect(container.querySelector('video[data-video-display-mode="fill"]')).not.toHaveStyle({
      transform: 'scaleX(-1)',
    });
  });

  it('rebinds the unchanged stream when framing mode swaps the video element', () => {
    deviceState.localMetadata.preferredObjectFit = 'fill';
    const cameraStream = { getVideoTracks: () => [{ getSettings: () => ({ width: 1280, height: 720 }) }] } as unknown as MediaStream;

    const { container, rerender } = render(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Me"
        isLocalVideo
        userId="local-a"
      />,
    );

    const firstVideo = container.querySelector('video');
    expect(firstVideo?.srcObject).toBe(cameraStream);

    deviceState.localMetadata.preferredObjectFit = 'balanced';
    rerender(
      <VideoPreview
        stream={cameraStream}
        isVideoEnabled
        nickname="Me again"
        isLocalVideo
        userId="local-a"
      />,
    );

    const videos = container.querySelectorAll('video');
    expect(videos).toHaveLength(2);
    expect(videos[0].srcObject).toBe(cameraStream);
    expect(videos[1].srcObject).toBe(cameraStream);
  });
});
