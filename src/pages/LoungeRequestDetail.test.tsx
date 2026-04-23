import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoungeRequestDetail from './LoungeRequestDetail';

const useAuthSessionMock = vi.fn();
const useRequestDetailMock = vi.fn();
const useFriendsMock = vi.fn();
const getConfiguredPersonalLinkApiUrlMock = vi.fn();
const usePersonalLinkRepositoryMock = vi.fn();
const acceptMutateAsyncMock = vi.fn();
const counterMutateAsyncMock = vi.fn();
const declineMutateAsyncMock = vi.fn();

vi.mock('@/features/personal-link/useAuthSession', () => ({
  useAuthSession: () => useAuthSessionMock(),
}));

vi.mock('@/features/personal-link/usePersonalLinkRepository', () => ({
  getConfiguredPersonalLinkApiUrl: () => getConfiguredPersonalLinkApiUrlMock(),
  usePersonalLinkRepository: (...args: unknown[]) => usePersonalLinkRepositoryMock(...args),
}));

vi.mock('@/features/personal-link/useRequestDetail', () => ({
  useRequestDetail: (...args: unknown[]) => useRequestDetailMock(...args),
}));

vi.mock('@/features/personal-link/useFriends', () => ({
  useFriends: (...args: unknown[]) => useFriendsMock(...args),
}));

describe('LoungeRequestDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    acceptMutateAsyncMock.mockReset();
    counterMutateAsyncMock.mockReset();
    declineMutateAsyncMock.mockReset();

    acceptMutateAsyncMock.mockResolvedValue({ id: 'booking-1' });
    counterMutateAsyncMock.mockResolvedValue({ id: 'booking-2' });
    declineMutateAsyncMock.mockResolvedValue({ id: 'req-1' });

    useAuthSessionMock.mockReturnValue({
      session: {
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Host Name',
        loggedInAt: '2026-04-21T10:00:00.000Z',
      },
    });
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue(undefined);
    usePersonalLinkRepositoryMock.mockReturnValue({ kind: 'local' });

    useRequestDetailMock.mockReturnValue({
      detail: {
        data: {
          id: 'req-1',
          hostUserId: 'host-1',
          hostSlug: 'host-name',
          visitorName: 'Visitor Name',
          visitorEmail: 'visitor@example.com',
          visitorTimezone: 'America/New_York',
          requestType: 'collab',
          message: 'I would like to discuss a partnership opportunity.',
          preferredTimeNote: '2026-05-01 10:00',
          status: 'pending',
          expiresAt: '2026-05-07T10:00:00.000Z',
          createdAt: '2026-04-21T10:00:00.000Z',
          updatedAt: '2026-04-21T10:00:00.000Z',
        },
      },
      accept: { mutateAsync: acceptMutateAsyncMock },
      counter: { mutateAsync: counterMutateAsyncMock },
      decline: { mutateAsync: declineMutateAsyncMock },
    });

    useFriendsMock.mockReturnValue({
      list: { data: [] },
      blockVisitorIdentity: { mutateAsync: vi.fn() },
    });
  });

  it('keeps the IA additions without the scheduling automation drift', () => {
    render(
      <MemoryRouter initialEntries={['/lounge/requests/req-1']}>
        <Routes>
          <Route path="/lounge/requests/:requestId" element={<LoungeRequestDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('요청 검토 및 세션 준비')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Communication History/i })).toHaveAttribute('href', '/lounge/conversations');
    expect(screen.getByRole('link', { name: /Reservations/i })).toHaveAttribute('href', '/lounge/bookings');
    expect(screen.getByText('방문자 시간대')).toBeInTheDocument();
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
    expect(screen.queryByText('추천 시간대')).not.toBeInTheDocument();
    expect(screen.queryByText('시간대 정렬')).not.toBeInTheDocument();
  });

  it('uses the backend action mutations directly without the legacy page-level email fetches', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    render(
      <MemoryRouter initialEntries={['/lounge/requests/req-1']}>
        <Routes>
          <Route path="/lounge/requests/:requestId" element={<LoungeRequestDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('시작 시간'), { target: { value: '2026-05-01T10:00' } });
    fireEvent.change(screen.getByLabelText('종료 시간'), { target: { value: '2026-05-01T10:30' } });

    fireEvent.click(screen.getByRole('button', { name: '수락' }));

    await waitFor(() => {
      expect(acceptMutateAsyncMock).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: '거절' }));

    await waitFor(() => {
      expect(declineMutateAsyncMock).toHaveBeenCalled();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('threads the configured backend selection and hides block actions on the remote surface', () => {
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('https://api.pons.link');
    usePersonalLinkRepositoryMock.mockReturnValue({ kind: 'remote' });

    render(
      <MemoryRouter initialEntries={['/lounge/requests/req-1']}>
        <Routes>
          <Route path="/lounge/requests/:requestId" element={<LoungeRequestDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
    expect(useRequestDetailMock).toHaveBeenCalledWith('req-1', { apiUrl: 'https://api.pons.link' });
    expect(useFriendsMock).toHaveBeenCalledWith({ apiUrl: 'https://api.pons.link' });
    expect(screen.getByText('방문자 차단 액션은 현재 원격 백엔드 라운지에서 아직 노출되지 않아 이 화면에서는 숨깁니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '상대 차단' })).not.toBeInTheDocument();
  });
});
