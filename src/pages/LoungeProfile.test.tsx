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
        statusMessage: '대화 가능',
        profileImageUrl: 'https://example.com/profile.png',
        createdAt: '2026-04-21T10:00:00.000Z',
        updatedAt: '2026-04-21T10:00:00.000Z',
      },
      publicProfile: {
        userId: 'host-1',
        slug: 'host-name',
        headline: '기존 소개',
        bio: '기존 바이오',
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

  it('renders the baseline profile form and keeps alias navigation available', async () => {
    render(
      <MemoryRouter>
        <LoungeProfile />
      </MemoryRouter>,
    );

    expect(screen.getByText('라운지 프로필')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '라운지' })).toHaveAttribute('href', '/lounge');
    expect(screen.getByRole('link', { name: '별칭 운영' })).toHaveAttribute('href', '/lounge/aliases');
    expect(await screen.findByDisplayValue('Host Name')).toBeInTheDocument();
    expect(screen.getByDisplayValue('기존 소개')).toBeInTheDocument();
    expect(screen.getByDisplayValue('기존 바이오')).toBeInTheDocument();
    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });

  it('saves only the account and public profile payloads', async () => {
    render(
      <MemoryRouter>
        <LoungeProfile />
      </MemoryRouter>,
    );

    const nameInput = await screen.findByDisplayValue('Host Name');
    fireEvent.change(nameInput, { target: { value: 'Declan Park' } });
    fireEvent.change(screen.getByDisplayValue('기존 소개'), { target: { value: '새 헤드라인' } });
    fireEvent.change(screen.getByDisplayValue('기존 바이오'), { target: { value: '새 바이오' } });

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(saveAccountProfileMock).toHaveBeenCalledTimes(1);
      expect(savePublicProfileMock).toHaveBeenCalledTimes(1);
    });

    expect(saveAccountProfileMock.mock.calls[0][0]).toMatchObject({
      userId: 'host-1',
      displayName: 'Declan Park',
      statusMessage: '대화 가능',
      profileImageUrl: 'https://example.com/profile.png',
    });
    expect(savePublicProfileMock.mock.calls[0][0]).toMatchObject({
      userId: 'host-1',
      slug: 'host-name',
      headline: '새 헤드라인',
      bio: '새 바이오',
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

    fireEvent.click(screen.getByRole('button', { name: '이미지 삭제' }));

    await waitFor(() => {
      expect(removeAccountProfileImageMock).toHaveBeenCalledTimes(1);
    });
  });
});
