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
} = vi.hoisted(() => ({
  useRequestsMock: vi.fn(),
  useBookingsMock: vi.fn(),
  useMyProfileMock: vi.fn(),
  useFriendsMock: vi.fn(),
  useAuthSessionMock: vi.fn(),
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
  });

  it('threads repository selection input through useDashboard', () => {
    renderHook(() => useDashboard({ apiUrl: 'https://api.pons.link' }));

    expect(useFriendsMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
    expect(useRequestsMock).toHaveBeenCalledWith('pending', { apiUrl: 'https://api.pons.link' });
    expect(useRequestsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'https://api.pons.link' });
    expect(useBookingsMock).toHaveBeenCalledWith('confirmed', { apiUrl: 'https://api.pons.link' });
    expect(useBookingsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'https://api.pons.link' });
    expect(useMyProfileMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
    expect(useMyProfileMock).toHaveBeenCalledTimes(2);
  });

  it('threads repository selection input through useConversations', () => {
    renderHook(() => useConversations({ apiUrl: 'https://api.pons.link' }));

    expect(useRequestsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'https://api.pons.link' });
    expect(useBookingsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'https://api.pons.link' });
  });

  it('threads repository selection input through useAliases', () => {
    renderHook(() => useAliases({ apiUrl: 'https://api.pons.link' }));

    expect(useMyProfileMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
  });
});
