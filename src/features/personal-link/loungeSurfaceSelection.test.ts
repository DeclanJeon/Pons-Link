import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const useRequestsMock = vi.fn();
const useBookingsMock = vi.fn();
const useMyProfileMock = vi.fn();
const useFriendsMock = vi.fn();
const useAuthSessionMock = vi.fn();

vi.mock('./backendSurface', () => ({
  getConfiguredPersonalLinkApiUrl: () => 'http://localhost:6650',
}));

vi.mock('./useRequests', () => ({
  useRequests: (...args: unknown[]) => useRequestsMock(...args),
}));

vi.mock('./useBookings', () => ({
  useBookings: (...args: unknown[]) => useBookingsMock(...args),
}));

vi.mock('./useMyProfile', () => ({
  useMyProfile: (...args: unknown[]) => useMyProfileMock(...args),
}));

vi.mock('./useFriends', () => ({
  useFriends: (...args: unknown[]) => useFriendsMock(...args),
}));

vi.mock('./useAuthSession', () => ({
  useAuthSession: (...args: unknown[]) => useAuthSessionMock(...args),
}));

describe('lounge surface selection', () => {
  const HookHarness = ({ run }: { run: () => void }) => {
    run();
    return null;
  };

  it('threads the configured personal-link api url through dashboard composition hooks', async () => {
    useRequestsMock.mockReturnValue({ data: [] });
    useBookingsMock.mockReturnValue({ list: { data: [] } });
    useMyProfileMock.mockReturnValue({ bootstrap: { data: null } });
    useFriendsMock.mockReturnValue({ list: { data: [] } });
    useAuthSessionMock.mockReturnValue({ session: null, logout: vi.fn() });

    const { useDashboard } = await import('./useDashboard');

    render(React.createElement(HookHarness, {
      run: () => {
        useDashboard();
      },
    }));

    expect(useRequestsMock).toHaveBeenCalledWith('pending', { apiUrl: 'http://localhost:6650' });
    expect(useBookingsMock).toHaveBeenCalledWith('confirmed', { apiUrl: 'http://localhost:6650' });
    expect(useMyProfileMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });

  it('threads the configured personal-link api url through conversations and aliases hooks', async () => {
    useRequestsMock.mockReturnValue({ data: [] });
    useBookingsMock.mockReturnValue({ list: { data: [] } });
    useMyProfileMock.mockReturnValue({ bootstrap: { data: null } });

    const { useConversations } = await import('./useConversations');
    const { useAliases } = await import('./useAliases');

    render(React.createElement(HookHarness, {
      run: () => {
        useConversations();
        useAliases();
      },
    }));

    expect(useRequestsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'http://localhost:6650' });
    expect(useBookingsMock).toHaveBeenCalledWith(undefined, { apiUrl: 'http://localhost:6650' });
    expect(useMyProfileMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
  });
});
