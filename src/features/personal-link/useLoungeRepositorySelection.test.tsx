import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBookingDetail } from './useBookingDetail';
import { useBookings } from './useBookings';
import { useEmailDeliveries, useEmailDelivery } from './useEmailDeliveries';
import { useFriends } from './useFriends';
import { useMyProfile } from './useMyProfile';
import { useRequestDetail } from './useRequestDetail';
import { useRequests } from './useRequests';
import { useSessionReservation } from './useSessionReservation';

const {
  useQueryMock,
  useMutationMock,
  useQueryClientMock,
  usePersonalLinkRepositoryMock,
  useAuthSessionMock,
} = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  useMutationMock: vi.fn(),
  useQueryClientMock: vi.fn(),
  usePersonalLinkRepositoryMock: vi.fn(),
  useAuthSessionMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
  useMutation: useMutationMock,
  useQueryClient: useQueryClientMock,
}));

vi.mock('./usePersonalLinkRepository', () => ({
  usePersonalLinkRepository: usePersonalLinkRepositoryMock,
}));

vi.mock('./useAuthSession', () => ({
  useAuthSession: useAuthSessionMock,
}));

describe('lounge repository selection hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const repository = {
      listRequests: vi.fn(),
      getRequest: vi.fn(),
      listBookings: vi.fn(),
      getBooking: vi.fn(),
      getSessionReservation: vi.fn(),
      listFriends: vi.fn(),
      listEmailDeliveries: vi.fn(),
      getEmailDelivery: vi.fn(),
      createSessionReservation: vi.fn(),
      createEmailDelivery: vi.fn(),
      resendEmailDelivery: vi.fn(),
      getAuthBootstrapProfile: vi.fn(),
      saveUserProfile: vi.fn(),
      saveAccountProfile: vi.fn(),
      savePublicProfile: vi.fn(),
    };

    useQueryMock.mockImplementation((options) => ({ data: undefined, ...options }));
    useMutationMock.mockImplementation((options) => ({ mutate: vi.fn(), ...options }));
    useQueryClientMock.mockReturnValue({ invalidateQueries: vi.fn() });
    usePersonalLinkRepositoryMock.mockReturnValue(repository);
    useAuthSessionMock.mockReturnValue({ session: { email: 'host@example.com' } });
  });

  it('passes repository selection input through useRequests', () => {
    renderHook(() => useRequests('pending', { apiUrl: 'https://api.pons.link' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });

  it('passes repository selection input through useBookings', () => {
    renderHook(() => useBookings('confirmed', { apiUrl: 'https://api.pons.link' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });

  it('passes repository selection input through useMyProfile', () => {
    renderHook(() => useMyProfile({ apiUrl: 'https://api.pons.link' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });

  it('passes repository selection input through useBookingDetail', () => {
    renderHook(() => useBookingDetail('booking-1', { apiUrl: 'https://api.pons.link' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });

  it('passes repository selection input through useRequestDetail', () => {
    renderHook(() => useRequestDetail('request-1', { apiUrl: 'https://api.pons.link' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });

  it('passes repository selection input through useEmailDeliveries hooks', () => {
    renderHook(() => useEmailDeliveries(['booking-1'], { apiUrl: 'https://api.pons.link' }));
    renderHook(() => useEmailDelivery('booking-1', { apiUrl: 'https://api.pons.link' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });

  it('passes repository selection input through useSessionReservation', () => {
    renderHook(() => useSessionReservation({ apiUrl: 'https://api.pons.link' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });

  it('passes repository selection input through useFriends', () => {
    renderHook(() => useFriends({ apiUrl: 'https://api.pons.link' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });
});
