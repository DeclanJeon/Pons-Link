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
    renderHook(() => useRequests('pending', { apiUrl: 'http://localhost:6650' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('passes repository selection input through useBookings', () => {
    renderHook(() => useBookings('confirmed', { apiUrl: 'http://localhost:6650' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('passes repository selection input through useMyProfile', () => {
    renderHook(() => useMyProfile({ apiUrl: 'http://localhost:6650' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('passes repository selection input through useBookingDetail', () => {
    renderHook(() => useBookingDetail('booking-1', { apiUrl: 'http://localhost:6650' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('passes repository selection input through useRequestDetail', () => {
    renderHook(() => useRequestDetail('request-1', { apiUrl: 'http://localhost:6650' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('passes repository selection input through useEmailDeliveries hooks', () => {
    renderHook(() => useEmailDeliveries(['booking-1'], { apiUrl: 'http://localhost:6650' }));
    renderHook(() => useEmailDelivery('booking-1', { apiUrl: 'http://localhost:6650' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('passes repository selection input through useSessionReservation', () => {
    renderHook(() => useSessionReservation({ apiUrl: 'http://localhost:6650' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('passes repository selection input through useFriends', () => {
    renderHook(() => useFriends({ apiUrl: 'http://localhost:6650' }));

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('does not retry or keep polling failed lounge request queries', () => {
    renderHook(() => useRequests('pending', { apiUrl: 'http://localhost:6650' }));

    const options = useQueryMock.mock.calls.at(-1)?.[0];
    expect(options.retry).toBe(false);
    expect(options.refetchInterval({ state: { error: new Error('rate limited') } })).toBe(false);
    expect(options.refetchInterval({ state: { error: null } })).toBe(5000);
  });

  it('does not retry or keep polling failed lounge reservation queries', () => {
    renderHook(() => useBookings('confirmed', { apiUrl: 'http://localhost:6650' }));

    const options = useQueryMock.mock.calls.at(-1)?.[0];
    expect(options.retry).toBe(false);
    expect(options.refetchInterval({ state: { error: new Error('rate limited') } })).toBe(false);
    expect(options.refetchInterval({ state: { error: null } })).toBe(5000);
  });

  it('does not retry or keep polling failed lounge friend queries', () => {
    renderHook(() => useFriends({ apiUrl: 'http://localhost:6650' }));

    const options = useQueryMock.mock.calls.at(-1)?.[0];
    expect(options.retry).toBe(false);
    expect(options.refetchInterval({ state: { error: new Error('rate limited') } })).toBe(false);
    expect(options.refetchInterval({ state: { error: null } })).toBe(5000);
  });
});
