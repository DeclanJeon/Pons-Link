import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFileStreaming } from './useFileStreaming';

const replaceSenderTrack = vi.fn().mockResolvedValue(true);
const sendToAllPeers = vi.fn();
const saveOriginalMediaState = vi.fn();
const restoreOriginalMediaState = vi.fn().mockResolvedValue(true);
const setFileStreaming = vi.fn();
const createStream = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { feature: vi.fn() },
}));

vi.mock('@/stores/useMediaDeviceStore', () => {
  const hook = () => ({ saveOriginalMediaState, restoreOriginalMediaState, setFileStreaming });
  hook.getState = () => ({ isAudioEnabled: true, isVideoEnabled: true, isSharingScreen: false });
  return { useMediaDeviceStore: hook };
});

vi.mock('@/stores/useSubtitleStore', () => ({
  useSubtitleStore: { getState: () => ({ isEnabled: false }) },
}));

vi.mock('@/stores/usePeerConnectionStore', () => ({
  usePeerConnectionStore: { getState: () => ({ activeTransfers: new Map(), sendToAllPeers }) },
}));

vi.mock('@/services/adaptiveStreamManager', () => ({
  AdaptiveStreamManager: vi.fn().mockImplementation(() => ({
    getInfo: () => ({
      device: { isIOS: false },
      strategy: {
        strategy: 'capturestream',
        reason: 'test',
        fallbacks: [],
        config: { fps: 30, videoBitsPerSecond: 1000000, audioBitsPerSecond: 128000, chunkSize: 1024, timeslice: 1000 },
      },
    }),
    createStream,
    cleanup: vi.fn(),
    forceStreamUpdate: vi.fn(),
  })),
}));

const makeTrack = (kind: 'audio' | 'video', id: string): MediaStreamTrack => ({
  kind,
  id,
  label: id,
  getSettings: () => ({}),
  enabled: true,
  readyState: 'live',
  stop: vi.fn(),
} as unknown as MediaStreamTrack);

const makeStream = (tracks: MediaStreamTrack[]) => ({
  getTracks: () => tracks,
  getAudioTracks: () => tracks.filter(track => track.kind === 'audio'),
  getVideoTracks: () => tracks.filter(track => track.kind === 'video'),
  addTrack: vi.fn(),
  removeTrack: vi.fn(),
} as unknown as MediaStream);

describe('useFileStreaming PonsCast audio routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the microphone audio sender when the PonsCast media stream has its own audio track', async () => {
    const micTrack = makeTrack('audio', 'mic');
    const cameraTrack = makeTrack('video', 'camera');
    const mediaAudioTrack = makeTrack('audio', 'media-audio');
    const mediaVideoTrack = makeTrack('video', 'media-video');
    const localStream = makeStream([micTrack, cameraTrack]);
    const ponsCastStream = makeStream([mediaVideoTrack, mediaAudioTrack]);

    createStream.mockResolvedValue({
      stream: ponsCastStream,
      strategy: 'capturestream',
      config: { fps: 30, mimeType: 'video/webm' },
      cleanup: vi.fn(),
    });

    const video = document.createElement('video');
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    Object.defineProperty(video, 'paused', { value: false, configurable: true });

    const { result } = renderHook(() => useFileStreaming({
      canvasRef: { current: null },
      videoRef: { current: video },
      webRTCManager: { sendToAllPeers, replaceSenderTrack },
      localStream,
      peers: new Map(),
      isStreaming: false,
      setIsStreaming: vi.fn(),
      streamQuality: 'medium',
      fileType: 'video',
    }));

    await act(async () => {
      await result.current.startStreaming(new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    });

    expect(replaceSenderTrack).toHaveBeenCalledWith('video', mediaVideoTrack);
    expect(replaceSenderTrack).not.toHaveBeenCalledWith('audio', mediaAudioTrack);
    expect(localStream.getAudioTracks()[0]).toBe(micTrack);
  });

  it('mixes microphone and media audio into a separate sender track when AudioContext is available', async () => {
    const micTrack = makeTrack('audio', 'mic');
    const cameraTrack = makeTrack('video', 'camera');
    const mediaAudioTrack = makeTrack('audio', 'media-audio');
    const mediaVideoTrack = makeTrack('video', 'media-video');
    const mixedAudioTrack = makeTrack('audio', 'mixed-audio');
    const localStream = makeStream([micTrack, cameraTrack]);
    const ponsCastStream = makeStream([mediaVideoTrack, mediaAudioTrack]);

    class MockMediaStream {
      constructor(tracks: MediaStreamTrack[]) {
        return makeStream(tracks);
      }
    }
    vi.stubGlobal('MediaStream', MockMediaStream);

    class MockAudioContext {
      state = 'running';
      createMediaStreamSource() { return { connect: vi.fn((node) => node) }; }
      createMediaStreamDestination() { return { stream: makeStream([mixedAudioTrack]) }; }
      createGain() { return { gain: { value: 1 }, connect: vi.fn((node) => node) }; }
      close = vi.fn().mockResolvedValue(undefined);
    }
    vi.stubGlobal('AudioContext', MockAudioContext);

    createStream.mockResolvedValue({
      stream: ponsCastStream,
      strategy: 'capturestream',
      config: { fps: 30, mimeType: 'video/webm' },
      cleanup: vi.fn(),
    });

    const video = document.createElement('video');
    Object.defineProperty(video, 'readyState', { value: 4, configurable: true });
    Object.defineProperty(video, 'paused', { value: false, configurable: true });

    const { result } = renderHook(() => useFileStreaming({
      canvasRef: { current: null },
      videoRef: { current: video },
      webRTCManager: { sendToAllPeers, replaceSenderTrack },
      localStream,
      peers: new Map(),
      isStreaming: false,
      setIsStreaming: vi.fn(),
      streamQuality: 'medium',
      fileType: 'video',
    }));

    await act(async () => {
      await result.current.startStreaming(new File(['video'], 'clip.mp4', { type: 'video/mp4' }));
    });

    expect(replaceSenderTrack).toHaveBeenCalledWith('video', mediaVideoTrack);
    expect(replaceSenderTrack).toHaveBeenCalledWith('audio', mixedAudioTrack);
    expect(replaceSenderTrack).not.toHaveBeenCalledWith('audio', mediaAudioTrack);
    expect(localStream.getAudioTracks()[0]).toBe(micTrack);
  });
});
