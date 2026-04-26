import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoungeOnboarding from './LoungeOnboarding';

const navigateMock = vi.fn();
const useAuthSessionMock = vi.fn();
const usePersonalLinkRepositoryMock = vi.fn();
const getConfiguredPersonalLinkApiUrlMock = vi.fn();

const saveUserProfileMock = vi.fn();
const saveAccountProfileMock = vi.fn();
const savePublicProfileMock = vi.fn();
const saveAccountProfileImageMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

vi.mock('@/features/personal-link/usePersonalLinkRepository', () => ({
  getConfiguredPersonalLinkApiUrl: () => getConfiguredPersonalLinkApiUrlMock(),
  usePersonalLinkRepository: (...args: unknown[]) => usePersonalLinkRepositoryMock(...args),
}));

describe('LoungeOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('http://localhost:6650');
    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Host Name',
        avatarUrl: 'https://example.com/profile.png',
      },
    });
    usePersonalLinkRepositoryMock.mockReturnValue({
      kind: 'remote',
      saveUserProfile: saveUserProfileMock,
      saveAccountProfile: saveAccountProfileMock,
      savePublicProfile: savePublicProfileMock,
      saveAccountProfileImage: saveAccountProfileImageMock,
    });
    saveUserProfileMock.mockResolvedValue(undefined);
    saveAccountProfileMock.mockResolvedValue(undefined);
    savePublicProfileMock.mockResolvedValue(undefined);
    saveAccountProfileImageMock.mockResolvedValue('https://example.com/updated.png');
  });

  it('threads the configured backend surface into onboarding saves', async () => {
    render(
      <MemoryRouter>
        <LoungeOnboarding />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.change(screen.getByPlaceholderText('yourname'), { target: { value: 'host-name' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    fireEvent.click(screen.getByRole('button', { name: /launch your lounge/i }));

    await waitFor(() => {
      expect(saveUserProfileMock).toHaveBeenCalledTimes(1);
      expect(saveAccountProfileMock).toHaveBeenCalledTimes(1);
      expect(savePublicProfileMock).toHaveBeenCalledTimes(1);
    });

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
    expect(navigateMock).toHaveBeenCalledWith('/lounge');
  });

  it('keeps remote image upload enabled and uses the remote write surface', async () => {
    render(
      <MemoryRouter>
        <LoungeOnboarding />
      </MemoryRouter>,
    );

    const fileInput = screen.getByLabelText('Profile photo') as HTMLInputElement;
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    expect(fileInput).not.toBeDisabled();
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(saveAccountProfileImageMock).toHaveBeenCalledWith(file);
    });
  });
});
