import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RequestAction from './RequestAction';

const usePersonalLinkRepositoryMock = vi.fn();
const acceptRequestByActionTokenMock = vi.fn();
const proposeTimeByActionTokenMock = vi.fn();
const requestDirectCallByActionTokenMock = vi.fn();

vi.mock('@/features/personal-link/usePersonalLinkRepository', () => ({
  getConfiguredPersonalLinkApiUrl: () => 'http://localhost:6650',
  usePersonalLinkRepository: (...args: unknown[]) => usePersonalLinkRepositoryMock(...args),
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
    acceptRequestByActionTokenMock.mockReset();
    proposeTimeByActionTokenMock.mockReset();
    requestDirectCallByActionTokenMock.mockReset();
    usePersonalLinkRepositoryMock.mockReturnValue({
      kind: 'remote',
      acceptRequestByActionToken: acceptRequestByActionTokenMock,
      proposeTimeByActionToken: proposeTimeByActionTokenMock,
      requestDirectCallByActionToken: requestDirectCallByActionTokenMock,
    });
  });

  it('accepts an emailed meeting request with the public action token', async () => {
    acceptRequestByActionTokenMock.mockResolvedValue({
      bookingId: 'booking-1',
      roomTitle: 'Session with Maya',
      joinPath: '/join/booking-1?token=join-token',
    });

    renderAction('/request-actions/accept?token=accept-token');

    await waitFor(() => {
      expect(acceptRequestByActionTokenMock).toHaveBeenCalledWith('accept-token', expect.objectContaining({
        roomType: 'video-one-to-one',
        timezone: expect.any(String),
      }));
    });
    expect(await screen.findByText('Meeting accepted')).toBeInTheDocument();
    expect(screen.getByText('Session with Maya')).toBeInTheDocument();
  });

  it('lets the recipient propose another time from the emailed action link', async () => {
    proposeTimeByActionTokenMock.mockResolvedValue({
      bookingId: 'booking-2',
      roomTitle: 'Proposed time for Maya',
    });

    renderAction('/request-actions/propose-time?token=propose-token');

    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '2026-05-01T10:00' } });
    fireEvent.change(screen.getByLabelText('End time'), { target: { value: '2026-05-01T10:30' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Can we meet 30 minutes later?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send proposed time' }));

    await waitFor(() => {
      expect(proposeTimeByActionTokenMock).toHaveBeenCalledWith('propose-token', expect.objectContaining({
        proposedStartAt: '2026-05-01T10:00',
        proposedEndAt: '2026-05-01T10:30',
        message: 'Can we meet 30 minutes later?',
        roomType: 'video-one-to-one',
      }));
    });
    expect(await screen.findByText('Proposed time sent')).toBeInTheDocument();
  });

  it('queues a direct call request without requiring login', async () => {
    requestDirectCallByActionTokenMock.mockResolvedValue({
      requestId: 'request-1',
      callRequestId: 'call-1',
      status: 'queued',
      loungeUrl: '/lounge/requests/request-1',
    });

    renderAction('/request-actions/direct-call?token=call-token');

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Are you available now?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Call now' }));

    await waitFor(() => {
      expect(requestDirectCallByActionTokenMock).toHaveBeenCalledWith('call-token', 'Are you available now?');
    });
    expect(await screen.findByText('Call request queued')).toBeInTheDocument();
  });

  it('shows a recovery message when the token is missing', async () => {
    renderAction('/request-actions/accept');

    expect(await screen.findByText('This request link is missing its action token.')).toBeInTheDocument();
    expect(acceptRequestByActionTokenMock).not.toHaveBeenCalled();
  });
});
