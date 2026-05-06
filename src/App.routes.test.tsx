import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./lib/analytics', () => ({
  analytics: {
    init: vi.fn(),
    page: vi.fn(),
  },
}));

vi.mock('./stores/useFullscreenStore', () => ({
  useFullscreenStore: () => vi.fn(),
}));

vi.mock('@/components/CookieConsent', () => ({ default: () => null }));
vi.mock('@/components/ui/toaster', () => ({ Toaster: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/ui/tooltip', () => ({ TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

vi.mock('./pages/Marketing', () => ({ default: () => <div data-testid="marketing-page">Marketing</div> }));
vi.mock('./pages/Landing', () => ({ default: () => <div data-testid="landing-page">Landing</div> }));
vi.mock('./pages/Login', () => ({ default: () => <div data-testid="login-page">Login</div> }));
vi.mock('./pages/Onboarding', () => ({ default: () => <div data-testid="onboarding-page">Onboarding</div> }));
vi.mock('./pages/LoungeOnboarding', () => ({ default: () => <div data-testid="lounge-onboarding-page">Lounge onboarding</div> }));
vi.mock('./pages/SelfUnderstandingHome', () => ({ default: () => <div data-testid="home-page">Home</div> }));
vi.mock('./pages/MyProfile', () => ({ default: () => <div data-testid="my-profile-page">My profile</div> }));
vi.mock('./pages/MyTraits', () => ({ default: () => <div data-testid="my-traits-page">My traits</div> }));
vi.mock('./pages/MyRelationships', () => ({ default: () => <div data-testid="my-relationships-page">My relationships</div> }));
vi.mock('./pages/MyGrowth', () => ({ default: () => <div data-testid="my-growth-page">My growth</div> }));
vi.mock('./pages/Archive', () => ({ default: () => <div data-testid="archive-page">Archive</div> }));
vi.mock('./pages/MySettings', () => ({ default: () => <div data-testid="my-settings-page">My settings</div> }));
vi.mock('./pages/Lounge', () => ({ default: () => <div data-testid="lounge-page">Lounge</div> }));
vi.mock('./pages/LoungeConversations', () => ({ default: () => <div data-testid="lounge-conversations-page">Lounge conversations</div> }));
vi.mock('./pages/LoungeAliases', () => ({ default: () => <div data-testid="lounge-aliases-page">Lounge aliases</div> }));
vi.mock('./pages/LoungeProfile', () => ({ default: () => <div data-testid="lounge-profile-page">Lounge profile</div> }));
vi.mock('./pages/LoungeFriends', () => ({ default: () => <div data-testid="lounge-friends-page">Lounge friends</div> }));
vi.mock('./pages/LoungeRequests', () => ({ default: () => <div data-testid="lounge-requests-page">Lounge requests</div> }));
vi.mock('./pages/LoungeRequestDetail', () => ({ default: () => <div data-testid="lounge-request-detail-page">Lounge request detail</div> }));
vi.mock('./pages/LoungeBookings', () => ({ default: () => <div data-testid="lounge-bookings-page">Lounge bookings</div> }));
vi.mock('./pages/LoungeBookingDetail', () => ({ default: () => <div data-testid="lounge-booking-detail-page">Lounge booking detail</div> }));
vi.mock('./pages/LoungeEmailDeliveries', () => ({ default: () => <div data-testid="lounge-email-deliveries-page">Lounge email deliveries</div> }));
vi.mock('./pages/SessionAccess', () => ({ default: () => <div data-testid="session-access-page">Session access</div> }));
vi.mock('./pages/RequestAction', () => ({ default: () => <div data-testid="request-action-page">Request action</div> }));
vi.mock('./pages/Lobby', () => ({ default: () => <div data-testid="lobby-page">Lobby</div> }));
vi.mock('./pages/Room', () => ({ default: () => <div data-testid="room-page">Room</div> }));
vi.mock('./pages/UserRoom', () => ({ default: () => <div data-testid="user-room-page">User room</div> }));
vi.mock('./pages/NotFound', () => ({ default: () => <div data-testid="not-found-page">Not found</div> }));

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

describe('App public room routes', () => {
  it('opens the personal room directly at /room/:slug', async () => {
    renderAt('/room/declan');

    expect(await screen.findByTestId('user-room-page')).toBeInTheDocument();
  });

  it('opens reservation join URLs at /join/:roomTitle', async () => {
    renderAt('/join/reservation-1?token=participant-token');

    expect(await screen.findByTestId('room-page')).toBeInTheDocument();
  });

  it('does not keep the legacy /u/:slug public profile route in the product IA', async () => {
    renderAt('/u/declan');

    expect(await screen.findByTestId('not-found-page')).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/u/declan'));
    expect(screen.queryByTestId('user-room-page')).not.toBeInTheDocument();
  });

  it('does not show the global language switcher outside the marketing page', async () => {
    renderAt('/login');

    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /language/i })).not.toBeInTheDocument();
  });
});
