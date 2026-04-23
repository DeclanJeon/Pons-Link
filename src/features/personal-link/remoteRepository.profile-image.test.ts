import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRemoteRepository } from './remoteRepository';
import { useAuthSessionStore } from './authSessionStore';

const SESSION = {
  userId: 'host-1',
  providerSubject: 'google-oauth2|host-1',
  email: 'host@example.com',
  displayName: 'Host Name',
  avatarUrl: 'https://example.com/host.png',
  loggedInAt: '2026-04-23T00:00:00.000Z',
  sessionToken: 'backend-session-token',
};

describe('remoteRepository profile image url normalization', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthSessionStore.getState().logout();
  });

  it('resolves uploaded profile image paths against the remote api origin', async () => {
    useAuthSessionStore.getState().setSession(SESSION);

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ imageUrl: '/uploads/lounge/profile-host-1.png' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const repository = createRemoteRepository('https://api.pons.link');
    const imageUrl = await repository.saveAccountProfileImage(
      new File(['avatar'], 'avatar.png', { type: 'image/png' }),
    );

    expect(imageUrl).toBe('https://api.pons.link/uploads/lounge/profile-host-1.png');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.pons.link/api/lounge/profile/image',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('hydrates a relative bootstrap profile image against the remote api origin', async () => {
    useAuthSessionStore.getState().setSession(SESSION);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        accountProfile: {
          userId: 'host-1',
          displayName: 'Host Name',
          profileImageUrl: '/uploads/lounge/profile-host-1.png',
        },
        publicProfile: {
          userId: 'host-1',
          slug: 'host-name',
          headline: 'Creator link',
          bio: 'Profile bio',
          responsePolicy: 'approve_before_booking',
          defaultRoomType: 'audio-one-to-one',
          timezone: 'Asia/Seoul',
          profileVisibility: 'public',
          allowGeneralRequest: true,
          allowScheduleRequest: true,
          allowMentoringRequest: true,
          allowCollabRequest: true,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const repository = createRemoteRepository('https://api.pons.link');
    const bootstrap = await repository.getAuthBootstrapProfile('host@example.com');

    expect(bootstrap.accountProfile?.profileImageUrl).toBe('https://api.pons.link/uploads/lounge/profile-host-1.png');
  });
});
