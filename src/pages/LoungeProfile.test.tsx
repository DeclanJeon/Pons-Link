import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoungeProfile from './LoungeProfile';

const useAuthSessionMock = vi.fn();
const usePersonalLinkRepositoryMock = vi.fn();
const getConfiguredPersonalLinkApiUrlMock = vi.fn();

const getAuthBootstrapProfileMock = vi.fn();
const saveAccountProfileMock = vi.fn();
const savePublicProfileMock = vi.fn();
const saveAccountProfileImageMock = vi.fn();
const removeAccountProfileImageMock = vi.fn();

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

vi.mock('@/features/personal-link/usePersonalLinkRepository', () => ({
  getConfiguredPersonalLinkApiUrl: () => getConfiguredPersonalLinkApiUrlMock(),
  usePersonalLinkRepository: (...args: unknown[]) => usePersonalLinkRepositoryMock(...args),
}));

describe('LoungeProfile', () => {
  beforeEach(() => {
    getAuthBootstrapProfileMock.mockReset();
    saveAccountProfileMock.mockReset();
    savePublicProfileMock.mockReset();
    saveAccountProfileImageMock.mockReset();
    removeAccountProfileImageMock.mockReset();

    getAuthBootstrapProfileMock.mockResolvedValue({
      accountProfile: {
        userId: 'host-1',
        displayName: 'Host Name',
        statusMessage: 'Available for conversations',
        profileImageUrl: undefined,
        createdAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T10:00:00.000Z',
      },
      publicProfile: {
        userId: 'host-1',
        slug: 'host-name',
        headline: 'Current headline',
        bio: 'Current bio',
        responsePolicy: 'approve_before_booking',
        defaultRoomType: 'audio-one-to-one',
        timezone: 'Asia/Seoul',
        profileVisibility: 'public',
        allowGeneralRequest: true,
        allowScheduleRequest: true,
        allowMentoringRequest: true,
        allowCollabRequest: true,
        createdAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T10:00:00.000Z',
      },
    });
    saveAccountProfileMock.mockResolvedValue(undefined);
    savePublicProfileMock.mockResolvedValue(undefined);
    saveAccountProfileImageMock.mockResolvedValue('data:image/png;base64,updated');
    removeAccountProfileImageMock.mockResolvedValue(undefined);
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('https://api.pons.link');

    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Host Name',
        avatarUrl: 'https://example.com/host.png',
        loggedInAt: '2026-04-21T10:00:00.000Z',
      },
    });

    usePersonalLinkRepositoryMock.mockReturnValue({
      kind: 'remote',
      getAuthBootstrapProfile: getAuthBootstrapProfileMock,
      saveAccountProfile: saveAccountProfileMock,
      savePublicProfile: savePublicProfileMock,
      saveAccountProfileImage: saveAccountProfileImageMock,
      removeAccountProfileImage: removeAccountProfileImageMock,
    });
  });

  it('shows the Google login avatar as the default preview image and keeps the redesigned workspace structure', async () => {
    render(
      <MemoryRouter>
        <LoungeProfile />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('lounge-profile-shell')).toHaveAttribute('data-tone', 'lounge-noir');
    expect(screen.getByRole('heading', { name: 'Lounge profile' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Profile overview' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Profile form' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Profile quick links' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Host Name')).toBeInTheDocument();
    expect(screen.getByText('Host Name')).toBeInTheDocument();
    expect(screen.getByText('Current headline')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lounge home' })).toHaveAttribute('href', '/lounge');
    expect(screen.getByRole('link', { name: 'Alias management' })).toHaveAttribute('href', '/lounge/aliases');
    expect(screen.getByDisplayValue('Current headline')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Current bio')).toBeInTheDocument();
    expect(screen.getByText('Profile preview')).toBeInTheDocument();
    expect(screen.getAllByAltText('profile')[0]).toHaveAttribute('src', 'https://example.com/host.png');
    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });

  it('falls back to the Google avatar even when bootstrap loading fails', async () => {
    getAuthBootstrapProfileMock.mockRejectedValueOnce(new Error('bootstrap unavailable'));

    render(
      <MemoryRouter>
        <LoungeProfile />
      </MemoryRouter>,
    );

    expect(await screen.findAllByAltText('profile')).toHaveLength(2);
    expect(screen.getAllByAltText('profile')[0]).toHaveAttribute('src', 'https://example.com/host.png');
  });

  it('saves only the account and public profile payloads', async () => {
    render(
      <MemoryRouter>
        <LoungeProfile />
      </MemoryRouter>,
    );

    const nameInput = await screen.findByDisplayValue('Host Name');
    fireEvent.change(nameInput, { target: { value: 'Declan Park' } });
    fireEvent.change(screen.getByDisplayValue('Current headline'), { target: { value: 'New headline' } });
    fireEvent.change(screen.getByDisplayValue('Current bio'), { target: { value: 'New bio' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(saveAccountProfileMock).toHaveBeenCalledTimes(1);
      expect(savePublicProfileMock).toHaveBeenCalledTimes(1);
    });

    expect(saveAccountProfileMock.mock.calls[0][0]).toMatchObject({
      userId: 'host-1',
      displayName: 'Declan Park',
      statusMessage: 'Available for conversations',
      profileImageUrl: undefined,
    });
    expect(savePublicProfileMock.mock.calls[0][0]).toMatchObject({
      userId: 'host-1',
      slug: 'host-name',
      headline: 'New headline',
      bio: 'New bio',
    });
  });

  it('allows remote image upload and deletion', async () => {
    const { container } = render(
      <MemoryRouter>
        <LoungeProfile />
      </MemoryRouter>,
    );

    await screen.findByDisplayValue('Host Name');
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(saveAccountProfileImageMock).toHaveBeenCalledWith(file);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));

    await waitFor(() => {
      expect(removeAccountProfileImageMock).toHaveBeenCalledTimes(1);
    });
  });
});
