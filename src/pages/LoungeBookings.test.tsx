import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoungeBookings from './LoungeBookings';

const useAuthSessionMock = vi.fn();
const useBookingsMock = vi.fn();

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

vi.mock('@/features/personal-link/useBookings', () => ({
  useBookings: () => useBookingsMock(),
}));

describe('LoungeBookings', () => {
  beforeEach(() => {
    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Host Name',
        loggedInAt: '2026-04-22T10:00:00.000Z',
      },
    });
    useBookingsMock.mockReturnValue({
      list: {
        data: [
          {
            id: 'booking-1',
            guestDisplayName: 'Maya Kim',
            guestEmail: 'maya@example.com',
            roomType: 'video-one-to-one',
            status: 'confirmed',
            scheduledStartAt: '2026-04-24T05:00:00.000Z',
          },
        ],
      },
    });
  });

  it('renders the korean branded bookings workspace copy', () => {
    render(
      <MemoryRouter>
        <LoungeBookings />
      </MemoryRouter>,
    );

    expect(screen.getByText('Personal link workspace')).toBeInTheDocument();
    expect(screen.getByText('Reservation board')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lounge/i })).toHaveAttribute('href', '/lounge');
    expect(screen.getByText('Maya Kim')).toBeInTheDocument();
    expect(screen.getByText('video-one-to-one')).toBeInTheDocument();
    expect(screen.getByText('Status · confirmed')).toBeInTheDocument();
  });
});
