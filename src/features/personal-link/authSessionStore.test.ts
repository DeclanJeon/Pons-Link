import { afterEach, describe, expect, it } from 'vitest';
import { PERSONAL_LINK_AUTH_SESSION_KEY } from './storageKeys';
import { useAuthSessionStore } from './authSessionStore';

describe('authSessionStore', () => {
  afterEach(() => {
    window.localStorage.removeItem(PERSONAL_LINK_AUTH_SESSION_KEY);
    useAuthSessionStore.getState().logout();
  });

  it('persists a backend session token alongside the auth session', () => {
    useAuthSessionStore.getState().setSession({
      userId: 'host-1',
      providerSubject: 'google-oauth2|host-1',
      email: 'host@example.com',
      displayName: 'Host Name',
      loggedInAt: '2026-04-23T00:00:00.000Z',
      sessionToken: 'backend-session-token',
    });

    expect(useAuthSessionStore.getState().session?.sessionToken).toBe('backend-session-token');
    expect(window.localStorage.getItem(PERSONAL_LINK_AUTH_SESSION_KEY)).toContain('backend-session-token');
  });

  it('hydrates a stored backend session token during bootstrap', () => {
    window.localStorage.setItem(
      PERSONAL_LINK_AUTH_SESSION_KEY,
      JSON.stringify({
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Host Name',
        loggedInAt: '2026-04-23T00:00:00.000Z',
        sessionToken: 'stored-backend-session-token',
      }),
    );

    useAuthSessionStore.getState().bootstrap();

    expect(useAuthSessionStore.getState().session?.sessionToken).toBe('stored-backend-session-token');
  });
});
