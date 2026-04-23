import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicProfile from './PublicProfile';

const mutateAsync = vi.fn();
const usePublicProfileMock = vi.fn();
const sendEmailNotificationMock = vi.fn();

vi.mock('@/features/personal-link/usePublicProfile', () => ({
  usePublicProfile: (...args: unknown[]) => usePublicProfileMock(...args),
}));

vi.mock('@/features/personal-link/useCreateRequest', () => ({
  useCreateRequest: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/features/personal-link/emailNotifications', () => ({
  sendEmailNotification: (...args: unknown[]) => sendEmailNotificationMock(...args),
}));

describe('PublicProfile floating request widget', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mutateAsync.mockReset();
    sendEmailNotificationMock.mockReset();
    mutateAsync.mockResolvedValue({ id: 'req-1' });
    sendEmailNotificationMock.mockResolvedValue({ status: 'sent' });
    usePublicProfileMock.mockReturnValue({
      isLoading: false,
      data: {
        slug: 'host-name',
        displayName: 'PonsLink Host',
        headline: 'test headline',
        bio: 'test bio',
        profileVisibility: 'public',
        responsePolicy: 'approve_before_booking',
        allowGeneralRequest: true,
        allowScheduleRequest: true,
        allowMentoringRequest: true,
        allowCollabRequest: true,
        hostEmail: 'host@example.com',
      },
    });
  });

  it('opens a simplified floating composer with advanced options hidden by default', () => {
    render(
      <MemoryRouter initialEntries={['/u/host-name']}>
        <Routes>
          <Route path="/u/:slug" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Send message' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(screen.getByRole('heading', { name: 'Send message' })).toBeInTheDocument();
    expect(screen.getByText(/PonsLink mediates follow-up notifications/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Request type' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Choose request type/i }));

    expect(screen.getByRole('combobox', { name: 'Request type' })).toBeInTheDocument();
  });

  it('respects paused and private link operations states', () => {
    usePublicProfileMock.mockReturnValue({
      isLoading: false,
      data: {
        slug: 'host-name',
        displayName: 'PonsLink Host',
        headline: 'test headline',
        bio: 'test bio',
        profileVisibility: 'private',
        responsePolicy: 'paused',
        allowGeneralRequest: true,
        allowScheduleRequest: true,
        allowMentoringRequest: true,
        allowCollabRequest: true,
        hostEmail: 'host@example.com',
      },
    });

    render(
      <MemoryRouter initialEntries={['/u/host-name']}>
        <Routes>
          <Route path="/u/:slug" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/This link is private/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send message/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Open composer/i)).not.toBeInTheDocument();
  });

  it('submits the visitor timezone with the request payload', async () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'America/New_York' }),
    } as Intl.DateTimeFormat);

    render(
      <MemoryRouter initialEntries={['/u/host-name']}>
        <Routes>
          <Route path="/u/:slug" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /send message/i }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Visitor Name' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'visitor@example.com' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'I would like to discuss a collaboration this week.' } });
    fireEvent.click(screen.getByRole('button', { name: /add timing details/i }));
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });

    expect(mutateAsync.mock.calls[0][0]).toMatchObject({
      hostSlug: 'host-name',
      visitorName: 'Visitor Name',
      visitorEmail: 'visitor@example.com',
      visitorTimezone: 'America/New_York',
      deliveryMode: 'mediated',
    });
  });
});
