import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoungeRequests from './LoungeRequests';

const useAuthSessionMock = vi.fn();
const useRequestsMock = vi.fn();
const useExpireRequestsMock = vi.fn();
const getConfiguredPersonalLinkApiUrlMock = vi.fn();
const usePersonalLinkRepositoryMock = vi.fn();

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

vi.mock('@/features/personal-link/useRequests', () => ({
  useRequests: (...args: unknown[]) => useRequestsMock(...args),
  useExpireRequests: (...args: unknown[]) => useExpireRequestsMock(...args),
}));

vi.mock('@/features/personal-link/usePersonalLinkRepository', () => ({
  getConfiguredPersonalLinkApiUrl: () => getConfiguredPersonalLinkApiUrlMock(),
  usePersonalLinkRepository: (...args: unknown[]) => usePersonalLinkRepositoryMock(...args),
}));

describe('LoungeRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Host Name',
        loggedInAt: '2026-04-22T10:00:00.000Z',
      },
    });
    useRequestsMock.mockReturnValue({
      data: [
        {
          id: 'req-1',
          visitorName: 'Maya Kim',
          visitorEmail: 'maya@example.com',
          message: 'Looking for a short kickoff session.',
          requestType: 'collab',
          status: 'pending',
          expiresAt: '2026-04-27T09:00:00.000Z',
        },
      ],
    });
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue(undefined);
    usePersonalLinkRepositoryMock.mockReturnValue({ kind: 'local' });
    useExpireRequestsMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
  });

  it('renders the requests workspace and keeps the in-scope navigation shortcuts', () => {
    render(
      <MemoryRouter>
        <LoungeRequests />
      </MemoryRouter>,
    );

    expect(screen.getByText('개인 링크 운영 워크스페이스')).toBeInTheDocument();
    expect(screen.getByText('요청 인박스')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /라운지/i })).toHaveAttribute('href', '/lounge');
    expect(screen.getByRole('link', { name: /Communication History/i })).toHaveAttribute('href', '/lounge/conversations');
    expect(screen.getByRole('link', { name: /Alias Management/i })).toHaveAttribute('href', '/lounge/aliases');
    expect(screen.getByText('Maya Kim')).toBeInTheDocument();
    expect(screen.getByText('collab · pending')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /삭제/i })).not.toBeInTheDocument();
  });

  it('threads the configured backend selection and skips local expiry mutations on the remote surface', () => {
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('https://api.pons.link');
    usePersonalLinkRepositoryMock.mockReturnValue({ kind: 'remote' });
    const mutateAsyncMock = vi.fn().mockResolvedValue(undefined);
    useExpireRequestsMock.mockReturnValue({ mutateAsync: mutateAsyncMock });

    render(
      <MemoryRouter>
        <LoungeRequests />
      </MemoryRouter>,
    );

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
    expect(useRequestsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'https://api.pons.link' });
    expect(useExpireRequestsMock).toHaveBeenCalledWith('https://api.pons.link');
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});
