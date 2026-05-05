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
const paidProposalMutateAsyncMock = vi.fn();
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
    paidProposalMutateAsyncMock.mockReset();
    declineMutateAsyncMock.mockReset();

    acceptMutateAsyncMock.mockResolvedValue({ id: 'booking-1' });
    counterMutateAsyncMock.mockResolvedValue({ id: 'booking-2' });
    paidProposalMutateAsyncMock.mockResolvedValue({ id: 'req-1', status: 'paid_proposal_sent' });
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
          senderUserId: 'visitor-1',
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
      paidProposal: { mutateAsync: paidProposalMutateAsyncMock },
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

    expect(screen.getByText('Request review and session prep')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Communication History/i })).toHaveAttribute('href', '/lounge/conversations');
    expect(screen.getByRole('link', { name: /Reservations/i })).toHaveAttribute('href', '/lounge/bookings');
    expect(screen.getByText('Visitor timezone')).toBeInTheDocument();
    expect(screen.queryByText('Recommended timezone')).not.toBeInTheDocument();
    expect(screen.queryByText('Sort timezone')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reschedule meeting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy and mark paid proposal sent' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('uses the backend action mutations directly without the legacy page-level email fetches', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    render(
      <MemoryRouter initialEntries={['/lounge/requests/req-1']}>
        <Routes>
          <Route path="/lounge/requests/:requestId" element={<LoungeRequestDetail />} />
          <Route path="/lounge/bookings" element={<div data-testid="bookings-page" />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Start time for Visitor Name'), { target: { value: '2026-05-01T10:00' } });
    fireEvent.change(screen.getByLabelText('End time for Visitor Name'), { target: { value: '2026-05-01T10:30' } });

    fireEvent.click(screen.getByRole('button', { name: 'Reschedule meeting' }));

    await waitFor(() => {
      expect(counterMutateAsyncMock).toHaveBeenCalled();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts requests through the backend action mutation', async () => {
    render(
      <MemoryRouter initialEntries={['/lounge/requests/req-1']}>
        <Routes>
          <Route path="/lounge/requests/:requestId" element={<LoungeRequestDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Start time for Visitor Name'), { target: { value: '2026-05-01T10:00' } });
    fireEvent.change(screen.getByLabelText('End time for Visitor Name'), { target: { value: '2026-05-01T10:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(acceptMutateAsyncMock).toHaveBeenCalled();
    });
  });

  it('marks manual paid proposals through the backend action mutation', async () => {
    render(
      <MemoryRouter initialEntries={['/lounge/requests/req-1']}>
        <Routes>
          <Route path="/lounge/requests/:requestId" element={<LoungeRequestDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy and mark paid proposal sent' }));

    await waitFor(() => {
      expect(paidProposalMutateAsyncMock).toHaveBeenCalledWith({
        priceText: '50,000 KRW / 30 minutes',
        message: 'I can handle this as a paid consultation. If you want to proceed, reply with your preferred time and I will confirm the next step.',
      });
    });
  });

  it('calls decline mutation directly without legacy page-level email fetches', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    render(
      <MemoryRouter initialEntries={['/lounge/requests/req-1']}>
        <Routes>
          <Route path="/lounge/requests/:requestId" element={<LoungeRequestDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));

    await waitFor(() => {
      expect(declineMutateAsyncMock).toHaveBeenCalled();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('threads the configured backend selection and hides block actions on the remote surface', () => {
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('http://localhost:6650');
    usePersonalLinkRepositoryMock.mockReturnValue({ kind: 'remote' });

    render(
      <MemoryRouter initialEntries={['/lounge/requests/req-1']}>
        <Routes>
          <Route path="/lounge/requests/:requestId" element={<LoungeRequestDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(usePersonalLinkRepositoryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
    expect(useRequestDetailMock).toHaveBeenCalledWith('req-1', { apiUrl: 'http://localhost:6650' });
    expect(useFriendsMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
    expect(screen.getByText('Visitor block actions are currently hidden on this screen because they are not yet exposed in the remote backend lounge.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Block visitor' })).not.toBeInTheDocument();
  });
});
