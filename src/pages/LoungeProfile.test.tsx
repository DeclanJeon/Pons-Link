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

const renderLoungeProfile = () =>
  render(
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <LoungeProfile />
    </MemoryRouter>,
  );

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
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('http://localhost:6650');

    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Host Name',
        avatarUrl: 'https://example.com/host.png',
        uniqueNumber: '84520193',
        primaryAlias: 'host-name',
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
    renderLoungeProfile();

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
    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('falls back to the Google avatar even when bootstrap loading fails', async () => {
    getAuthBootstrapProfileMock.mockRejectedValueOnce(new Error('bootstrap unavailable'));

    renderLoungeProfile();

    expect(await screen.findAllByAltText('profile')).toHaveLength(2);
    expect(screen.getAllByAltText('profile')[0]).toHaveAttribute('src', 'https://example.com/host.png');
  });

  it('falls back to empty headline and bio when bootstrap loading fails and no session values exist', async () => {
    getAuthBootstrapProfileMock.mockRejectedValueOnce(new Error('bootstrap unavailable'));

    renderLoungeProfile();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Host Name')).toBeInTheDocument();
    });

    const headlineInput = screen.getByPlaceholderText('One-line introduction');
    const bioInput = screen.getByPlaceholderText('Profile bio');
    expect(headlineInput).toHaveValue('');
    expect(bioInput).toHaveValue('');
  });

  it('saves only the account and public profile payloads', async () => {
    renderLoungeProfile();

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
      defaultRoomType: 'audio-one-to-one',
    });
  });

  it('saves the selected default session type in the public profile', async () => {
    renderLoungeProfile();

    const sessionTypeSelect = await screen.findByLabelText('Default session type');
    expect(sessionTypeSelect).toHaveValue('audio-one-to-one');

    fireEvent.change(sessionTypeSelect, { target: { value: 'video-one-to-one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(savePublicProfileMock).toHaveBeenCalledTimes(1);
    });

    expect(savePublicProfileMock.mock.calls[0][0]).toMatchObject({
      slug: 'host-name',
      defaultRoomType: 'video-one-to-one',
    });
    await waitFor(() => {
      expect(screen.getByText('Profile saved.')).toBeInTheDocument();
    });
  });

  it('lets a logged-in host set a public alias while keeping the backend unique number internal', async () => {
    renderLoungeProfile();

    const aliasInput = await screen.findByLabelText('Public lounge alias');
    expect(aliasInput).toHaveValue('host-name');
    expect(screen.getByText('Internal unique number')).toBeInTheDocument();
    expect(screen.getByText('84520193')).toBeInTheDocument();
    expect(screen.getByText('/room/host-name')).toBeInTheDocument();

    fireEvent.change(aliasInput, { target: { value: 'declan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(savePublicProfileMock).toHaveBeenCalledTimes(1);
    });

    expect(savePublicProfileMock.mock.calls[0][0]).toMatchObject({
      userId: 'host-1',
      slug: 'declan',
      headline: 'Current headline',
      bio: 'Current bio',
    });
  });

  it('allows remote image upload and deletion', async () => {
    const { container } = renderLoungeProfile();

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

  it('shows success message after saving profile', async () => {
    renderLoungeProfile();

    const nameInput = await screen.findByDisplayValue('Host Name');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => {
      expect(screen.getByText('Profile saved.')).toBeInTheDocument();
    });
  });

  it('shows character counters for headline and bio', async () => {
    renderLoungeProfile();

    await screen.findByDisplayValue('Current headline');

    expect(screen.getByText('16 / 100')).toBeInTheDocument();
    expect(screen.getByText('11 / 500')).toBeInTheDocument();
  });

  it('shows unsaved changes indicator when form is dirty', async () => {
    renderLoungeProfile();

    const nameInput = await screen.findByDisplayValue('Host Name');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('hides Remove image button when no image is present', async () => {
    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Host Name',
        avatarUrl: undefined,
        loggedInAt: '2026-04-21T10:00:00.000Z',
      },
    });

    getAuthBootstrapProfileMock.mockResolvedValue({
      accountProfile: null,
      publicProfile: null,
    });

    renderLoungeProfile();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Remove image' })).not.toBeInTheDocument();
    });
  });

  it('renders image fallback icon when image fails to load', async () => {
    getAuthBootstrapProfileMock.mockResolvedValue({
      accountProfile: {
        userId: 'host-1',
        displayName: 'Host Name',
        statusMessage: 'Available for conversations',
        profileImageUrl: 'https://broken-url.com/image.png',
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

    renderLoungeProfile();

    await screen.findByDisplayValue('Host Name');

    const images = screen.getAllByAltText('profile');
    const firstImg = images[0] as HTMLImageElement;

    fireEvent.error(firstImg);

    await waitFor(() => {
      expect(screen.getAllByTestId('profile-image-fallback')).toHaveLength(1);
    });
  });
});
