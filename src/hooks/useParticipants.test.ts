import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParticipants } from './useParticipants';

const { state } = vi.hoisted(() => ({
  state: {
    peers: new Map<string, any>(),
    media: {
      localStream: null,
      isVideoEnabled: true,
      isAudioEnabled: true,
      isSharingScreen: false,
      isClickCapSharing: false,
      localDisplayOverride: null,
    },
    session: {
      userId: 'local-user',
      nickname: 'Local Nick',
      getSessionInfo: () => ({ userId: 'local-user', nickname: 'Local Nick' }),
    },
    fileStreaming: { isStreaming: false },
    transcription: { localTranscript: null, transcriptionLanguage: 'auto', detectedLanguage: null },
    relay: { takeoverMode: false },
    profile: {
      localProfile: { avatarUrl: 'https://example.com/local.svg' },
      remoteProfiles: new Map<string, any>(),
    },
    metadata: {
      remoteMetadata: new Map<string, any>(),
    },
    quality: {
      cameraPrivacyMode: 'camera',
    },
  },
}));

vi.mock('@/stores/usePeerConnectionStore', () => ({
  usePeerConnectionStore: (selector: (value: typeof state) => unknown) => selector(state as any),
}));

vi.mock('@/stores/useMediaDeviceStore', () => ({
  useMediaDeviceStore: () => state.media,
}));

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: () => state.session,
}));

vi.mock('@/stores/useFileStreamingStore', () => ({
  useFileStreamingStore: () => state.fileStreaming,
}));

vi.mock('@/stores/useTranscriptionStore', () => ({
  useTranscriptionStore: () => state.transcription,
}));

vi.mock('@/stores/useRelayStore', () => ({
  useRelayStore: () => state.relay,
}));

vi.mock('@/stores/useParticipantProfileStore', () => ({
  useParticipantProfileStore: (selector: (value: typeof state.profile) => unknown) => selector(state.profile as any),
}));

vi.mock('@/stores/useDeviceMetadataStore', () => ({
  useDeviceMetadataStore: (selector: (value: typeof state.metadata) => unknown) => selector(state.metadata as any),
}));

vi.mock('@/stores/useMediaQualityStore', () => ({
  useMediaQualityStore: (selector: (value: typeof state.quality) => unknown) => selector(state.quality as any),
}));

describe('useParticipants', () => {
  beforeEach(() => {
    state.peers = new Map();
    state.profile.remoteProfiles = new Map();
    state.metadata.remoteMetadata = new Map();
    state.quality.cameraPrivacyMode = 'camera';
  });

  it('uses remote profile nickname as a fallback when peer nickname is missing', () => {
    state.peers.set('remote-user', {
      userId: 'remote-user',
      nickname: '',
      audioEnabled: true,
      videoEnabled: true,
      isSharingScreen: false,
      isClickCapSharing: false,
      connectionState: 'connected',
      isStreamingFile: false,
    });
    state.profile.remoteProfiles.set('remote-user', {
      nickname: 'Remote Nick',
      avatarUrl: 'https://example.com/remote.svg',
    });
    state.metadata.remoteMetadata.set('remote-user', {
      cameraPrivacyMode: 'live-avatar',
    });

    const { result } = renderHook(() => useParticipants());

    expect(result.current[1]).toMatchObject({
      userId: 'remote-user',
      nickname: 'Remote Nick',
      avatarUrl: 'https://example.com/remote.svg',
      cameraPrivacyMode: 'live-avatar',
    });
  });
});
