import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePublicProfile } from './usePublicProfile';

const { useQueryMock, getPersonalLinkRepositoryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  getPersonalLinkRepositoryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}));

vi.mock('./usePersonalLinkRepository', () => ({
  getPersonalLinkRepository: getPersonalLinkRepositoryMock,
  resolvePersonalLinkApiUrl: (apiUrl?: string | null) => apiUrl?.replace(/\/+$/, '') ?? null,
}));

describe('usePublicProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPersonalLinkRepositoryMock.mockReturnValue({ getPublicProfileBySlug: vi.fn() });
    useQueryMock.mockImplementation((options) => ({ data: undefined, isLoading: false, ...options }));
  });

  it('disables the public alias lookup when the caller marks the room as legacy/direct', () => {
    renderHook(() => usePublicProfile('325', 'https://api.ponslink.online', {
      requireRemote: true,
      retry: false,
      enabled: false,
    }));

    expect(useQueryMock).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
      queryKey: ['personal-link', 'public-profile', 'https://api.ponslink.online', '325'],
    }));
  });

  it('keeps personal-link alias lookup enabled by default', () => {
    renderHook(() => usePublicProfile('declan', 'https://api.ponslink.online', {
      requireRemote: true,
      retry: false,
    }));

    expect(useQueryMock).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      queryKey: ['personal-link', 'public-profile', 'https://api.ponslink.online', 'declan'],
    }));
  });
});
