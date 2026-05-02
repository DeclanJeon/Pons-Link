import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAliases } from './useAliases';
import { useConversations } from './useConversations';
import { useDashboard } from './useDashboard';

const {
  useRequestsMock,
  useBookingsMock,
  useMyProfileMock,
  useFriendsMock,
  useAuthSessionMock,
  useLoungeEventsMock,
} = vi.hoisted(() => ({
  useRequestsMock: vi.fn(),
  useBookingsMock: vi.fn(),
  useMyProfileMock: vi.fn(),
  useFriendsMock: vi.fn(),
  useAuthSessionMock: vi.fn(),
  useLoungeEventsMock: vi.fn(),
}));

vi.mock('./useRequests', () => ({
  useRequests: useRequestsMock,
}));

vi.mock('./useBookings', () => ({
  useBookings: useBookingsMock,
}));

vi.mock('./useMyProfile', () => ({
  useMyProfile: useMyProfileMock,
}));

vi.mock('./useFriends', () => ({
  useFriends: useFriendsMock,
}));

vi.mock('./useAuthSession', () => ({
  useAuthSession: useAuthSessionMock,
}));

vi.mock('./useLoungeEvents', () => ({
  useLoungeEvents: useLoungeEventsMock,
}));

describe('lounge composition hook selection threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useRequestsMock.mockReturnValue({ data: [] });
    useBookingsMock.mockReturnValue({
      list: { data: [] },
      cancelBooking: { mutate: vi.fn() },
      markNoShow: { mutate: vi.fn() },
      markRescheduleNeeded: { mutate: vi.fn() },
    });
    useMyProfileMock.mockReturnValue({
      bootstrap: { data: { accountProfile: null, publicProfile: null } },
      saveUserProfile: { mutate: vi.fn() },
      saveAccountProfile: { mutate: vi.fn() },
      savePublicProfile: { mutate: vi.fn() },
    });
    useFriendsMock.mockReturnValue({ list: { data: [] } });
    useAuthSessionMock.mockReturnValue({ session: null, logout: vi.fn() });
    useLoungeEventsMock.mockReturnValue({ data: [] });
  });

  it('threads repository selection input through useDashboard', () => {
    renderHook(() => useDashboard({ apiUrl: 'http://localhost:6650' }));

    expect(useFriendsMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
    expect(useRequestsMock).toHaveBeenCalledWith('pending', { apiUrl: 'http://localhost:6650' });
    expect(useRequestsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'http://localhost:6650' });
    expect(useBookingsMock).toHaveBeenCalledWith('confirmed', { apiUrl: 'http://localhost:6650' });
    expect(useBookingsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'http://localhost:6650' });
    expect(useMyProfileMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
    expect(useMyProfileMock).toHaveBeenCalledTimes(2);
  });

  it('threads repository selection input through useConversations', () => {
    renderHook(() => useConversations({ apiUrl: 'http://localhost:6650' }));

    expect(useRequestsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'http://localhost:6650' });
    expect(useBookingsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'http://localhost:6650' });
  });

  it('threads repository selection input through useAliases', () => {
    renderHook(() => useAliases({ apiUrl: 'http://localhost:6650' }));

    expect(useMyProfileMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });
});
