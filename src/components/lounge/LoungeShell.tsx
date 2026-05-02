import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  Home,
  Inbox,
  LogOut,
  MailCheck,
  MessageSquareText,
  UserRound,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthSession } from '@/features/personal-link/useAuthSession';

const getInitials = (value: string) => value.trim().slice(0, 2).toUpperCase() || 'PL';

const primaryNav = [
  { to: '/lounge', label: 'Lounge', mobileLabel: 'Home', icon: Home, match: (path: string) => path === '/lounge' },
  { to: '/lounge/requests', label: 'Requests', mobileLabel: 'Inbox', icon: Inbox, badgeKey: 'requests', match: (path: string) => path.startsWith('/lounge/requests') },
  { to: '/lounge/bookings', label: 'Reservations', mobileLabel: 'Calendar', icon: CalendarDays, badgeKey: 'bookings', match: (path: string) => path.startsWith('/lounge/bookings') },
  { to: '/lounge/conversations', label: 'Communication History', mobileLabel: 'History', icon: MessageSquareText, badgeKey: 'conversations', match: (path: string) => path.startsWith('/lounge/conversations') },
  { to: '/lounge/aliases', label: 'Alias Management', mobileLabel: 'Aliases', icon: UserRound, match: (path: string) => path.startsWith('/lounge/aliases') },
  { to: '/lounge/profile', label: 'Profile', mobileLabel: 'Profile', icon: UserRound, match: (path: string) => path.startsWith('/lounge/profile') },
  { to: '/lounge/friends', label: 'Friends', mobileLabel: 'Contacts', icon: Users, badgeKey: 'friends', match: (path: string) => path.startsWith('/lounge/friends') },
  { to: '/lounge/email-deliveries', label: 'Email guidance', mobileLabel: 'Email', icon: MailCheck, match: (path: string) => path.startsWith('/lounge/email-deliveries') },
] as const;

interface LoungeShellProps {
  children: ReactNode;
  contentClassName?: string;
  badges?: Partial<Record<'requests' | 'bookings' | 'conversations' | 'friends', number>>;
}

const LoungeShell = ({ children, contentClassName, badges: badgeOverrides }: LoungeShellProps) => {
  const location = useLocation();
  const { session, logout } = useAuthSession();
  const displayName = session?.displayName || 'Guest';
  const image = session?.avatarUrl || '';
  const badges = {
    requests: badgeOverrides?.requests ?? 0,
    bookings: badgeOverrides?.bookings ?? 0,
    conversations: badgeOverrides?.conversations ?? 0,
    friends: badgeOverrides?.friends ?? 0,
  };

  return (
    <div className="min-h-screen bg-[#09090d] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),transparent_35%),radial-gradient(circle_at_18%_0%,rgba(20,184,166,0.12),transparent_28%),radial-gradient(circle_at_90%_8%,rgba(244,114,182,0.08),transparent_24%)]" />
      <div className="relative flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-white/[0.08] bg-[#0f1014]/95 px-4 py-5 lg:flex lg:flex-col">
          <Link to="/lounge" className="mb-7 flex items-center">
            <img src="/logo.svg" alt="PonsLink" className="h-8 w-auto" loading="eager" />
          </Link>

          <div className="mb-5 flex items-center gap-3 border-b border-white/[0.08] pb-5">
            {image ? (
              <img src={image} alt={displayName} className="h-10 w-10 rounded-lg object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-sm font-semibold">
                {getInitials(displayName)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" title={displayName}>Account</p>
              <p className="truncate text-xs text-zinc-500">Personal link workspace</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Lounge primary navigation">
            {primaryNav.map(({ to, label, icon: Icon, badgeKey, match }) => {
              const isActive = match(location.pathname);
              const badge = badgeKey ? badges[badgeKey] : 0;
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={cn(
                    'group flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition',
                    isActive
                      ? 'bg-white text-[#101114] shadow-[0_14px_40px_-28px_rgba(255,255,255,0.95)]'
                      : 'text-zinc-500 hover:bg-white/[0.06] hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {badge > 0 ? (
                    <span className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                      isActive ? 'bg-[#101114] text-white' : 'bg-teal-400 text-[#07100f]',
                    )}>
                      {badge}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-white/[0.08] pt-4">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-white/[0.06] hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          <div className={cn('mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-10 lg:py-8', contentClassName)}>
            {children}
          </div>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0f1014]/95 px-2 py-2 shadow-[0_-20px_60px_-45px_rgba(0,0,0,0.95)] backdrop-blur lg:hidden"
        aria-label="Lounge mobile navigation"
      >
        <div className="flex gap-1 overflow-x-auto">
          {primaryNav.map(({ to, label, mobileLabel, icon: Icon, badgeKey, match }) => {
            const isActive = match(location.pathname);
            const badge = badgeKey ? badges[badgeKey] : 0;
            return (
              <NavLink
                key={to}
                to={to}
                aria-label={mobileLabel}
                className={cn(
                  'relative flex min-w-[76px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] transition',
                  isActive ? 'bg-white text-[#101114]' : 'text-zinc-500 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="max-w-full truncate">{mobileLabel}</span>
                {badge > 0 ? (
                  <span className="absolute right-2 top-1 h-1.5 w-1.5 rounded-full bg-teal-400" />
                ) : null}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default LoungeShell;
