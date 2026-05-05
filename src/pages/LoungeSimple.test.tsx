import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoungeSimple from './LoungeSimple';

const useDashboardMock = vi.fn();
const useFrontDeskSummaryMock = vi.fn();
const useDeleteRequestMock = vi.fn();
const getConfiguredPersonalLinkApiUrlMock = vi.fn();

vi.mock('@/components/lounge/LoungeShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/features/personal-link/useDashboard', () => ({
  useDashboard: () => useDashboardMock(),
}));

vi.mock('@/features/personal-link/useFrontDeskSummary', () => ({
  useFrontDeskSummary: (...args: unknown[]) => useFrontDeskSummaryMock(...args),
}));

vi.mock('@/features/personal-link/useRequests', () => ({
  useDeleteRequest: (...args: unknown[]) => useDeleteRequestMock(...args),
}));

vi.mock('@/features/personal-link/backendSurface', () => ({
  getConfiguredPersonalLinkApiUrl: () => getConfiguredPersonalLinkApiUrlMock(),
}));

const renderLounge = () => render(
  <MemoryRouter>
    <LoungeSimple />
  </MemoryRouter>,
);

describe('LoungeSimple', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfiguredPersonalLinkApiUrlMock.mockReturnValue('http://localhost:6650');
    useDeleteRequestMock.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    useFrontDeskSummaryMock.mockReturnValue({
      data: {
        todayNewRequests: 3,
        pendingRequests: 2,
        counterProposedRequests: 1,
        paidProposalSent: 1,
        acceptedRequests: 4,
        upcomingReservations: 2,
        needsFollowUp: 4,
        primaryDeskLink: '/room/declan',
      },
      isError: false,
    });
    useDashboardMock.mockReturnValue({
      session: {
        userId: 'host-1',
        providerSubject: 'google-oauth2|host-1',
        email: 'host@example.com',
        displayName: 'Declan',
        loggedInAt: '2026-05-04T00:00:00.000Z',
      },
      slug: 'declan',
      displayName: 'Declan',
      image: '',
      headline: 'Requests and meetings in one place.',
      requests: { data: [{ id: 'req-1', visitorName: 'Maya', preferredTimeNote: 'Tomorrow', message: 'Portfolio review' }] },
      upcomingBookings: [{ id: 'booking-1', guestDisplayName: 'Maya', scheduledStartAt: '2026-06-01T10:00:00.000Z' }],
      recentRequests: [{ id: 'req-1', visitorName: 'Maya', preferredTimeNote: 'Tomorrow', message: 'Portfolio review' }],
      recentEvents: [],
      conversations: { counts: { total: 0 } },
      friends: { list: { data: [] } },
      aliases: { items: [{ id: 'alias-1' }] },
    });
  });

  it('renders the read-only front desk summary from the configured backend', () => {
    renderLounge();

    expect(useFrontDeskSummaryMock).toHaveBeenCalledWith({ apiUrl: 'http://localhost:6650' });
    expect(screen.getByText('Front desk summary')).toBeInTheDocument();
    expect(screen.getByText('Request gate health')).toBeInTheDocument();
    expect(screen.getByText('New today')).toBeInTheDocument();
    expect(screen.getByText('Needs follow-up')).toBeInTheDocument();
    expect(screen.getByText('Paid proposals')).toBeInTheDocument();
    expect(screen.getByText('Upcoming sessions')).toBeInTheDocument();
    expect(screen.getByText(/Paid email automation stays manual/)).toBeInTheDocument();
  });

  it('falls back to local dashboard counts when the summary endpoint is unavailable', () => {
    useFrontDeskSummaryMock.mockReturnValue({ data: undefined, isError: true });

    renderLounge();

    expect(screen.getByText('Using local counts')).toBeInTheDocument();
    expect(screen.getByText('Needs follow-up')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});
