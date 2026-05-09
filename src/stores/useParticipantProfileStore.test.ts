import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParticipantProfileStore } from './useParticipantProfileStore';

const { sendToAllPeersMock, sessionState } = vi.hoisted(() => ({
  sendToAllPeersMock: vi.fn(),
  sessionState: {
    userId: 'local-user',
    nickname: 'Local Nick',
  },
}));

vi.mock('./usePeerConnectionStore', () => ({
  usePeerConnectionStore: {
    getState: () => ({
      sendToAllPeers: sendToAllPeersMock,
    }),
  },
}));

vi.mock('./useSessionStore', () => ({
  useSessionStore: {
    getState: () => ({
      getSessionInfo: () => ({ ...sessionState }),
    }),
  },
}));

describe('useParticipantProfileStore profile broadcasts', () => {
  beforeEach(() => {
    sendToAllPeersMock.mockReset();
    sessionState.userId = 'local-user';
    sessionState.nickname = 'Local Nick';
    useParticipantProfileStore.setState({
      localProfile: {
        userId: 'local',
        avatarId: 'avatar-1',
        avatarSeed: 'nova',
        avatarStyle: 'bottts-neutral',
        avatarUrl: 'https://example.com/old.svg',
      },
      remoteProfiles: new Map(),
    });
  });

  it('broadcasts avatar changes with the current room nickname and user id', () => {
    useParticipantProfileStore.getState().setLocalAvatarUrl('https://example.com/new.svg');

    expect(sendToAllPeersMock).toHaveBeenCalledTimes(1);
    const message = JSON.parse(sendToAllPeersMock.mock.calls[0][0]);
    expect(message).toMatchObject({
      type: 'participant-profile',
      payload: {
        userId: 'local-user',
        nickname: 'Local Nick',
        avatarUrl: 'https://example.com/new.svg',
      },
    });
  });

  it('keeps remote profile nicknames for participant fallback rendering', () => {
    useParticipantProfileStore.getState().updateRemoteProfile('remote-user', {
      userId: 'stale-user',
      nickname: 'Remote Nick',
      avatarId: 'avatar-2',
      avatarSeed: 'luna',
      avatarStyle: 'bottts-neutral',
      avatarUrl: 'https://example.com/remote.svg',
    });

    expect(useParticipantProfileStore.getState().remoteProfiles.get('remote-user')).toMatchObject({
      userId: 'remote-user',
      nickname: 'Remote Nick',
      avatarUrl: 'https://example.com/remote.svg',
    });
  });
});
