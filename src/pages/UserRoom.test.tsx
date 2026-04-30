import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserRoom from './UserRoom';

const mutateAsync = vi.fn();
const usePublicProfileMock = vi.fn();

vi.mock('./Room', () => ({
  default: () => <div data-testid="room-page">room page</div>,
}));

vi.mock('@/features/personal-link/usePublicProfile', () => ({
  usePublicProfile: (...args: unknown[]) => usePublicProfileMock(...args),
}));

vi.mock('@/features/personal-link/useCreateRequest', () => ({
  useCreateRequest: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

const useAuthSessionMock = vi.fn();
vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

const profile = {
  userId: 'host-1',
  slug: 'declan',
  displayName: 'Declan Host',
  headline: 'available for focused calls',
  bio: 'host bio',
  responsePolicy: 'approve_before_booking',
  defaultRoomType: 'video-one-to-one',
  timezone: 'Asia/Seoul',
  profileVisibility: 'public',
  allowGeneralRequest: true,
  allowScheduleRequest: true,
  allowMentoringRequest: false,
  allowCollabRequest: false,
  createdAt: '2026-04-26T00:00:00.000Z',
  updatedAt: '2026-04-26T00:00:00.000Z',
};

const renderUserRoom = (initialEntry = '/room/declan') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[initialEntry]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/room/:roomTitle" element={<UserRoom />} />
          <Route path="/join/:roomTitle" element={<div data-testid="room-page">room page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('UserRoom personal-link entry', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ id: 'req-1' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ state: 'allowed' }), { status: 200 })));
    usePublicProfileMock.mockReset();
    usePublicProfileMock.mockReturnValue({ isLoading: false, data: profile });
    useAuthSessionMock.mockReset();
    useAuthSessionMock.mockReturnValue({ session: null, isAuthenticated: false });
  });

  it('blocks the visitor from the room page and opens an offline meeting request popup for the host slug', () => {
    renderUserRoom();

    expect(usePublicProfileMock).toHaveBeenCalledWith('declan', expect.stringMatching(/^https?:\/\//), {
      requireRemote: true,
      retry: false,
      enabled: true,
    });
    expect(screen.queryByTestId('room-page')).not.toBeInTheDocument();
    expect(screen.getByText(/only opens for the identifier owner/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /host is offline right now/i })).toBeInTheDocument();
    expect(screen.getByText(/Declan Host/i)).toBeInTheDocument();
  });

  it('does not open request popup when the profile owner visits their own room by primary alias', () => {
    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'owner-id',
        providerSubject: 'provider-owner',
        email: 'owner@example.com',
        displayName: 'Declan Host',
        primaryAlias: 'declan',
        uniqueNumber: '84520193',
        loggedInAt: '2026-04-26T00:00:00.000Z',
      },
      isAuthenticated: true,
    });

    renderUserRoom();

    expect(screen.getByTestId('room-page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /host is offline right now/i })).not.toBeInTheDocument();
  });

  it('opens the room when the backend marks the current viewer as the identifier owner', () => {
    usePublicProfileMock.mockReturnValue({
      isLoading: false,
      data: {
        ...profile,
        slug: 'secondary-room',
        viewer: {
          isOwner: true,
        },
      },
    });
    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'owner-id',
        providerSubject: 'provider-owner',
        email: 'owner@example.com',
        displayName: 'Declan Host',
        primaryAlias: 'declan',
        uniqueNumber: '84520193',
        loggedInAt: '2026-04-26T00:00:00.000Z',
      },
      isAuthenticated: true,
    });

    renderUserRoom('/room/secondary-room');

    expect(screen.getByTestId('room-page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /host is offline right now/i })).not.toBeInTheDocument();
  });

  it('opens the direct room when host lookup is unavailable', () => {
    usePublicProfileMock.mockReturnValue({ isLoading: false, data: null, isError: true, isRemoteUnavailable: false });

    renderUserRoom();

    expect(screen.getByTestId('room-page')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /host is offline right now/i })).not.toBeInTheDocument();
  });

  it('opens a legacy numeric room without querying the personal-link alias API', () => {
    usePublicProfileMock.mockReturnValue({ isLoading: false, data: null, isError: false, isRemoteUnavailable: false });

    renderUserRoom('/room/325?type=video-group');

    expect(usePublicProfileMock).toHaveBeenCalledWith('325', expect.stringMatching(/^https?:\/\//), {
      requireRemote: true,
      retry: false,
      enabled: false,
    });
    expect(screen.getByTestId('room-page')).toBeInTheDocument();
    expect(screen.queryByText(/Identifier not registered/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/only opens for the identifier owner/i)).not.toBeInTheDocument();
  });

  it('does not show the personal-room gate while checking a direct open room', () => {
    usePublicProfileMock.mockReturnValue({ isLoading: true, data: null, isError: false, isRemoteUnavailable: false });

    renderUserRoom('/room/325235?type=video-group');

    expect(screen.getByText(/Opening room/i)).toBeInTheDocument();
    expect(screen.queryByText(/only opens for the identifier owner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Identifier not registered/i)).not.toBeInTheDocument();
  });

  it('keeps the room closed without a request popup when the host has paused requests', () => {
    usePublicProfileMock.mockReturnValue({
      isLoading: false,
      data: { ...profile, responsePolicy: 'paused' },
    });

    renderUserRoom();

    expect(screen.queryByTestId('room-page')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /host is offline right now/i })).not.toBeInTheDocument();
  });

  it('opens the room when a visitor has a meeting access code', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      state: 'allowed',
      reservation: {
        joinUrl: 'http://localhost:3000/join/reservation-1?token=participant-token',
      },
    }), { status: 200 })));

    renderUserRoom('/room/declan?c_id=15#2195');

    return waitFor(() => expect(screen.getByTestId('room-page')).toBeInTheDocument());
  });

  it('keeps the room closed while a meeting access request is pending', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ state: 'pending' }), { status: 200 })));

    renderUserRoom('/room/declan?c_id=15#2195');

    await waitFor(() => expect(screen.getByText(/still waiting for the host response/i)).toBeInTheDocument());
    expect(screen.queryByTestId('room-page')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /host is offline right now/i })).not.toBeInTheDocument();
  });

  it('sends a meeting request with preferred date, message, visitor timezone, and host slug', async () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Asia/Seoul' }),
    } as Intl.DateTimeFormat);

    renderUserRoom();

    fireEvent.change(screen.getByRole('textbox', { name: /Message/i }), { target: { value: '이번 주에 제품 방향과 미팅을 논의하고 싶습니다.' } });
    fireEvent.click(screen.getByRole('button', { name: /add timing details/i }));
    fireEvent.change(screen.getByLabelText('Preferred date'), { target: { value: '2026-04-30' } });
    fireEvent.change(screen.getByLabelText('Preferred time'), { target: { value: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      hostSlug: 'declan',
      visitorName: 'PonsLink Guest',
      visitorEmail: 'noreply@ponslink.app',
      visitorTimezone: 'Asia/Seoul',
      deliveryMode: 'mediated',
      requestType: 'schedule',
      message: '이번 주에 제품 방향과 미팅을 논의하고 싶습니다.',
      preferredTimeNote: '2026-04-30T05:00:00.000Z',
    });
  });
});
