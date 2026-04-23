import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicProfile from './PublicProfile';

const mutateAsync = vi.fn();
const usePublicProfileMock = vi.fn();
const useAuthSessionMock = vi.fn();

vi.mock('@/features/personal-link/usePublicProfile', () => ({
  usePublicProfile: (...args: unknown[]) => usePublicProfileMock(...args),
}));

vi.mock('@/features/personal-link/useCreateRequest', () => ({
  useCreateRequest: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

describe('PublicProfile request privacy', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    usePublicProfileMock.mockReset();
    useAuthSessionMock.mockReset();

    useAuthSessionMock.mockReturnValue({
      session: null,
      isAuthenticated: false,
      setSession: vi.fn(),
      logout: vi.fn(),
    });

    usePublicProfileMock.mockReturnValue({
      isLoading: false,
      data: {
        slug: 'alpha',
        displayName: 'Alpha Host',
        headline: 'Host headline',
        bio: 'Host bio',
        profileVisibility: 'public',
        responsePolicy: 'approve_before_booking',
        allowGeneralRequest: true,
        allowScheduleRequest: true,
        allowMentoringRequest: true,
        allowCollabRequest: true,
      },
    });
  });

  it('does not render a raw email input in the public request composer copy', () => {
    render(
      <MemoryRouter initialEntries={['/u/alpha']}>
        <Routes>
          <Route path="/u/:slug" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.queryByPlaceholderText(/Email for the reply/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/PonsLink will mediate follow-up notifications without exposing email addresses\./i),
    ).toBeInTheDocument();
  });
});
