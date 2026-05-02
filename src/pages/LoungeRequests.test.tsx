import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

const renderLoungeRequests = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoungeRequests />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

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
          preferredTimeNote: '2026-05-02T10:00:00.000Z',
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
    renderLoungeRequests();

    expect(screen.getByText('Personal link workspace')).toBeInTheDocument();
    expect(screen.getByText('Request inbox')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lounge/i })).toHaveAttribute('href', '/lounge');
    expect(screen.getByRole('link', { name: /Communication History/i })).toHaveAttribute('href', '/lounge/conversations');
    expect(screen.getByRole('link', { name: /Alias Management/i })).toHaveAttribute('href', '/lounge/aliases');
    expect(screen.getByText('Maya Kim')).toBeInTheDocument();
    expect(screen.getByText('collab · pending · guest visitor')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
  });

  it('threads the configured backend selection and skips local expiry mutations on the remote surface', () => {
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('http://localhost:6650');
    usePersonalLinkRepositoryMock.mockReturnValue({ kind: 'remote' });
    const mutateAsyncMock = vi.fn().mockResolvedValue(undefined);
    useExpireRequestsMock.mockReturnValue({ mutateAsync: mutateAsyncMock });

    renderLoungeRequests();

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
    expect(useRequestsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'http://localhost:6650' });
    expect(useExpireRequestsMock).toHaveBeenCalledWith('http://localhost:6650');
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });
});
