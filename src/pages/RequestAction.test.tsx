import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/features/personal-link/apiClient';
import RequestAction from './RequestAction';

const acceptResetMock = vi.fn();
const proposeResetMock = vi.fn();
const directCallResetMock = vi.fn();
const declineResetMock = vi.fn();
const acceptMutateMock = vi.fn();
const proposeMutateMock = vi.fn();
const directCallMutateMock = vi.fn();
const declineMutateMock = vi.fn();

type MutationState<TData = unknown> = {
  status: 'idle' | 'pending' | 'success' | 'error';
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  data?: TData;
  error?: unknown;
  mutate: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
};

const createMutationState = <TData,>(overrides: Partial<MutationState<TData>> = {}): MutationState<TData> => ({
  status: 'idle',
  isPending: false,
  isSuccess: false,
  isError: false,
  mutate: vi.fn(),
  reset: vi.fn(),
  ...overrides,
});

const useRequestActionMock = vi.fn();

vi.mock('@/features/personal-link/usePersonalLinkRepository', () => ({
  getConfiguredPersonalLinkApiUrl: () => 'http://localhost:6650',
}));

vi.mock('@/features/personal-link/useRequestAction', () => ({
  useRequestAction: (...args: unknown[]) => useRequestActionMock(...args),
}));

const renderAction = (path: string) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/request-actions/:action" element={<RequestAction />} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('RequestAction', () => {
  beforeEach(() => {
    acceptResetMock.mockReset();
    proposeResetMock.mockReset();
    directCallResetMock.mockReset();
    declineResetMock.mockReset();
    acceptMutateMock.mockReset();
    proposeMutateMock.mockReset();
    directCallMutateMock.mockReset();
    declineMutateMock.mockReset();
    useRequestActionMock.mockReturnValue({
      accept: createMutationState({ mutate: acceptMutateMock, reset: acceptResetMock }),
      proposeTime: createMutationState({ mutate: proposeMutateMock, reset: proposeResetMock }),
      directCall: createMutationState({ mutate: directCallMutateMock, reset: directCallResetMock }),
      decline: createMutationState({ mutate: declineMutateMock, reset: declineResetMock }),
    });
  });

  it('submits an emailed meeting request with the public action token', async () => {
    renderAction('/request-actions/accept?token=accept-token');

    await waitFor(() => {
      expect(acceptMutateMock).toHaveBeenCalledWith({
        token: 'accept-token',
      }, expect.any(Object));
    });
  });

  it('renders the accepted meeting summary from the action mutation state', async () => {
    useRequestActionMock.mockReturnValue({
      accept: createMutationState({
        status: 'success',
        isSuccess: true,
        data: {
          id: 'booking-1',
          requestId: 'request-1',
          hostUserId: 'host-1',
          guestDisplayName: 'Maya',
          guestEmail: 'maya@example.com',
          roomType: 'video-one-to-one',
          scheduledStartAt: '2026-05-01T10:00:00.000Z',
          scheduledEndAt: '2026-05-01T10:30:00.000Z',
          timezone: 'Asia/Seoul',
          status: 'confirmed',
          createdAt: '2026-05-01T09:00:00.000Z',
          updatedAt: '2026-05-01T09:00:00.000Z',
        },
        mutate: acceptMutateMock,
        reset: acceptResetMock,
      }),
      proposeTime: createMutationState({ mutate: proposeMutateMock, reset: proposeResetMock }),
      directCall: createMutationState({ mutate: directCallMutateMock, reset: directCallResetMock }),
      decline: createMutationState({ mutate: declineMutateMock, reset: declineResetMock }),
    });

    renderAction('/request-actions/accept?token=accept-token');

    expect(await screen.findByText('Meeting accepted')).toBeInTheDocument();
    expect(screen.getByText(/Scheduled for/)).toBeInTheDocument();
  });

  it('lets the recipient propose another time from the emailed action link', async () => {
    renderAction('/request-actions/propose-time?token=propose-token');

    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '2026-05-01T10:00' } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '2026-05-01T10:30' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Can we meet 30 minutes later?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send proposed time' }));

    await waitFor(() => {
      expect(proposeMutateMock).toHaveBeenCalledWith({
        token: 'propose-token',
        payload: expect.objectContaining({
          proposedStartAt: '2026-05-01T10:00',
          proposedEndAt: '2026-05-01T10:30',
          message: 'Can we meet 30 minutes later?',
          roomType: 'video-one-to-one',
        }),
      });
    });
  });

  it('queues a direct call request without requiring login', async () => {
    renderAction('/request-actions/direct-call?token=call-token');

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Are you available now?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request live call' }));

    await waitFor(() => {
      expect(directCallMutateMock).toHaveBeenCalledWith({
        token: 'call-token',
        message: 'Are you available now?',
      });
    });
  });

  it('shows a recovery message when the token is missing', async () => {
    renderAction('/request-actions/accept');

    expect(await screen.findByText('This request link is missing its action token.')).toBeInTheDocument();
    expect(acceptMutateMock).not.toHaveBeenCalled();
  });

  it('does not show retry for expired accept links', async () => {
    useRequestActionMock.mockReturnValue({
      accept: createMutationState({
        status: 'error',
        isError: true,
        error: new ApiClientError(410, { error: 'expired' }),
        mutate: acceptMutateMock,
        reset: acceptResetMock,
      }),
      proposeTime: createMutationState({ mutate: proposeMutateMock, reset: proposeResetMock }),
      directCall: createMutationState({ mutate: directCallMutateMock, reset: directCallResetMock }),
      decline: createMutationState({ mutate: declineMutateMock, reset: declineResetMock }),
    });

    renderAction('/request-actions/accept?token=accept-token');

    expect(await screen.findByText('This request link has expired or was already used.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows retry for transient accept failures', async () => {
    useRequestActionMock.mockReturnValue({
      accept: createMutationState({
        status: 'error',
        isError: true,
        error: new Error('Temporary failure'),
        mutate: acceptMutateMock,
        reset: acceptResetMock,
      }),
      proposeTime: createMutationState({ mutate: proposeMutateMock, reset: proposeResetMock }),
      directCall: createMutationState({ mutate: directCallMutateMock, reset: directCallResetMock }),
      decline: createMutationState({ mutate: declineMutateMock, reset: declineResetMock }),
    });

    renderAction('/request-actions/accept?token=accept-token');

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(acceptResetMock).toHaveBeenCalled();
    expect(acceptMutateMock).toHaveBeenCalledTimes(1);
  });

  it('does not trigger a proposed time mutation when token is missing', async () => {
    useRequestActionMock.mockReturnValue({
      accept: createMutationState({ mutate: acceptMutateMock, reset: acceptResetMock }),
      proposeTime: createMutationState({ mutate: proposeMutateMock, reset: proposeResetMock }),
      directCall: createMutationState({ mutate: directCallMutateMock, reset: directCallResetMock }),
      decline: createMutationState({ mutate: declineMutateMock, reset: declineResetMock }),
    });

    renderAction('/request-actions/propose-time');

    expect(await screen.findByText('This request link is missing its action token.')).toBeInTheDocument();
    expect(proposeMutateMock).not.toHaveBeenCalled();
  });

  it('disables proposed time submit button while pending', async () => {
    useRequestActionMock.mockReturnValue({
      accept: createMutationState({ mutate: acceptMutateMock, reset: acceptResetMock }),
      proposeTime: createMutationState({
        status: 'pending',
        isPending: true,
        isSuccess: false,
        mutate: proposeMutateMock,
        reset: proposeResetMock,
      }),
      directCall: createMutationState({ mutate: directCallMutateMock, reset: directCallResetMock }),
      decline: createMutationState({ mutate: declineMutateMock, reset: declineResetMock }),
    });

    renderAction('/request-actions/propose-time?token=propose-token');

    const pendingButton = await screen.findByRole('button', { name: 'Sending...' });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(proposeMutateMock).not.toHaveBeenCalled();
  });

  it('does not trigger a direct-call mutation when token is missing', async () => {
    useRequestActionMock.mockReturnValue({
      accept: createMutationState({ mutate: acceptMutateMock, reset: acceptResetMock }),
      proposeTime: createMutationState({ mutate: proposeMutateMock, reset: proposeResetMock }),
      directCall: createMutationState({ mutate: directCallMutateMock, reset: directCallResetMock }),
      decline: createMutationState({ mutate: declineMutateMock, reset: declineResetMock }),
    });

    renderAction('/request-actions/direct-call');

    expect(await screen.findByText('This request link is missing its action token.')).toBeInTheDocument();
    expect(directCallMutateMock).not.toHaveBeenCalled();
  });

  it('disables proposed time submit button after success', async () => {
    useRequestActionMock.mockReturnValue({
      accept: createMutationState({ mutate: acceptMutateMock, reset: acceptResetMock }),
      proposeTime: createMutationState({
        status: 'success',
        isPending: false,
        isSuccess: true,
        mutate: proposeMutateMock,
        reset: proposeResetMock,
      }),
      directCall: createMutationState({ mutate: directCallMutateMock, reset: directCallResetMock }),
      decline: createMutationState({ mutate: declineMutateMock, reset: declineResetMock }),
    });

    renderAction('/request-actions/propose-time?token=propose-token');

    const successButton = await screen.findByRole('button', { name: 'Send proposed time' });
    expect(successButton).toBeDisabled();
    fireEvent.click(successButton);
    expect(proposeMutateMock).not.toHaveBeenCalled();
  });

  it('disables direct call submit button while pending', async () => {
    useRequestActionMock.mockReturnValue({
      accept: createMutationState({ mutate: acceptMutateMock, reset: acceptResetMock }),
      proposeTime: createMutationState({ mutate: proposeMutateMock, reset: proposeResetMock }),
      directCall: createMutationState({
        status: 'pending',
        isPending: true,
        isSuccess: false,
        mutate: directCallMutateMock,
        reset: directCallResetMock,
      }),
    });

    renderAction('/request-actions/direct-call?token=call-token');

    const pendingButton = await screen.findByRole('button', { name: 'Sending...' });
    expect(pendingButton).toBeDisabled();
    fireEvent.click(pendingButton);
    expect(directCallMutateMock).not.toHaveBeenCalled();
  });

  it('disables direct call submit button after success', async () => {
    useRequestActionMock.mockReturnValue({
      accept: createMutationState({ mutate: acceptMutateMock, reset: acceptResetMock }),
      proposeTime: createMutationState({ mutate: proposeMutateMock, reset: proposeResetMock }),
      directCall: createMutationState({
        status: 'success',
        isPending: false,
        isSuccess: true,
        mutate: directCallMutateMock,
        reset: directCallResetMock,
      }),
    });

    renderAction('/request-actions/direct-call?token=call-token');

    const successButton = await screen.findByRole('button', { name: 'Request live call' });
    expect(successButton).toBeDisabled();
    fireEvent.click(successButton);
    expect(directCallMutateMock).not.toHaveBeenCalled();
  });
});
