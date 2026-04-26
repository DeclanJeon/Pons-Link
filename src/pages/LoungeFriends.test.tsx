import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoungeFriends from './LoungeFriends';

const useAuthSessionMock = vi.fn();
const useFriendsMock = vi.fn();
const usePersonalLinkRepositoryMock = vi.fn();
const getConfiguredPersonalLinkApiUrlMock = vi.fn();

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

vi.mock('@/features/personal-link/useFriends', () => ({
  useFriends: (...args: unknown[]) => useFriendsMock(...args),
}));

vi.mock('@/features/personal-link/usePersonalLinkRepository', () => ({
  getConfiguredPersonalLinkApiUrl: () => getConfiguredPersonalLinkApiUrlMock(),
  usePersonalLinkRepository: (...args: unknown[]) => usePersonalLinkRepositoryMock(...args),
}));

describe('LoungeFriends', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Host Name',
        avatarUrl: 'https://example.com/profile.png',
      },
    });
    useFriendsMock.mockReturnValue({
      list: { data: [] },
      addFriend: { mutateAsync: vi.fn() },
      blockFriend: { mutateAsync: vi.fn() },
      removeFriend: { mutateAsync: vi.fn() },
    });
  });

  it('threads the configured backend surface into the friends hook', () => {
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('http://localhost:6650');

    render(
      <MemoryRouter>
        <LoungeFriends />
      </MemoryRouter>,
    );

    expect(useFriendsMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('renders the add action even when the reachable page is remote-backed', () => {
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('http://localhost:6650');

    render(
      <MemoryRouter>
        <LoungeFriends />
      </MemoryRouter>,
    );

expect(screen.getByRole('button', { name: /Add/i })).toBeInTheDocument();
  });
});
