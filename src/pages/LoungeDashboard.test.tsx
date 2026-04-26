import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Lounge from './Lounge';

const useAuthSessionMock = vi.fn();
const useFriendsMock = vi.fn();
const useRequestsMock = vi.fn();
const useBookingsMock = vi.fn();
const useMyProfileMock = vi.fn();

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

vi.mock('@/features/personal-link/useFriends', () => ({
  useFriends: () => useFriendsMock(),
}));

vi.mock('@/features/personal-link/useRequests', () => ({
  useRequests: () => useRequestsMock(),
}));

vi.mock('@/features/personal-link/useBookings', () => ({
  useBookings: () => useBookingsMock(),
}));

vi.mock('@/features/personal-link/useMyProfile', () => ({
  useMyProfile: () => useMyProfileMock(),
}));

describe('Lounge dashboard navigation', () => {
  beforeEach(() => {
    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Host Name',
        loggedInAt: '2026-04-22T10:00:00.000Z',
      },
      logout: vi.fn(),
    });
    useFriendsMock.mockReturnValue({
      list: { data: [] },
    });
    useRequestsMock.mockReturnValue({
      data: [],
    });
    useBookingsMock.mockReturnValue({
      list: { data: [] },
    });
    useMyProfileMock.mockReturnValue({
      bootstrap: {
        data: {
          accountProfile: {
            displayName: 'Host Name',
            profileImageUrl: 'https://example.com/profile.png',
          },
          publicProfile: {
            slug: 'host-name',
            headline: 'Manage requests, reservations, and follow-up from one place.',
          },
        },
      },
    });
  });

  it('shows alias management and communication history entry points', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Lounge />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getAllByText(/Communication History/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Alias Management/i).length).toBeGreaterThan(0);
  });
});
