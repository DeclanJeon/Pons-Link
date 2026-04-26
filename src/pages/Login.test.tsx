import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './Login';

const navigateMock = vi.fn();
const signInWithGoogleMock = vi.fn();
const useAuthSessionMock = vi.fn();
const usePersonalLinkRepositoryMock = vi.fn();
const supportsSessionAuthAtApiUrlMock = vi.fn();
const getConfiguredPersonalLinkApiUrlMock = vi.fn();
const getAuthBootstrapProfileMock = vi.fn();
const saveUserProfileMock = vi.fn();
const setSessionMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/features/personal-link/googleAuth', () => ({
  GoogleAuthError: class GoogleAuthError extends Error {},
  signInWithGoogle: (...args: unknown[]) => signInWithGoogleMock(...args),
}));

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

vi.mock('@/features/personal-link/usePersonalLinkRepository', () => ({
  getConfiguredPersonalLinkApiUrl: () => getConfiguredPersonalLinkApiUrlMock(),
  usePersonalLinkRepository: (...args: unknown[]) => usePersonalLinkRepositoryMock(...args),
}));

vi.mock('@/features/personal-link/backendSurface', () => ({
  supportsSessionAuthAtApiUrl: (...args: unknown[]) => supportsSessionAuthAtApiUrlMock(...args),
}));

describe('Login', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    navigateMock.mockReset();
    signInWithGoogleMock.mockReset();
    useAuthSessionMock.mockReset();
    usePersonalLinkRepositoryMock.mockReset();
    supportsSessionAuthAtApiUrlMock.mockReset();
    getConfiguredPersonalLinkApiUrlMock.mockReset();
    getAuthBootstrapProfileMock.mockReset();
    saveUserProfileMock.mockReset();
    setSessionMock.mockReset();

    signInWithGoogleMock.mockResolvedValue({
      providerSubject: 'google-subject-1',
      email: 'user@example.com',
      displayName: 'User Example',
      avatarUrl: 'https://example.com/avatar.png',
      idToken: 'google-id-token',
    });
    useAuthSessionMock.mockReturnValue({
      session: null,
      setSession: setSessionMock,
    });
    usePersonalLinkRepositoryMock.mockReturnValue({
      kind: 'remote',
      getAuthBootstrapProfile: getAuthBootstrapProfileMock,
      saveUserProfile: saveUserProfileMock,
    });
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('http://localhost:6650');
    saveUserProfileMock.mockImplementation(async (profile) => profile);
  });

  it('skips the backend token exchange when the configured surface does not expose auth routes', async () => {
    supportsSessionAuthAtApiUrlMock.mockResolvedValue(false);
    getAuthBootstrapProfileMock.mockResolvedValue({
      userProfile: null,
      accountProfile: null,
      publicProfile: null,
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => {
      expect(signInWithGoogleMock).toHaveBeenCalled();
      expect(setSessionMock).toHaveBeenCalledWith(expect.objectContaining({
        email: 'user@example.com',
        sessionToken: undefined,
      }));
    });

    expect(supportsSessionAuthAtApiUrlMock).toHaveBeenCalledWith('http://localhost:6650');
    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(saveUserProfileMock).toHaveBeenCalledWith(expect.objectContaining({
      primaryEmail: 'user@example.com',
    }));
    expect(navigateMock).toHaveBeenCalledWith('/lounge/onboarding');
  });

  it('exchanges the Google token with the configured backend when auth routes are available', async () => {
    supportsSessionAuthAtApiUrlMock.mockResolvedValue(true);
    getAuthBootstrapProfileMock.mockResolvedValue({
      userProfile: {
        userId: 'existing-user',
      },
      accountProfile: null,
      publicProfile: {
        userId: 'existing-user',
      },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        user: {
          userId: 'backend-user-1',
          displayName: 'User Example',
          primaryAlias: '84520193',
          uniqueNumber: '84520193',
        },
        session: {
          userId: 'backend-user-1',
          token: 'backend-session-token',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:6650/api/auth/google',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: 'google-id-token' }),
        }),
      );
    });

    expect(setSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'backend-user-1',
      email: 'user@example.com',
      sessionToken: 'backend-session-token',
      primaryAlias: '84520193',
      uniqueNumber: '84520193',
    }));
    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
    expect(saveUserProfileMock).not.toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/lounge');
  });
});
