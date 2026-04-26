import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicProfile from './PublicProfile';
import { localRepository } from '@/features/personal-link/localRepository';

const renderPublicProfile = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/u/host-name']}>
        <Routes>
          <Route path="/u/:slug" element={<PublicProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('PublicProfile remote repository integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('defaults to the local backend surface when the public api url is missing', async () => {
    vi.stubEnv('VITE_API_URL', undefined as unknown as string);

    const localGetPublicProfileBySlug = vi.spyOn(localRepository, 'getPublicProfileBySlug');
    const localCreateRequest = vi.spyOn(localRepository, 'createRequest');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderPublicProfile();

    expect(await screen.findByText('Link not found.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:6650/api/public-aliases/host-name', undefined);
    expect(localGetPublicProfileBySlug).not.toHaveBeenCalled();
    expect(localCreateRequest).not.toHaveBeenCalled();
  });

  it('defaults to the local backend surface when the public api url is empty', async () => {
    vi.stubEnv('VITE_API_URL', '   ');

    const localGetPublicProfileBySlug = vi.spyOn(localRepository, 'getPublicProfileBySlug');
    const localCreateRequest = vi.spyOn(localRepository, 'createRequest');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderPublicProfile();

    expect(await screen.findByText('Link not found.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:6650/api/public-aliases/host-name', undefined);
    expect(localGetPublicProfileBySlug).not.toHaveBeenCalled();
    expect(localCreateRequest).not.toHaveBeenCalled();
  });

  it('shows link not found only for a confirmed remote 404', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:6650');

    const localGetPublicProfileBySlug = vi.spyOn(localRepository, 'getPublicProfileBySlug');
    const localCreateRequest = vi.spyOn(localRepository, 'createRequest');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderPublicProfile();

    expect(await screen.findByText('Link not found.')).toBeInTheDocument();
    expect(
      screen.queryByText(/We couldn't load this public profile right now\./i),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:6650/api/public-aliases/host-name', undefined);
    expect(localGetPublicProfileBySlug).not.toHaveBeenCalled();
    expect(localCreateRequest).not.toHaveBeenCalled();
  });

  it('shows an unavailable state when the remote profile request fails upstream', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:6650');

    const localGetPublicProfileBySlug = vi.spyOn(localRepository, 'getPublicProfileBySlug');
    const localCreateRequest = vi.spyOn(localRepository, 'createRequest');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Server exploded' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderPublicProfile();

    expect(await screen.findByText(/Public profile unavailable\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/We couldn't load this public profile right now\./i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Link not found.')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:6650/api/public-aliases/host-name', undefined);
    expect(localGetPublicProfileBySlug).not.toHaveBeenCalled();
    expect(localCreateRequest).not.toHaveBeenCalled();
  });

  it('shows an unavailable state when the remote profile request fails on the network', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:6650');

    const localGetPublicProfileBySlug = vi.spyOn(localRepository, 'getPublicProfileBySlug');
    const localCreateRequest = vi.spyOn(localRepository, 'createRequest');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Failed to fetch'));

    renderPublicProfile();

    expect(await screen.findByText(/Public profile unavailable\./i)).toBeInTheDocument();
    expect(
      screen.getByText(/We couldn't load this public profile right now\./i),
    ).toBeInTheDocument();
    expect(screen.queryByText('Link not found.')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:6650/api/public-aliases/host-name', undefined);
    expect(localGetPublicProfileBySlug).not.toHaveBeenCalled();
    expect(localCreateRequest).not.toHaveBeenCalled();
  });

  it('uses the remote repository path for the live public route flow', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:6650');
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Asia/Seoul' }),
    } as Intl.DateTimeFormat);

    const localGetPublicProfileBySlug = vi.spyOn(localRepository, 'getPublicProfileBySlug');
    const localCreateRequest = vi.spyOn(localRepository, 'createRequest');

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);

      if (url === 'http://localhost:6650/api/public-aliases/host-name' && init === undefined) {
        return new Response(JSON.stringify({ alias: 'host-name', status: 'active' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === 'http://localhost:6650/api/public-aliases/host-name/requests') {
        return new Response(JSON.stringify({
          alias: 'host-name',
          conversationId: 'conversation-1',
          requestId: 'request-1',
          visitorName: 'Visitor Name',
          visitorEmail: 'visitor@example.com',
          visitorTimezone: 'Asia/Seoul',
          requestType: 'general',
          message: 'I would like to discuss a collaboration this week.',
          preferredTime: '',
          status: 'submitted',
          createdAt: '2026-04-22T00:00:00.000Z',
          updatedAt: '2026-04-22T00:00:00.000Z',
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch call: ${url}`);
    });

    renderPublicProfile();

    const sendMessageButton = await screen.findByRole('button', { name: /send message/i });
    fireEvent.click(sendMessageButton);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Visitor Name' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'visitor@example.com' } });
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'I would like to discuss a collaboration this week.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add timing details/i }));
    fireEvent.click(screen.getByRole('button', { name: /send request/i }));

    await waitFor(() => {
      expect(screen.getByText(/Request sent\./i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:6650/api/public-aliases/host-name', undefined);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:6650/api/public-aliases/host-name/requests',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorName: 'Visitor Name',
          visitorEmail: 'visitor@example.com',
          visitorTimezone: 'Asia/Seoul',
          deliveryMode: 'mediated',
          requestType: 'general',
          message: 'I would like to discuss a collaboration this week.',
        }),
      }),
    );
    expect(localGetPublicProfileBySlug).not.toHaveBeenCalled();
    expect(localCreateRequest).not.toHaveBeenCalled();
  });
});
