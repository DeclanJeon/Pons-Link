import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoungeEmailDeliveries from './LoungeEmailDeliveries';

const useAuthSessionMock = vi.fn();
const useBookingsMock = vi.fn();
const useEmailDeliveriesMock = vi.fn();

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

vi.mock('@/features/personal-link/useBookings', () => ({
  useBookings: () => useBookingsMock(),
}));

vi.mock('@/features/personal-link/useEmailDeliveries', () => ({
  useEmailDeliveries: (...args: unknown[]) => useEmailDeliveriesMock(...args),
}));

describe('LoungeEmailDeliveries', () => {
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
      list: { data: [{ id: 'booking-1' }] },
    });

    useEmailDeliveriesMock.mockReturnValue({
      data: [
        {
          id: 'delivery-1',
          subject: '세션 안내 메일',
          recipientEmail: 'maya@example.com',
          calendarSummary: '2026-04-24T05:00:00.000Z ~ 2026-04-24T06:00:00.000Z',
          joinUrl: '/session-access/booking-1',
          deliveryStatus: 'sent',
          createdAt: '2026-04-22T10:00:00.000Z',
        },
      ],
    });
  });

  it('renders the raw delivery status after removing the Task 3 label helper dependency', () => {
    render(
      <MemoryRouter>
        <LoungeEmailDeliveries />
      </MemoryRouter>,
    );

expect(screen.getByText('1 sent')).toBeInTheDocument();
  });
});
