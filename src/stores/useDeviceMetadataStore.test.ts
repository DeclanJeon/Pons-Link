import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeviceMetadataStore } from './useDeviceMetadataStore';

const { sendToAllPeersMock, mediaQualityState } = vi.hoisted(() => ({
  sendToAllPeersMock: vi.fn(() => ({ successful: ['peer-1'], failed: [] })),
  mediaQualityState: {
    videoQualityPreset: 'hd',
    audioProcessingMode: 'original-sound',
    cameraPrivacyMode: 'live-avatar',
  },
}));

vi.mock('./usePeerConnectionStore', () => ({
  usePeerConnectionStore: {
    getState: () => ({
      sendToAllPeers: sendToAllPeersMock,
      webRTCManager: {
        getConnectedPeerIds: () => ['peer-1'],
      },
    }),
  },
}));

vi.mock('./useMediaQualityStore', () => ({
  useMediaQualityStore: {
    getState: () => mediaQualityState,
  },
}));

describe('useDeviceMetadataStore media status broadcast', () => {
  beforeEach(() => {
    sendToAllPeersMock.mockClear();
    mediaQualityState.videoQualityPreset = 'hd';
    mediaQualityState.audioProcessingMode = 'original-sound';
    mediaQualityState.cameraPrivacyMode = 'live-avatar';
    useDeviceMetadataStore.setState({
      localMetadata: {
        isMobile: false,
        deviceType: 'desktop',
        preferredObjectFit: 'balanced',
        cameraPrivacyMode: 'camera',
        videoQualityPreset: 'auto',
        audioProcessingMode: 'voice-focus',
        aspectRatio: 16 / 9,
        screenOrientation: 'landscape',
      },
      remoteMetadata: new Map(),
    });
  });

  it('includes camera privacy and quality settings in device metadata', () => {
    useDeviceMetadataStore.getState().broadcastMetadata();

    expect(sendToAllPeersMock).toHaveBeenCalledTimes(1);
    const message = JSON.parse(sendToAllPeersMock.mock.calls[0][0]);
    expect(message).toMatchObject({
      type: 'device-metadata',
      payload: {
        preferredObjectFit: 'balanced',
        cameraPrivacyMode: 'live-avatar',
        videoQualityPreset: 'hd',
        audioProcessingMode: 'original-sound',
      },
    });
  });

  it('accepts center face framing metadata from remote peers', () => {
    useDeviceMetadataStore.getState().updateRemoteMetadata('peer-1', {
      isMobile: false,
      deviceType: 'desktop',
      preferredObjectFit: 'reframe',
      cameraPrivacyMode: 'camera',
      videoQualityPreset: 'auto',
      audioProcessingMode: 'voice-focus',
      aspectRatio: 16 / 9,
      screenOrientation: 'landscape',
    });

    expect(useDeviceMetadataStore.getState().remoteMetadata.get('peer-1')?.preferredObjectFit).toBe('reframe');
  });
});
