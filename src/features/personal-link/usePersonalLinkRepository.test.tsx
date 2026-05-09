import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthSessionStore } from './authSessionStore';
import { getConfiguredPersonalLinkApiUrl, getPersonalLinkRepository, usePersonalLinkRepository } from './usePersonalLinkRepository';

describe('getPersonalLinkRepository', () => {
  beforeEach(() => {
    useAuthSessionStore.getState().setSession(null);
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthSessionStore.getState().setSession(null);
    window.sessionStorage.clear();
  });

  it('uses the local repository when api mode is disabled', () => {
    const repository = getPersonalLinkRepository();

    expect(repository.kind).toBe('local');
  });

  it('keeps zero-arg consumers on the local repository even when VITE_API_URL is configured', () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:6650');

    const repository = usePersonalLinkRepository();

    expect(repository.kind).toBe('local');
  });

  it('prefers the explicit personal-link backend url over the legacy shared api url', () => {
    vi.stubEnv('VITE_PERSONAL_LINK_API_URL', 'https://backend.pons.link/');
    vi.stubEnv('VITE_API_URL', 'http://localhost:6650');

    expect(getConfiguredPersonalLinkApiUrl()).toBe('https://backend.pons.link');
  });

  it('uses the remote repository and resolves a profile through the API when api mode is enabled', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ alias: 'alpha', status: 'active' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650/' });
    const profile = await repository.getPublicProfileBySlug('Alpha');

    expect(repository.kind).toBe('remote');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:6650/api/public-desk/alpha', undefined);
    expect(profile).toMatchObject({
      slug: 'alpha',
      displayName: 'alpha',
      responsePolicy: 'open',
      allowGeneralRequest: true,
    });
  });

  it('posts requests through the remote alias api and maps the remote response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        alias: 'alpha',
        conversationId: 'conversation-1',
        requestId: 'request-1',
        visitorName: 'Visitor Remote',
        visitorEmail: 'remote@example.com',
        visitorTimezone: 'America/Los_Angeles',
        requestType: 'mentoring',
        message: 'Remote message preserved.',
        preferredTime: 'Wednesday afternoon',
        status: 'submitted',
        expiresAt: '2026-05-01T00:00:00.000Z',
        createdAt: '2026-04-22T08:00:00.000Z',
        updatedAt: '2026-04-22T09:00:00.000Z',
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const result = await repository.createRequest({
      hostSlug: 'Alpha',
      visitorName: 'Visitor',
      visitorEmail: 'visitor@example.com',
      visitorTimezone: 'Asia/Seoul',
      deliveryMode: 'mediated',
      requestType: 'collab',
      message: 'Would like to collaborate.',
      preferredTimeNote: 'Friday morning',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6650/api/public-desk/alpha/requests',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorName: 'Visitor',
          visitorEmail: 'visitor@example.com',
          visitorTimezone: 'Asia/Seoul',
          deliveryMode: 'mediated',
          requestType: 'collab',
          message: 'Would like to collaborate.',
          preferredTime: 'Friday morning',
        }),
      }),
    );
    expect(result).toMatchObject({
      id: 'request-1',
      hostSlug: 'alpha',
      visitorName: 'Visitor Remote',
      visitorEmail: 'remote@example.com',
      visitorTimezone: 'America/Los_Angeles',
      requestType: 'mentoring',
      status: 'pending',
      message: 'Remote message preserved.',
      preferredTimeNote: 'Wednesday afternoon',
      expiresAt: '2026-05-01T00:00:00.000Z',
      createdAt: '2026-04-22T08:00:00.000Z',
      updatedAt: '2026-04-22T09:00:00.000Z',
    });
  });

  it('loads the authenticated host bootstrap profile from the backend surface', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        user: {
          userId: 'host-1',
          displayName: 'Host Name',
          avatarUrl: 'https://cdn.pons.link/avatar.png',
          primaryAlias: 'alpha',
        },
        accountProfile: {
          userId: 'host-1',
          displayName: 'Host Name',
          statusMessage: 'Available',
          profileImageUrl: 'https://cdn.pons.link/avatar.png',
          createdAt: '2026-04-20T08:00:00.000Z',
          updatedAt: '2026-04-22T09:00:00.000Z',
        },
        publicProfile: {
          userId: 'host-1',
          slug: 'alpha',
          headline: 'Host headline',
          bio: 'Host bio',
          responsePolicy: 'approve_before_booking',
          defaultRoomType: 'video-one-to-one',
          timezone: 'Asia/Seoul',
          profileVisibility: 'public',
          allowGeneralRequest: true,
          allowScheduleRequest: true,
          allowMentoringRequest: true,
          allowCollabRequest: false,
          createdAt: '2026-04-20T08:00:00.000Z',
          updatedAt: '2026-04-22T09:00:00.000Z',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const bootstrap = await repository.getAuthBootstrapProfile('host@example.com');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6650/api/lounge/profile-bootstrap',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer backend-session-token',
        }),
      }),
    );
    expect(bootstrap).toMatchObject({
      userProfile: {
        userId: 'host-1',
        primaryEmail: 'host@example.com',
        displayName: 'Host Name',
        avatarUrl: 'https://cdn.pons.link/avatar.png',
      },
      accountProfile: {
        displayName: 'Host Name',
        profileImageUrl: 'https://cdn.pons.link/avatar.png',
      },
      publicProfile: {
        slug: 'alpha',
        headline: 'Host headline',
        responsePolicy: 'approve_before_booking',
      },
    });
  });

  it('falls back to the live /api/auth/me contract when legacy bootstrap routes are absent', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (
        url === 'http://localhost:6650/api/lounge/profile-bootstrap' ||
        url === 'http://localhost:6650/api/lounge/profile' ||
        url === 'http://localhost:6650/api/me'
      ) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/auth/me') {
        expect(init).toMatchObject({
          headers: expect.objectContaining({
            Authorization: 'Bearer backend-session-token',
          }),
        });

        return new Response(JSON.stringify({
          ok: true,
          session: {
            userId: 'host-1',
          },
          user: {
            userId: 'host-1',
            displayName: 'Declan',
            contactEmail: 'hidden@example.com',
            status: 'active',
            createdAt: '2026-04-22T00:00:00.000Z',
            updatedAt: '2026-04-22T00:00:00.000Z',
          },
          aliases: {
            items: [
              {
                aliasId: 'alias-1',
                ownerUserId: 'host-1',
                alias: 'declan',
                rawAlias: 'Declan',
                status: 'active',
                isPrimary: true,
                createdAt: '2026-04-22T00:00:00.000Z',
                updatedAt: '2026-04-22T00:00:00.000Z',
              },
            ],
            primaryAlias: {
              aliasId: 'alias-1',
              ownerUserId: 'host-1',
              alias: 'declan',
              rawAlias: 'Declan',
              status: 'active',
              isPrimary: true,
              createdAt: '2026-04-22T00:00:00.000Z',
              updatedAt: '2026-04-22T00:00:00.000Z',
            },
          },
          userProfile: null,
          accountProfile: {
            userId: 'host-1',
            displayName: 'Declan',
            statusMessage: '',
            createdAt: '2026-04-22T00:00:00.000Z',
            updatedAt: '2026-04-22T00:00:00.000Z',
          },
          publicProfile: {
            userId: 'host-1',
            slug: 'declan',
            headline: '',
            bio: '',
            responsePolicy: 'open',
            defaultRoomType: 'video-one-to-one',
            timezone: 'UTC',
            profileVisibility: 'public',
            allowGeneralRequest: true,
            allowScheduleRequest: true,
            allowMentoringRequest: true,
            allowCollabRequest: true,
            createdAt: '2026-04-22T00:00:00.000Z',
            updatedAt: '2026-04-22T00:00:00.000Z',
          },
          bootstrap: {
            userProfile: null,
            accountProfile: {
              userId: 'host-1',
              displayName: 'Declan',
              statusMessage: '',
              createdAt: '2026-04-22T00:00:00.000Z',
              updatedAt: '2026-04-22T00:00:00.000Z',
            },
            publicProfile: {
              userId: 'host-1',
              slug: 'declan',
              headline: '',
              bio: '',
              responsePolicy: 'open',
              defaultRoomType: 'video-one-to-one',
              timezone: 'UTC',
              profileVisibility: 'public',
              allowGeneralRequest: true,
              allowScheduleRequest: true,
              allowMentoringRequest: true,
              allowCollabRequest: true,
              createdAt: '2026-04-22T00:00:00.000Z',
              updatedAt: '2026-04-22T00:00:00.000Z',
            },
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('not found', { status: 404 });
    });

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const bootstrap = await repository.getAuthBootstrapProfile('host@example.com');

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://localhost:6650/api/lounge/profile-bootstrap',
      'http://localhost:6650/api/lounge/profile',
      'http://localhost:6650/api/me',
      'http://localhost:6650/api/auth/me',
    ]);
    expect(bootstrap).toMatchObject({
      userProfile: {
        userId: 'host-1',
        primaryEmail: 'hidden@example.com',
        displayName: 'Declan',
      },
      accountProfile: {
        userId: 'host-1',
        displayName: 'Declan',
      },
      publicProfile: {
        slug: 'declan',
        responsePolicy: 'open',
      },
    });
  });

  it('prefers the configured public alias while preserving the backend-issued internal unique number', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url !== 'http://localhost:6650/api/auth/me') {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ok: true,
        session: {
          userId: 'host-1',
        },
        user: {
          userId: 'host-1',
          displayName: 'Declan',
          contactEmail: 'hidden@example.com',
          primaryAlias: 'declan',
          uniqueNumber: '84520193',
        },
        aliases: {
          primaryAlias: {
            aliasId: 'alias-legacy',
            ownerUserId: 'host-1',
            alias: 'declan',
            rawAlias: 'Declan',
            status: 'active',
            isPrimary: true,
          },
        },
        publicProfile: null,
        bootstrap: {
          publicProfile: null,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const bootstrap = await repository.getAuthBootstrapProfile('host@example.com');

    expect(bootstrap.publicProfile).toMatchObject({
      slug: 'declan',
      responsePolicy: 'approve_before_booking',
    });
    expect(bootstrap.userProfile).toMatchObject({
      userId: 'host-1',
      primaryEmail: 'hidden@example.com',
      displayName: 'Declan',
    });
    expect(useAuthSessionStore.getState().session?.uniqueNumber).toBeUndefined();
  });

  it('lists and resolves remote lounge requests through the backend surface', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === 'http://localhost:6650/api/lounge/requests?status=pending&filter=pending') {
        return new Response(JSON.stringify({
          requests: [
            {
              requestId: 'request-1',
              hostUserId: 'host-1',
              alias: 'alpha',
              visitorName: 'Visitor Name',
              visitorEmail: 'visitor@example.com',
              visitorTimezone: 'America/New_York',
              requestType: 'mentoring',
              message: 'Could we review my portfolio?',
              preferredTime: 'Friday morning',
              status: 'submitted',
              expiresAt: '2026-05-01T00:00:00.000Z',
              createdAt: '2026-04-22T08:00:00.000Z',
              updatedAt: '2026-04-22T09:00:00.000Z',
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/requests/request-1') {
        expect(init).toMatchObject({
          headers: expect.objectContaining({
            Authorization: 'Bearer backend-session-token',
          }),
        });

        return new Response(JSON.stringify({
          requestId: 'request-1',
          hostUserId: 'host-1',
          alias: 'alpha',
          visitorName: 'Visitor Name',
          visitorEmail: 'visitor@example.com',
          visitorTimezone: 'America/New_York',
          requestType: 'mentoring',
          message: 'Could we review my portfolio?',
          preferredTime: 'Friday morning',
          status: 'submitted',
          expiresAt: '2026-05-01T00:00:00.000Z',
          createdAt: '2026-04-22T08:00:00.000Z',
          updatedAt: '2026-04-22T09:00:00.000Z',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('not found', { status: 404 });
    });

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const requests = await repository.listRequests('pending');
    const request = await repository.getRequest('request-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6650/api/lounge/requests?status=pending&filter=pending',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer backend-session-token',
        }),
      }),
    );
    expect(requests).toMatchObject([
      {
        id: 'request-1',
        hostSlug: 'alpha',
        visitorName: 'Visitor Name',
        visitorEmail: 'visitor@example.com',
        requestType: 'mentoring',
        preferredTimeNote: 'Friday morning',
        status: 'pending',
      },
    ]);
    expect(request).toMatchObject({
      id: 'request-1',
      hostSlug: 'alpha',
      visitorName: 'Visitor Name',
      status: 'pending',
    });
  });

  it('accepts, counter-proposes, and declines remote lounge requests through the backend surface', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === 'http://localhost:6650/api/lounge/requests/request-1/accept') {
        expect(init).toMatchObject({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer backend-session-token',
            'Content-Type': 'application/json',
          }),
        });

        return new Response(JSON.stringify({
          reservationId: 'reservation-1',
          requestId: 'request-1',
          hostUserId: 'host-1',
          guestDisplayName: 'Visitor Name',
          guestEmail: 'visitor@example.com',
          roomType: 'video',
          scheduledStartAt: '2026-04-25T01:00:00.000Z',
          scheduledEndAt: '2026-04-25T02:00:00.000Z',
          timezone: 'Asia/Seoul',
          status: 'scheduled',
          createdAt: '2026-04-22T00:00:00.000Z',
          updatedAt: '2026-04-22T00:00:00.000Z',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/requests/request-1/propose-time') {
        expect(init).toMatchObject({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer backend-session-token',
            'Content-Type': 'application/json',
          }),
        });

        return new Response(JSON.stringify({
          reservationId: 'reservation-2',
          requestId: 'request-1',
          hostUserId: 'host-1',
          guestDisplayName: 'Visitor Name',
          guestEmail: 'visitor@example.com',
          roomType: 'audio',
          scheduledStartAt: '2026-04-26T03:00:00.000Z',
          scheduledEndAt: '2026-04-26T04:00:00.000Z',
          timezone: 'Asia/Seoul',
          status: 'proposed',
          createdAt: '2026-04-22T00:00:00.000Z',
          updatedAt: '2026-04-22T00:00:00.000Z',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/requests/request-1/decline') {
        expect(init).toMatchObject({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer backend-session-token',
            'Content-Type': 'application/json',
          }),
        });

        return new Response(JSON.stringify({
          requestId: 'request-1',
          hostUserId: 'host-1',
          alias: 'alpha',
          visitorName: 'Visitor Name',
          visitorEmail: 'visitor@example.com',
          visitorTimezone: 'America/New_York',
          requestType: 'schedule',
          message: 'Could we talk next week?',
          preferredTime: '2026-04-25 10:00',
          status: 'declined',
          createdAt: '2026-04-22T00:00:00.000Z',
          updatedAt: '2026-04-23T00:00:00.000Z',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('not found', { status: 404 });
    });

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const acceptResult = await repository.acceptRequest('request-1', {
      proposedStartAt: '2026-04-25T01:00:00.000Z',
      proposedEndAt: '2026-04-25T02:00:00.000Z',
      timezone: 'Asia/Seoul',
      roomType: 'video-one-to-one',
    });
    const counterResult = await repository.counterProposeRequest('request-1', {
      proposedStartAt: '2026-04-26T03:00:00.000Z',
      proposedEndAt: '2026-04-26T04:00:00.000Z',
      timezone: 'Asia/Seoul',
      roomType: 'audio-one-to-one',
    });
    const declineResult = await repository.declineRequest('request-1', 'No availability');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6650/api/lounge/requests/request-1/accept',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          proposedStartAt: '2026-04-25T01:00:00.000Z',
          proposedEndAt: '2026-04-25T02:00:00.000Z',
          timezone: 'Asia/Seoul',
          roomType: 'video-one-to-one',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6650/api/lounge/requests/request-1/propose-time',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          proposedStartAt: '2026-04-26T03:00:00.000Z',
          proposedEndAt: '2026-04-26T04:00:00.000Z',
          timezone: 'Asia/Seoul',
          roomType: 'audio-one-to-one',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6650/api/lounge/requests/request-1/decline',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ reason: 'No availability' }),
      }),
    );
    expect(acceptResult).toMatchObject({
      id: 'reservation-1',
      requestId: 'request-1',
      roomType: 'video-one-to-one',
      status: 'confirmed',
    });
    expect(counterResult).toMatchObject({
      id: 'reservation-2',
      requestId: 'request-1',
      roomType: 'audio-one-to-one',
      status: 'proposed',
    });
    expect(declineResult).toMatchObject({
      id: 'request-1',
      hostSlug: 'alpha',
      status: 'declined',
    });
  });

  it('posts public email request actions without attaching a login session', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    const seenHeaders: Array<HeadersInit | undefined> = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      seenHeaders.push(init?.headers);

      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.Authorization).toBeUndefined();
      expect(headers?.authorization).toBeUndefined();

      if (url === 'http://localhost:6650/api/request-actions/action-token-1/accept') {
        expect(init).toMatchObject({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proposedStartAt: '2026-04-25T01:00:00.000Z',
            proposedEndAt: '2026-04-25T01:30:00.000Z',
            timezone: 'Asia/Seoul',
            roomType: 'video-one-to-one',
          }),
        });

        return new Response(JSON.stringify({
          reservationId: 'reservation-accepted-1',
          requestId: 'request-1',
          hostUserId: 'host-user-1',
          guestEmail: 'visitor@example.com',
          scheduledStartAt: '2026-04-25T01:00:00.000Z',
          scheduledEndAt: '2026-04-25T01:30:00.000Z',
          timezone: 'Asia/Seoul',
          roomType: 'video',
          status: 'scheduled',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/request-actions/action-token-2/propose-time') {
        expect(init).toMatchObject({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            proposedStartAt: '2026-04-26T03:00:00.000Z',
            proposedEndAt: '2026-04-26T03:30:00.000Z',
            timezone: 'Asia/Seoul',
            roomType: 'audio-one-to-one',
            message: 'Could we meet 30 minutes later?',
          }),
        });

        return new Response(JSON.stringify({
          reservationId: 'reservation-proposed-1',
          requestId: 'request-1',
          hostUserId: 'host-user-1',
          scheduledStartAt: '2026-04-26T03:00:00.000Z',
          scheduledEndAt: '2026-04-26T03:30:00.000Z',
          timezone: 'Asia/Seoul',
          roomType: 'audio',
          status: 'proposed',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/request-actions/action-token-3/direct-call') {
        expect(init).toMatchObject({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'I am available now for a quick call.',
          }),
        });

        return new Response(JSON.stringify({
          requestId: 'request-1',
          callRequestId: 'call-request-1',
          status: 'queued',
          loungeUrl: 'https://pons.link/lounge/requests/request-1',
        }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('not found', { status: 404 });
    });

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const acceptResult = await repository.acceptRequestByActionToken('action-token-1', {
      proposedStartAt: '2026-04-25T01:00:00.000Z',
      proposedEndAt: '2026-04-25T01:30:00.000Z',
      timezone: 'Asia/Seoul',
      roomType: 'video-one-to-one',
    });
    const proposeResult = await repository.proposeTimeByActionToken('action-token-2', {
      proposedStartAt: '2026-04-26T03:00:00.000Z',
      proposedEndAt: '2026-04-26T03:30:00.000Z',
      timezone: 'Asia/Seoul',
      roomType: 'audio-one-to-one',
      message: 'Could we meet 30 minutes later?',
    });
    const directCallResult = await repository.requestDirectCallByActionToken('action-token-3', 'I am available now for a quick call.');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(seenHeaders).toEqual([
      { 'Content-Type': 'application/json' },
      { 'Content-Type': 'application/json' },
      { 'Content-Type': 'application/json' },
    ]);
    expect(acceptResult).toMatchObject({
      id: 'reservation-accepted-1',
      requestId: 'request-1',
      roomType: 'video-one-to-one',
      status: 'confirmed',
    });
    expect(proposeResult).toMatchObject({
      id: 'reservation-proposed-1',
      requestId: 'request-1',
      roomType: 'audio-one-to-one',
      status: 'proposed',
    });
    expect(directCallResult).toMatchObject({
      requestId: 'request-1',
      callRequestId: 'call-request-1',
      status: 'queued',
      loungeUrl: 'https://pons.link/lounge/requests/request-1',
    });
  });

  it('lists and resolves remote lounge reservations through the backend surface', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    const reservationPayload = {
      reservationId: 'reservation-1',
      requestId: 'request-1',
      hostUserId: 'host-1',
      guestDisplayName: 'Maya Kim',
      guestEmail: 'maya@example.com',
      roomType: 'video',
      scheduledStartAt: '2026-04-24T05:00:00.000Z',
      scheduledEndAt: '2026-04-24T06:00:00.000Z',
      timezone: 'Asia/Seoul',
      status: 'scheduled',
      joinUrl: 'http://localhost:6650/session-access/reservation-1?token=join-token',
      createdAt: '2026-04-23T01:00:00.000Z',
      updatedAt: '2026-04-23T02:00:00.000Z',
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === 'http://localhost:6650/api/lounge/reservations?status=confirmed&filter=confirmed') {
        return new Response(JSON.stringify({ reservations: [reservationPayload] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/reservations/reservation-1') {
        return new Response(JSON.stringify(reservationPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('not found', { status: 404 });
    });

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const bookings = await repository.listBookings('confirmed');
    const booking = await repository.getBooking('reservation-1');
    const sessionReservation = await repository.getSessionReservation('reservation-1');

    expect(bookings).toMatchObject([
      {
        id: 'reservation-1',
        requestId: 'request-1',
        guestDisplayName: 'Maya Kim',
        guestEmail: 'maya@example.com',
        roomType: 'video-one-to-one',
        status: 'confirmed',
      },
    ]);
    expect(booking).toMatchObject({
      id: 'reservation-1',
      roomType: 'video-one-to-one',
      status: 'confirmed',
    });
    expect(sessionReservation).toMatchObject({
      id: 'reservation-1',
      bookingId: 'reservation-1',
      guestDisplayName: 'Maya Kim',
      guestEmail: 'maya@example.com',
      joinPath: '/session-access/reservation-1?token=join-token',
      accessToken: 'join-token',
      status: 'scheduled',
    });
  });

  it('lists remote lounge events for requester and host meeting status updates', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'sender-1',
      providerSubject: 'google-oauth2|sender-1',
      email: 'sender@example.com',
      displayName: 'Sender Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        events: [
          {
            eventId: 'event-1',
            userId: 'sender-1',
            conversationId: 'conversation-1',
            requestId: 'request-1',
            reservationId: 'reservation-1',
            eventType: 'meeting_request_accepted',
            payload: { source: 'email_action' },
            createdAt: '2026-04-24T05:00:00.000Z',
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const events = await repository.listLoungeEvents();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6650/api/lounge/events',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer backend-session-token',
        }),
      }),
    );
    expect(events).toMatchObject([
      {
        id: 'event-1',
        userId: 'sender-1',
        conversationId: 'conversation-1',
        requestId: 'request-1',
        bookingId: 'reservation-1',
        eventType: 'meeting_request_accepted',
        payload: { source: 'email_action' },
        createdAt: '2026-04-24T05:00:00.000Z',
      },
    ]);
  });

  it('creates cached remote email deliveries and resolves guest session access through the guest-safe backend endpoint', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    const now = Date.now();
    const scheduledStartAt = new Date(now - 5 * 60_000).toISOString();
    const scheduledEndAt = new Date(now + 25 * 60_000).toISOString();

    const reservationPayload = {
      reservationId: 'reservation-1',
      requestId: 'request-1',
      hostUserId: 'host-1',
      guestDisplayName: 'Maya Kim',
      guestEmail: 'maya@example.com',
      roomType: 'video',
      scheduledStartAt,
      scheduledEndAt,
      timezone: 'Asia/Seoul',
      status: 'scheduled',
      joinUrl: 'https://frontend.pons.link/join/reservation-1?token=join-token',
      roomTitle: 'Session reservation-1',
      createdAt: '2026-04-23T01:00:00.000Z',
      updatedAt: '2026-04-23T02:00:00.000Z',
    };

    const sessionAccessPayload = {
      reservationId: 'reservation-1',
      requestId: 'request-1',
      hostUserId: 'host-1',
      guestDisplayName: 'Maya Kim',
      guestEmail: 'maya@example.com',
      roomType: 'video',
      scheduledStartAt,
      scheduledEndAt,
      timezone: 'Asia/Seoul',
      status: 'scheduled',
      joinUrl: 'https://frontend.pons.link/join/reservation-1?token=guest-join-token',
      roomTitle: 'Session reservation-1',
      createdAt: '2026-04-23T01:00:00.000Z',
      updatedAt: '2026-04-23T02:00:00.000Z',
    };

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);

      if (url === 'http://localhost:6650/api/lounge/reservations/reservation-1') {
        return new Response(JSON.stringify(reservationPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/email/accepted') {
        expect(init).toMatchObject({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer backend-session-token',
          }),
        });

        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          hostEmail: 'host@example.com',
          hostDisplayName: 'Host Name',
          hostTimezone: 'Asia/Seoul',
          visitorName: 'Maya Kim',
          visitorEmail: 'maya@example.com',
          requestType: 'general',
          scheduledStart: scheduledStartAt,
          scheduledEnd: scheduledEndAt,
          timezone: 'Asia/Seoul',
          meetingUrl: new URL('/session-access/reservation-1', window.location.origin).toString(),
          directCallUrl: new URL('/session-access/reservation-1', window.location.origin).toString(),
          roomTitle: 'Session reservation-1',
        });

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/session-access/reservation-1?token=guest-access-token') {
        return new Response(JSON.stringify(sessionAccessPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/session-access/reservation-1?token=stale-access-token') {
        return new Response(JSON.stringify({ error: 'Invalid session access token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('not found', { status: 404 });
    });

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const createdReservation = await repository.createSessionReservation('reservation-1');
    const createdDelivery = await repository.createEmailDelivery('reservation-1');
    const listedDeliveries = await repository.listEmailDeliveries(['reservation-1']);
    const fetchedDelivery = await repository.getEmailDelivery('reservation-1');
    const allowedAccess = await repository.getSessionAccess('reservation-1', 'guest-access-token');
    const mismatchAccess = await repository.getSessionAccess('reservation-1', 'stale-access-token');
    const resentDelivery = await repository.resendEmailDelivery('reservation-1');
    const expectedGuestAccessUrl = new URL('/session-access/reservation-1', window.location.origin).toString();

    expect(createdReservation).toMatchObject({
      bookingId: 'reservation-1',
      guestEmail: 'maya@example.com',
      joinPath: '/join/reservation-1?token=join-token',
    });
    expect(createdDelivery).toMatchObject({
      bookingId: 'reservation-1',
      recipientEmail: 'maya@example.com',
      joinUrl: expectedGuestAccessUrl,
      deliveryStatus: 'sent',
    });
    expect(listedDeliveries).toHaveLength(1);
    expect(fetchedDelivery).toMatchObject({
      bookingId: 'reservation-1',
      recipientEmail: 'maya@example.com',
    });
    expect(allowedAccess).toMatchObject({
      state: 'allowed',
      reservation: {
        bookingId: 'reservation-1',
        joinPath: '/join/reservation-1?token=guest-join-token',
      },
    });
    expect(mismatchAccess).toMatchObject({
      state: 'not_found',
    });
    expect(resentDelivery).toMatchObject({
      bookingId: 'reservation-1',
      recipientEmail: 'maya@example.com',
      joinUrl: expectedGuestAccessUrl,
      deliveryStatus: 'sent',
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === 'http://localhost:6650/api/email/accepted')).toHaveLength(2);
  });

  it('persists remote profile writes and friends through the reachable backend surface', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);

      if (
        url === 'http://localhost:6650/api/lounge/profile/user' ||
        url === 'http://localhost:6650/api/lounge/profile/account' ||
        url === 'http://localhost:6650/api/lounge/profile/public'
      ) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/profile') {
        expect(init).toMatchObject({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer backend-session-token',
            'Content-Type': 'application/json',
          }),
        });

        const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        if ('userProfile' in body) {
          return new Response(JSON.stringify({
            userProfile: {
              userId: 'host-1',
              providerSubject: 'google-oauth2|host-1',
              primaryEmail: 'host@example.com',
              emailVerified: true,
              displayName: 'Declan Remote',
              avatarUrl: 'https://cdn.pons.link/profile.png',
              createdAt: '2026-04-22T00:00:00.000Z',
              updatedAt: '2026-04-23T00:00:00.000Z',
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if ('accountProfile' in body) {
          return new Response(JSON.stringify({
            accountProfile: {
              userId: 'host-1',
              displayName: 'Declan Remote',
              statusMessage: 'Available',
              profileImageUrl: 'https://cdn.pons.link/profile.png',
              createdAt: '2026-04-22T00:00:00.000Z',
              updatedAt: '2026-04-23T00:00:00.000Z',
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          publicProfile: {
            userId: 'host-1',
            slug: 'declan-remote',
            headline: 'Remote headline',
            bio: 'Remote bio',
            responsePolicy: 'approve_before_booking',
            defaultRoomType: 'video-one-to-one',
            timezone: 'Asia/Seoul',
            profileVisibility: 'public',
            allowGeneralRequest: true,
            allowScheduleRequest: true,
            allowMentoringRequest: true,
            allowCollabRequest: true,
            createdAt: '2026-04-22T00:00:00.000Z',
            updatedAt: '2026-04-23T00:00:00.000Z',
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/profile/image') {
        if (init?.method === 'DELETE') {
          expect(init).toMatchObject({
            method: 'DELETE',
            headers: expect.objectContaining({
              Authorization: 'Bearer backend-session-token',
            }),
          });
          return new Response(null, { status: 204 });
        }

        expect(init).toMatchObject({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer backend-session-token',
          }),
        });
        expect(init?.body).toBeInstanceOf(FormData);

        return new Response(JSON.stringify({ imageUrl: 'https://cdn.pons.link/uploaded.png' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/friends') {
        if (init?.method === 'POST') {
          expect(init).toMatchObject({
            headers: expect.objectContaining({
              Authorization: 'Bearer backend-session-token',
              'Content-Type': 'application/json',
            }),
          });

          return new Response(JSON.stringify({
            id: 'friend-2',
            ownerUserId: 'host-1',
            friendUserId: 'friend:beta',
            friendSlug: 'beta',
            friendDisplayName: 'Beta Host',
            friendProfileImageUrl: 'https://cdn.pons.link/beta.png',
            status: 'accepted',
            createdAt: '2026-04-23T00:00:00.000Z',
            updatedAt: '2026-04-23T00:00:00.000Z',
          }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          items: [
            {
              id: 'friend-1',
              ownerUserId: 'host-1',
              friendUserId: 'friend:alpha',
              friendSlug: 'alpha',
              friendDisplayName: 'Alpha Host',
              friendProfileImageUrl: 'https://cdn.pons.link/alpha.png',
              status: 'accepted',
              createdAt: '2026-04-22T00:00:00.000Z',
              updatedAt: '2026-04-22T00:00:00.000Z',
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/friends/friend-1/block') {
        return new Response(null, { status: 204 });
      }

      if (url === 'http://localhost:6650/api/lounge/friends/friend-1') {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unhandled fetch ${url}`);
    });

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const userProfile = await repository.saveUserProfile({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      primaryEmail: 'host@example.com',
      emailVerified: true,
      displayName: 'Declan Local',
      avatarUrl: 'https://example.com/local.png',
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
    });
    const accountProfile = await repository.saveAccountProfile({
      userId: 'host-1',
      displayName: 'Declan Local',
      statusMessage: 'Available',
      profileImageUrl: 'https://example.com/local.png',
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
    });
    const publicProfile = await repository.savePublicProfile({
      userId: 'host-1',
      slug: 'Declan-Remote',
      headline: 'Local headline',
      bio: 'Local bio',
      responsePolicy: 'approve_before_booking',
      defaultRoomType: 'audio-one-to-one',
      timezone: 'Asia/Seoul',
      profileVisibility: 'public',
      allowGeneralRequest: true,
      allowScheduleRequest: true,
      allowMentoringRequest: true,
      allowCollabRequest: true,
      createdAt: '2026-04-22T00:00:00.000Z',
      updatedAt: '2026-04-22T00:00:00.000Z',
    });
    const imageUrl = await repository.saveAccountProfileImage(new File(['avatar'], 'avatar.png', { type: 'image/png' }));
    await repository.removeAccountProfileImage();
    const friends = await repository.listFriends();
    const addedFriend = await repository.addFriendBySlug('Beta');
    await repository.blockFriend('friend-1');
    await repository.removeFriend('friend-1');

    expect(userProfile).toMatchObject({
      userId: 'host-1',
      displayName: 'Declan Remote',
      avatarUrl: 'https://cdn.pons.link/profile.png',
    });
    expect(accountProfile).toMatchObject({
      displayName: 'Declan Remote',
      profileImageUrl: 'https://cdn.pons.link/profile.png',
    });
    expect(publicProfile).toMatchObject({
      slug: 'declan-remote',
      headline: 'Remote headline',
      defaultRoomType: 'video-one-to-one',
    });
    expect(imageUrl).toBe('https://cdn.pons.link/uploaded.png');
    expect(friends).toEqual([
      expect.objectContaining({
        id: 'friend-1',
        friendSlug: 'alpha',
        friendDisplayName: 'Alpha Host',
      }),
    ]);
    expect(addedFriend).toMatchObject({
      id: 'friend-2',
      friendSlug: 'beta',
      friendDisplayName: 'Beta Host',
    });
    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method ?? 'GET'])).toEqual([
      ['http://localhost:6650/api/lounge/profile/user', 'POST'],
      ['http://localhost:6650/api/lounge/profile', 'POST'],
      ['http://localhost:6650/api/lounge/profile/account', 'POST'],
      ['http://localhost:6650/api/lounge/profile', 'POST'],
      ['http://localhost:6650/api/lounge/profile/public', 'POST'],
      ['http://localhost:6650/api/lounge/profile', 'POST'],
      ['http://localhost:6650/api/lounge/profile/image', 'POST'],
      ['http://localhost:6650/api/lounge/profile/image', 'DELETE'],
      ['http://localhost:6650/api/lounge/friends', 'GET'],
      ['http://localhost:6650/api/lounge/friends', 'POST'],
      ['http://localhost:6650/api/lounge/friends/friend-1/block', 'POST'],
      ['http://localhost:6650/api/lounge/friends/friend-1', 'DELETE'],
    ]);
  });

  it('supports remote request/booking maintenance actions', async () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      sessionToken: 'backend-session-token',
      loggedInAt: '2026-04-23T00:00:00.000Z',
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url === 'http://localhost:6650/api/lounge/friends' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'friend-1',
          friendSlug: 'visitor@example.com',
          friendDisplayName: 'visitor@example.com',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/friends/friend-1/block' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'friend-1',
          friendSlug: 'visitor@example.com',
          friendDisplayName: 'visitor@example.com',
          status: 'blocked',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/requests/request-1' && method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      if (url === 'http://localhost:6650/api/lounge/requests/expire' && method === 'POST') {
        return new Response(JSON.stringify({
          items: [
            {
              requestId: 'request-1',
              hostAlias: 'alpha',
              visitorAlias: 'visitor',
              requestType: 'general',
              status: 'expired',
            },
          ],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/reservations/booking-1/cancel' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'booking-1',
          status: 'cancelled',
          scheduledStartAt: '2026-04-24T10:00:00.000Z',
          scheduledEndAt: '2026-04-24T11:00:00.000Z',
          timezone: 'Asia/Seoul',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/reservations/booking-1/no-show' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'booking-1',
          status: 'no_show',
          scheduledStartAt: '2026-04-24T10:00:00.000Z',
          scheduledEndAt: '2026-04-24T11:00:00.000Z',
          timezone: 'Asia/Seoul',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/lounge/reservations/booking-1/reschedule-needed' && method === 'POST') {
        return new Response(JSON.stringify({
          id: 'booking-1',
          status: 'reschedule_needed',
          scheduledStartAt: '2026-04-24T10:00:00.000Z',
          scheduledEndAt: '2026-04-24T11:00:00.000Z',
          timezone: 'Asia/Seoul',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('not found', { status: 404 });
    });

    const repository = getPersonalLinkRepository({ apiUrl: 'http://localhost:6650' });
    const blocked = await repository.blockVisitorIdentity('visitor@example.com', 'Visitor');
    await repository.deleteRequest('request-1');
    const expiredItems = await repository.expireRequests('2026-04-23T00:00:00.000Z');
    const cancelledBooking = await repository.cancelBooking('booking-1', 'host', 'busy');
    const noShowBooking = await repository.markNoShow('booking-1', 'visitor');
    const rescheduleBooking = await repository.markRescheduleNeeded('booking-1', 'host');

    expect(blocked.friendDisplayName).toBe('Visitor');
    expect(expiredItems).toHaveLength(1);
    expect(expiredItems[0]).toMatchObject({
      status: 'expired',
      hostSlug: 'alpha',
      visitorName: 'visitor',
    });
    expect(cancelledBooking).toMatchObject({
      id: 'booking-1',
      cancelActor: 'host',
      cancelReason: 'busy',
      status: 'cancelled',
    });
    expect(noShowBooking).toMatchObject({
      id: 'booking-1',
      status: 'no_show',
      cancelActor: 'visitor',
    });
    expect(rescheduleBooking).toMatchObject({
      id: 'booking-1',
      status: 'reschedule_needed',
      cancelActor: 'host',
    });
    expect(fetchMock.mock.calls.map(([url, init]) => [String(url), init?.method ?? 'GET'])).toEqual([
      ['http://localhost:6650/api/lounge/friends', 'POST'],
      ['http://localhost:6650/api/lounge/friends/friend-1/block', 'POST'],
      ['http://localhost:6650/api/lounge/requests/request-1', 'DELETE'],
      ['http://localhost:6650/api/lounge/requests/expire', 'POST'],
      ['http://localhost:6650/api/lounge/reservations/booking-1/cancel', 'POST'],
      ['http://localhost:6650/api/lounge/reservations/booking-1/no-show', 'POST'],
      ['http://localhost:6650/api/lounge/reservations/booking-1/reschedule-needed', 'POST'],
    ]);
  });
});
