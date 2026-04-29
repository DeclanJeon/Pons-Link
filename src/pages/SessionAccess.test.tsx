import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionAccess from './SessionAccess';

const usePersonalLinkRepositoryMock = vi.fn();
const getSessionAccessMock = vi.fn();

vi.mock('@/features/personal-link/usePersonalLinkRepository', () => ({
  getConfiguredPersonalLinkApiUrl: () => 'http://localhost:6650',
  usePersonalLinkRepository: (...args: unknown[]) => usePersonalLinkRepositoryMock(...args),
}));

const SearchEcho = () => {
  const location = useLocation();
  return <div>joined {location.search}</div>;
};

describe('SessionAccess', () => {
  beforeEach(() => {
    getSessionAccessMock.mockReset();
    usePersonalLinkRepositoryMock.mockReturnValue({
      kind: 'remote',
      getSessionAccess: getSessionAccessMock,
    });
  });

  it('passes the reservation id and guest access token from the emailed URL', async () => {
    getSessionAccessMock.mockResolvedValue({
      state: 'not_found',
    });

    render(
      <MemoryRouter initialEntries={['/session-access/reservation-1?token=guest-access-token']}>
        <Routes>
          <Route path="/session-access/:reservationId" element={<SessionAccess />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getSessionAccessMock).toHaveBeenCalledWith('reservation-1', 'guest-access-token');
    });
  });

  it('redirects allowed guests to the reserved room type instead of defaulting to video', async () => {
    getSessionAccessMock.mockResolvedValue({
      state: 'allowed',
      reservation: {
        id: 'reservation-1',
        bookingId: 'reservation-1',
        roomTitle: 'Session reservation-1',
        roomType: 'audio-group',
        hostUserId: 'host-1',
        guestDisplayName: 'Maya Kim',
        guestEmail: 'maya@example.com',
        joinPath: '/join/reservation-1?token=participant-join-token',
        accessToken: 'join-token',
        joinWindowStartsAt: '2026-04-24T04:45:00.000Z',
        joinWindowEndsAt: '2026-04-24T06:30:00.000Z',
        status: 'scheduled',
        createdAt: '2026-04-24T04:00:00.000Z',
        updatedAt: '2026-04-24T04:00:00.000Z',
      },
    });

    render(
      <MemoryRouter initialEntries={['/session-access/reservation-1?token=guest-access-token']}>
        <Routes>
          <Route path="/session-access/:reservationId" element={<SessionAccess />} />
          <Route path="/join/:reservationId" element={<SearchEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('joined ?token=participant-join-token&type=audio-group')).toBeInTheDocument();
    });
  });

  it('preserves an existing room type on allowed guest join URLs', async () => {
    getSessionAccessMock.mockResolvedValue({
      state: 'allowed',
      reservation: {
        id: 'reservation-1',
        bookingId: 'reservation-1',
        roomTitle: 'Session reservation-1',
        roomType: 'audio-group',
        hostUserId: 'host-1',
        guestDisplayName: 'Maya Kim',
        guestEmail: 'maya@example.com',
        joinPath: '/join/reservation-1?token=participant-join-token&type=audio-one-to-one',
        accessToken: 'join-token',
        joinWindowStartsAt: '2026-04-24T04:45:00.000Z',
        joinWindowEndsAt: '2026-04-24T06:30:00.000Z',
        status: 'scheduled',
        createdAt: '2026-04-24T04:00:00.000Z',
        updatedAt: '2026-04-24T04:00:00.000Z',
      },
    });

    render(
      <MemoryRouter initialEntries={['/session-access/reservation-1?token=guest-access-token']}>
        <Routes>
          <Route path="/session-access/:reservationId" element={<SessionAccess />} />
          <Route path="/join/:reservationId" element={<SearchEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('joined ?token=participant-join-token&type=audio-one-to-one')).toBeInTheDocument();
    });
  });

  it('falls back to the reservation guest email when the access token does not match the guest reservation', async () => {
    getSessionAccessMock.mockResolvedValue({
      state: 'email_mismatch',
      reason: 'booking_email_mismatch',
      reservation: {
        id: 'reservation-1',
        bookingId: 'reservation-1',
        roomTitle: 'Session reservation-1',
        roomType: 'video-one-to-one',
        hostUserId: 'host-1',
        guestDisplayName: 'Maya Kim',
        guestEmail: 'maya@example.com',
        joinPath: '/join/reservation-1?token=participant-join-token',
        accessToken: 'join-token',
        joinWindowStartsAt: '2026-04-24T04:45:00.000Z',
        joinWindowEndsAt: '2026-04-24T06:30:00.000Z',
        status: 'scheduled',
        createdAt: '2026-04-24T04:00:00.000Z',
        updatedAt: '2026-04-24T04:00:00.000Z',
      },
    });

    render(
      <MemoryRouter initialEntries={['/session-access/reservation-1?token=stale-access-token']}>
        <Routes>
          <Route path="/session-access/:reservationId" element={<SessionAccess />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Booking email: maya@example.com')).toBeInTheDocument();
    });
  });
});
