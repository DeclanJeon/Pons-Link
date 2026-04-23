import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  LogOut,
  MessageSquareText,
  Share2,
  UserRound,
  Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState, useEffect } from 'react';
import { useDashboard } from '@/features/personal-link/useDashboard';

const navItems = [
  { to: '/lounge/conversations', label: 'Communication History', icon: MessageSquareText },
  { to: '/lounge/requests', label: 'Requests', icon: MessageSquareText },
  { to: '/lounge/bookings', label: 'Reservations', icon: CalendarDays },
  { to: '/lounge/aliases', label: 'Alias Management', icon: UserRound },
  { to: '/lounge/friends', label: 'Friends', icon: Users },
  { to: '/lounge/profile', label: 'Profile', icon: UserRound },
];

const Lounge = () => {
  const dashboard = useDashboard();
  const { session, logout } = dashboard;

  const [copied, setCopied] = useState(false);
  const [calendarAuthorized, setCalendarAuthorized] = useState<boolean | null>(null);
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

  useEffect(() => {
    if (!apiUrl) return;
    fetch(`${apiUrl}/api/calendar/status`)
      .then((r) => r.json())
      .then((d: { authorized: boolean }) => setCalendarAuthorized(d.authorized))
      .catch(() => setCalendarAuthorized(false));
  }, [apiUrl]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar_connected') === '1') {
      setCalendarAuthorized(true);
      window.history.replaceState({}, '', '/lounge');
    }
  }, []);

  if (!session) return <Navigate to="/login" replace />;

  const { slug, displayName, image, headline, profileLink } = dashboard;

  const copyLink = async () => {
    await navigator.clipboard.writeText(profileLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'My PonsLink', url: profileLink });
    } else {
      await copyLink();
    }
  };

  const connectCalendar = async () => {
    if (!apiUrl) return;
    const res = await fetch(`${apiUrl}/api/calendar/auth`);
    const data = await res.json() as { url: string };
    window.open(data.url, '_blank');
  };

  const statVisuals = {
    Conversations: { icon: MessageSquareText, color: 'text-violet-400', bg: 'bg-violet-500/[0.08]', border: 'border-violet-500/[0.12]' },
    'Pending Requests': { icon: MessageSquareText, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/[0.08]', border: 'border-fuchsia-500/[0.12]' },
    Reservations: { icon: CalendarDays, color: 'text-emerald-400', bg: 'bg-emerald-500/[0.08]', border: 'border-emerald-500/[0.12]' },
    Aliases: { icon: UserRound, color: 'text-cyan-400', bg: 'bg-cyan-500/[0.08]', border: 'border-cyan-500/[0.12]' },
    Friends: { icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/[0.08]', border: 'border-sky-500/[0.12]' },
  } as const;

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808] text-white">

      {/* Sidebar */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-white/[0.07] bg-[#0C0C0C]">

        {/* Logo header */}
        <div className="relative flex h-16 shrink-0 flex-col justify-end">
          {/* Top gradient line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
          <div className="flex items-center px-4 pb-3.5">
            <img
              src="/logo.svg"
              alt="PonsLink"
              className="h-8 w-auto opacity-95 drop-shadow-[0_8px_20px_rgba(99,102,241,0.14)]"
              loading="eager"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
        </div>

        {/* Profile mini */}
        <div className="relative px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            {image ? (
              <img src={image} alt={displayName} className="h-7 w-7 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-xs font-bold text-indigo-300">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-white">{displayName}</p>
              <p className="truncate text-[10px] text-zinc-600">Personal Lounge</p>
            </div>
          </div>
          <div className="absolute inset-x-3 bottom-0 h-px bg-white/[0.05]" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <p className="mb-1.5 px-2 text-[10px] uppercase tracking-[0.15em] text-zinc-700">Menu</p>
          <div className="flex flex-col gap-0.5">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-zinc-500 transition hover:bg-white/[0.05] hover:text-white"
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Calendar connect */}
        {apiUrl !== undefined && (
          <div className="relative shrink-0 px-3 py-2">
            <div className="absolute inset-x-3 top-0 h-px bg-white/[0.05]" />
            {calendarAuthorized ? (
              <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Calendar linked
              </div>
            ) : (
              <button
                onClick={() => void connectCalendar()}
                className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-[11px] text-zinc-600 transition hover:bg-white/[0.04] hover:text-zinc-300"
              >
                + Connect Calendar
              </button>
            )}
          </div>
        )}

        {/* Bottom */}
        <div className="relative shrink-0 px-3 py-3">
          <div className="absolute inset-x-3 top-0 h-px bg-white/[0.05]" />
          <button
            onClick={logout}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm text-zinc-600 transition hover:bg-white/[0.05] hover:text-zinc-300"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">

        {/* Top bar */}
        <header className="relative flex h-16 shrink-0 items-center justify-between px-6">
          {/* Top gradient line matching sidebar */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-transparent" />
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Dashboard</h2>
            <span className="text-zinc-700">/</span>
            <span className="text-sm text-zinc-500">Conversation command center</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-400">Link active</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
        </header>

        {/* Bento grid */}
        <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-3 overflow-hidden p-4">

          {/* Profile + Link + Stats — col 1-2, row 1 */}
          <div className="col-span-2 flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-indigo-500/[0.1] via-transparent to-transparent p-6">
            <div className="flex items-center gap-4">
              {image ? (
                <img src={image} alt={displayName} className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-sm font-bold text-indigo-300 ring-1 ring-indigo-500/20">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600">Active Link</p>
                <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-white">{displayName}</h1>
                <p className="truncate text-xs text-zinc-500">{headline}</p>
              </div>
              {slug && (
                <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
                  <Link
                    to={`/u/${slug}`}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/15 hover:text-white"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open request page
                  </Link>
                  <p className="text-[10px] text-zinc-600">이 페이지에서 방문자가 Request를 보내고 이메일을 받습니다.</p>
                </div>
              )}
            </div>

            {slug ? (
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-3">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="flex-1 truncate font-mono text-xs text-zinc-400">{profileLink}</span>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => void copyLink()} title="Copy" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/[0.06] text-zinc-600 transition hover:border-indigo-500/30 hover:text-indigo-400">
                      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <button onClick={() => void shareLink()} title="Share" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/[0.06] text-zinc-600 transition hover:border-indigo-500/30 hover:text-indigo-400">
                      <Share2 className="h-3 w-3" />
                    </button>
                    <Link to={`/u/${slug}`} target="_blank" rel="noopener noreferrer" title="Open" className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] text-zinc-600 transition hover:border-indigo-500/30 hover:text-indigo-400">
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
                <div className="mt-3 flex justify-center">
                  <div className="rounded-lg bg-white p-1.5">
                    <QRCodeSVG value={profileLink} size={72} />
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-indigo-500/15 bg-indigo-500/[0.06] px-3 py-2.5 text-xs text-zinc-400">
                  <p className="font-medium text-indigo-300">Request / 이메일 테스트 진입점</p>
                  <p className="mt-1 leading-5 text-zinc-500">
                    이 링크를 열면 방문자 입장에서 request를 작성하고, 수락 후 이메일·캘린더·콜 링크 흐름까지 확인할 수 있습니다.
                  </p>
                  <Link
                    to={`/u/${slug}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-300 transition hover:text-white"
                  >
                    Open public request page
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-700" />
                <span className="flex-1 truncate text-xs text-zinc-600">Complete onboarding to generate your link</span>
                <Link to="/lounge/profile" className="shrink-0 cursor-pointer text-xs text-indigo-400 transition hover:text-indigo-300">Set up →</Link>
              </div>
            )}

            <div className="mt-auto grid grid-cols-5 gap-3 pt-5">
              {dashboard.stats.map(({ label, value }) => {
                const visual = statVisuals[label as keyof typeof statVisuals];
                const Icon = visual.icon;
                return (
                  <div
                    key={label}
                    className={`flex flex-col justify-between rounded-xl border ${visual.border} ${visual.bg} p-4`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">{label}</span>
                      <Icon className={`h-4 w-4 ${visual.color}`} />
                    </div>
                    <p className="mt-4 text-4xl font-bold tracking-[-0.04em] text-white">{value}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Links — col 3, row 1-2 */}
          <div className="row-span-2 flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0D0D0D] p-4">
            <p className="mb-3 text-[10px] uppercase tracking-[0.15em] text-zinc-700">Quick Access</p>
            <div className="flex flex-1 flex-col gap-2.5">
              {navItems.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="group flex flex-1 cursor-pointer flex-col justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/[0.12] hover:bg-white/[0.05]"
                >
                  <div className="flex items-start justify-between">
                    <div className="rounded-lg bg-white/[0.06] p-2">
                      <Icon className="h-4 w-4 text-zinc-400" />
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-800 transition group-hover:text-zinc-500" />
                  </div>
                  <p className="mt-auto text-sm font-medium text-zinc-300 transition group-hover:text-white">{label}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Conversations — col 1, row 2 */}
          <div className="col-start-1 row-start-2 flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0D0D0D] p-4">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-700">Recent Conversations</p>
              <MessageSquareText className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div className="flex flex-1 flex-col justify-around gap-2 overflow-hidden">
              {dashboard.recentConversations.length > 0 ? (
                dashboard.recentConversations.slice(0, 3).map((item) => (
                  <Link key={item.id} to={item.href} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 transition hover:border-white/[0.12] hover:bg-white/[0.05]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-zinc-200">{item.title}</p>
                      <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-400">
                        {item.statusLabel}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-zinc-600">{item.summary}</p>
                  </Link>
                ))
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <MessageSquareText className="h-7 w-7 text-zinc-800" />
                  <p className="mt-2 text-xs text-zinc-700">No conversation history yet</p>
                </div>
              )}
            </div>
            <Link
              to="/lounge/conversations"
              className="mt-3 shrink-0 rounded-lg border border-white/[0.05] py-1.5 text-center text-[10px] text-zinc-600 transition hover:border-white/[0.1] hover:text-zinc-400"
            >
              View all
            </Link>
          </div>

          {/* Reservations — col 2, row 2 */}
          <div className="col-start-2 row-start-2 flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0D0D0D] p-4">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.15em] text-zinc-700">Reservations</p>
              <CalendarDays className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="flex flex-1 flex-col justify-around gap-2 overflow-hidden">
              {dashboard.upcomingBookings.length > 0 ? (
                dashboard.upcomingBookings.map((booking) => (
                  <Link key={booking.id} to={`/lounge/bookings/${booking.id}`} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 transition hover:border-white/[0.12] hover:bg-white/[0.05]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-zinc-200">{booking.guestDisplayName}</p>
                      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">confirmed</span>
                    </div>
                    {booking.scheduledStartAt && (
                      <p className="mt-0.5 text-[10px] text-zinc-600">
                        {new Date(booking.scheduledStartAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </Link>
                ))
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <CalendarDays className="h-7 w-7 text-zinc-800" />
                  <p className="mt-2 text-xs text-zinc-700">No confirmed reservations</p>
                </div>
              )}
            </div>
            <Link
              to="/lounge/bookings"
              className="mt-3 shrink-0 rounded-lg border border-white/[0.05] py-1.5 text-center text-[10px] text-zinc-600 transition hover:border-white/[0.1] hover:text-zinc-400"
            >
              View all
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Lounge;
