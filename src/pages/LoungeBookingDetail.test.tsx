import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoungeBookingDetail from './LoungeBookingDetail';

const usePersonalLinkRepositoryMock = vi.fn();
const useAuthSessionMock = vi.fn();
const useBookingsMock = vi.fn();
const useSessionReservationMock = vi.fn();
const useBookingDetailMock = vi.fn();
const useEmailDeliveryMock = vi.fn();

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

vi.mock('@/features/personal-link/usePersonalLinkRepository', () => ({
  getConfiguredPersonalLinkApiUrl: () => 'https://api.pons.link',
  usePersonalLinkRepository: (...args: unknown[]) => usePersonalLinkRepositoryMock(...args),
}));

vi.mock('@/features/personal-link/useBookings', () => ({
  useBookings: (...args: unknown[]) => useBookingsMock(...args),
}));

vi.mock('@/features/personal-link/useSessionReservation', () => ({
  useSessionReservation: (...args: unknown[]) => useSessionReservationMock(...args),
}));

vi.mock('@/features/personal-link/useBookingDetail', () => ({
  useBookingDetail: (...args: unknown[]) => useBookingDetailMock(...args),
}));

vi.mock('@/features/personal-link/useEmailDeliveries', () => ({
  useEmailDelivery: (...args: unknown[]) => useEmailDeliveryMock(...args),
}));

describe('LoungeBookingDetail', () => {
  beforeEach(() => {
    usePersonalLinkRepositoryMock.mockReturnValue({ kind: 'local' });

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
      cancelBooking: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
      markNoShow: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
      markRescheduleNeeded: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
    });

    useSessionReservationMock.mockReturnValue({
      createReservation: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
      createEmailDelivery: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
      resendEmailDelivery: { mutateAsync: vi.fn().mockResolvedValue(undefined) },
    });

    useBookingDetailMock.mockReturnValue({
      detail: {
        data: {
          id: 'booking-1',
          guestDisplayName: 'Maya Kim',
          guestEmail: 'maya@example.com',
          roomType: 'video-one-to-one',
          status: 'confirmed',
          scheduledStartAt: '2026-04-24T05:00:00.000Z',
          scheduledEndAt: '2026-04-24T06:00:00.000Z',
        },
      },
      reservation: { data: { id: 'reservation-1', joinPath: '/join/reservation-1?token=host-join-token' } },
    });

    useEmailDeliveryMock.mockReturnValue({
      data: {
        deliveryStatus: 'sent',
        recipientEmail: 'maya@example.com',
        calendarSummary: '2026-04-24T05:00:00.000Z ~ 2026-04-24T06:00:00.000Z',
        joinUrl: '/session-access/booking-1',
      },
    });
  });

  it('renders the booking detail values without Task 3 label mapping drift', () => {
    render(
      <MemoryRouter initialEntries={['/lounge/bookings/booking-1']}>
        <Routes>
          <Route path="/lounge/bookings/:bookingId" element={<LoungeBookingDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('video-one-to-one · confirmed')).toBeInTheDocument();
    expect(screen.getByText('sent')).toBeInTheDocument();
  });

  it('gates remote-only unsupported booking status actions while keeping email operations visible', () => {
    usePersonalLinkRepositoryMock.mockReturnValue({ kind: 'remote' });

    render(
      <MemoryRouter initialEntries={['/lounge/bookings/booking-1']}>
        <Routes>
          <Route path="/lounge/bookings/:bookingId" element={<LoungeBookingDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('세션 준비')).toBeInTheDocument();
    expect(screen.getByText('이메일 재발송')).toBeInTheDocument();
    expect(screen.getByText('예약 상태 변경 액션은 현재 원격 백엔드 라운지에서 아직 노출되지 않아 이 화면에서는 숨깁니다.')).toBeInTheDocument();
    expect(screen.queryByText('재조율 필요')).not.toBeInTheDocument();
    expect(screen.queryByText('노쇼 처리')).not.toBeInTheDocument();
    expect(screen.queryByText('예약 취소')).not.toBeInTheDocument();
  });

  it('routes the host-side session action through the reservation join path instead of the guest session-access page', () => {
    render(
      <MemoryRouter initialEntries={['/lounge/bookings/booking-1']}>
        <Routes>
          <Route path="/lounge/bookings/:bookingId" element={<LoungeBookingDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: '세션 입장 확인' })).toHaveAttribute(
      'href',
      '/join/reservation-1?token=host-join-token',
    );
  });
});
