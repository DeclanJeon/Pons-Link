import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  MessageSquareText,
  Share2,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import LoungeShell from '@/components/lounge/LoungeShell';
import { usePrevious } from '@/hooks/usePrevious';
import { useDashboard } from '@/features/personal-link/useDashboard';
import { useDeleteRequest } from '@/features/personal-link/useRequests';
import { useFrontDeskSummary } from '@/features/personal-link/useFrontDeskSummary';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/backendSurface';

const eventLabels: Record<string, string> = {
  meeting_request_received: 'New meeting request',
  meeting_request_sent: 'Request sent',
  meeting_request_accepted: 'Meeting accepted',
  meeting_request_declined: 'Meeting declined',
  meeting_time_counter_proposed: 'New time proposed',
};

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const LoungeSimple = () => {
  const dashboard = useDashboard();
  const { session } = dashboard;
  const [copied, setCopied] = useState(false);
  const [, setCalendarAuthorized] = useState(false);
  const [hiddenRequestActivityIds, setHiddenRequestActivityIds] = useState<Set<string>>(() => new Set());
  const personalLinkApiUrl = getConfiguredPersonalLinkApiUrl();
  const frontDeskSummary = useFrontDeskSummary({ apiUrl: personalLinkApiUrl });
  const deleteRequest = useDeleteRequest(personalLinkApiUrl);

  const localProfile = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const pub = JSON.parse(window.localStorage.getItem('ponslink:personal-link:public-profile') || 'null');
      const acc = JSON.parse(window.localStorage.getItem('ponslink:personal-link:account-profile') || 'null');
      return { publicProfile: pub, accountProfile: acc };
    } catch {
      return null;
    }
  }, []);

  const hasLocalSlug = Boolean(localProfile?.publicProfile?.slug);
  const pendingCount = dashboard.requests.data?.length ?? 0;
  const prevPendingCount = usePrevious(pendingCount);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar_connected') === '1') {
      setCalendarAuthorized(true);
      window.history.replaceState({}, '', '/lounge');
    }
  }, []);

  useEffect(() => {
    if (prevPendingCount !== undefined && pendingCount > prevPendingCount) {
      toast.info(`New request received. ${pendingCount} pending.`);
    }
  }, [pendingCount, prevPendingCount]);

  if (!session && !hasLocalSlug) return <Navigate to="/login" replace />;

  const slug = dashboard.slug || localProfile?.publicProfile?.slug || '';
  const profileLink = slug ? `${window.location.origin}/room/${slug}` : '';
  const displayName = dashboard.displayName || localProfile?.accountProfile?.displayName || localProfile?.publicProfile?.slug || 'Guest';
  const headline = dashboard.headline || localProfile?.publicProfile?.headline || 'Requests and meetings in one place.';
  const nextRequest = dashboard.recentRequests[0];
  const nextBooking = dashboard.upcomingBookings[0];
  const visibleRecentEvents = dashboard.recentEvents.filter((event) => (
    !event.requestId || !hiddenRequestActivityIds.has(event.requestId)
  ));
  const activeMetric = pendingCount > 0
    ? { label: 'Pending requests', value: pendingCount, href: '/lounge/requests' }
    : { label: 'Upcoming meetings', value: dashboard.upcomingBookings.length, href: '/lounge/bookings' };
  const summary = frontDeskSummary.data;
  const frontDeskStats = [
    {
      label: 'New today',
      value: summary?.todayNewRequests ?? 0,
      href: '/lounge/requests',
    },
    {
      label: 'Needs follow-up',
      value: summary?.needsFollowUp ?? pendingCount,
      href: '/lounge/requests',
    },
    {
      label: 'Paid proposals',
      value: summary?.paidProposalSent ?? 0,
      href: '/lounge/requests',
    },
    {
      label: 'Upcoming sessions',
      value: summary?.upcomingReservations ?? dashboard.upcomingBookings.length,
      href: '/lounge/bookings',
    },
  ];

  const copyLink = async () => {
    if (!profileLink) return;
    await navigator.clipboard.writeText(profileLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    if (!profileLink) return;
    if (navigator.share) {
      await navigator.share({ title: 'My PonsLink', url: profileLink });
    } else {
      await copyLink();
    }
  };

  const removeRequestActivity = async (requestId: string) => {
    const confirmed = window.confirm('Delete this request from your lounge activity?');
    if (!confirmed) return;

    try {
      await deleteRequest.mutateAsync(requestId);
      setHiddenRequestActivityIds((current) => new Set(current).add(requestId));
      toast.success('Request removed from your lounge.');
    } catch {
      toast.error('Could not delete this request. Please try again.');
    }
  };

  return (
    <LoungeShell
      badges={{
        requests: pendingCount,
        bookings: dashboard.upcomingBookings.length,
        conversations: dashboard.conversations.counts.total,
        friends: dashboard.friends.list.data?.length ?? 0,
      }}
    >
          <div className="flex w-full flex-col gap-8">
            <header className="flex flex-col gap-5 border-b border-[#E5E7EB] pb-7 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E63FF]">Lounge</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
                  {displayName}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">{headline}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {slug ? (
                  <Link
                    to={`/room/${slug}`}
                    className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#1E63FF] px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(30,99,255,0.22)] transition hover:bg-[#174fd1]"
                  >
                    Open room
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    to="/lounge/profile"
                    className="inline-flex h-10 items-center rounded-[10px] bg-[#1E63FF] px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(30,99,255,0.22)] transition hover:bg-[#174fd1]"
                  >
                    Set up link
                  </Link>
                )}
              </div>
            </header>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-[#111827]">Your public link</h2>
                      <p className="mt-1 text-xs text-[#6B7280]">Visitors use this link to request a meeting.</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => void copyLink()}
                        disabled={!profileLink}
                        title="Copy"
                        className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#6B7280] transition hover:bg-[#EEF5FF] hover:text-[#1E63FF] disabled:opacity-40"
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => void shareLink()}
                        disabled={!profileLink}
                        title="Share"
                        className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#6B7280] transition hover:bg-[#EEF5FF] hover:text-[#1E63FF] disabled:opacity-40"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex min-h-11 items-center gap-3 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3">
                    <span className={`h-2 w-2 rounded-full ${profileLink ? 'bg-[#10B981]' : 'bg-[#9CA3AF]'}`} />
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-[#111827]">
                      {profileLink || 'Complete your profile to create a link'}
                    </span>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Link
                    to={activeMetric.href}
                    className="group rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition hover:border-[#BCD4FF]"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6B7280]">Needs attention</p>
                    <div className="mt-3 flex items-end justify-between gap-4">
                      <p className="text-5xl font-bold tracking-tight text-[#111827]">{activeMetric.value}</p>
                      <ArrowRight className="mb-2 h-5 w-5 text-[#6B7280] transition group-hover:translate-x-1 group-hover:text-[#1E63FF]" />
                    </div>
                    <p className="mt-2 text-sm text-[#6B7280]">{activeMetric.label}</p>
                  </Link>

                  <Link
                    to="/lounge/aliases"
                    className="group rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition hover:border-[#BCD4FF]"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6B7280]">Identifiers</p>
                    <div className="mt-3 flex items-end justify-between gap-4">
                      <p className="text-5xl font-bold tracking-tight text-[#111827]">{dashboard.aliases.items.length}</p>
                      <ArrowRight className="mb-2 h-5 w-5 text-[#6B7280] transition group-hover:translate-x-1 group-hover:text-[#1E63FF]" />
                    </div>
                    <p className="mt-2 text-sm text-[#6B7280]">Alias Management</p>
                  </Link>
                </div>

                <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E63FF]">Front desk summary</p>
                      <h2 className="mt-1 text-sm font-semibold text-[#111827]">Request gate health</h2>
                    </div>
                    {frontDeskSummary.isError ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">Using local counts</span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {frontDeskStats.map((item) => (
                      <Link
                        key={item.label}
                        to={item.href}
                        className="group rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-4 transition hover:border-[#BCD4FF]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-[#6B7280]">{item.label}</p>
                          <ArrowRight className="h-3.5 w-3.5 text-[#6B7280] transition group-hover:translate-x-1 group-hover:text-[#1E63FF]" />
                        </div>
                        <p className="mt-3 text-3xl font-bold tracking-tight text-[#111827]">{item.value}</p>
                      </Link>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#6B7280]">
                    Read-only counts from existing requests and reservations. Paid email automation stays manual until real paid-intent data exists.
                  </p>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#111827]">Next request</h2>
                    <Link to="/lounge/requests" className="text-xs font-medium text-[#6B7280] transition hover:text-[#1E63FF]">View all</Link>
                  </div>
                  {nextRequest ? (
                    <Link
                      to={`/lounge/requests/${nextRequest.id}`}
                      className="group flex items-center gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition hover:border-[#BCD4FF]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5FF]">
                        <MessageSquareText className="h-4 w-4 text-[#1E63FF]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#111827]">{nextRequest.visitorName || 'Visitor'}</p>
                        <p className="mt-1 truncate text-xs text-[#6B7280]">{nextRequest.preferredTimeNote || nextRequest.message}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#6B7280] transition group-hover:translate-x-1 group-hover:text-[#1E63FF]" />
                    </Link>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-5 text-sm text-[#6B7280]">
                      No pending requests.
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[#111827]">Next meeting</h2>
                    <Link to="/lounge/bookings" className="text-xs font-medium text-[#6B7280] transition hover:text-[#1E63FF]">View all</Link>
                  </div>
                  {nextBooking ? (
                    <Link
                      to={`/lounge/bookings/${nextBooking.id}`}
                      className="group flex items-center gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition hover:border-[#BCD4FF]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF5FF]">
                        <CalendarDays className="h-4 w-4 text-[#1E63FF]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#111827]">{nextBooking.guestDisplayName || 'Guest'}</p>
                        <p className="mt-1 truncate text-xs text-[#6B7280]">{formatDateTime(nextBooking.scheduledStartAt)}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-[#6B7280] transition group-hover:translate-x-1 group-hover:text-[#1E63FF]" />
                    </Link>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white p-5 text-sm text-[#6B7280]">
                      No confirmed meetings.
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-6 lg:border-l lg:border-[#E5E7EB] lg:pl-6">
                <section>
                  <h2 className="text-sm font-semibold text-[#111827]">Meeting activity</h2>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                    {visibleRecentEvents.length > 0 ? (
                      visibleRecentEvents.map((event) => (
                        <div
                          key={event.id}
                          className="group flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3 last:border-b-0"
                        >
                          <Link
                            to={event.bookingId ? `/lounge/bookings/${event.bookingId}` : event.requestId ? `/lounge/requests/${event.requestId}` : '/lounge/requests'}
                            className="min-w-0 flex-1"
                          >
                            <p className="truncate text-sm font-medium text-[#111827] transition group-hover:text-[#1E63FF]">{eventLabels[event.eventType] ?? 'Meeting update'}</p>
                            <p className="mt-1 text-xs text-[#6B7280]">{formatDateTime(event.createdAt)}</p>
                          </Link>
                          <div className="flex shrink-0 items-center gap-1">
                            {event.requestId ? (
                              <button
                                type="button"
                                title="Delete request"
                                aria-label="Delete request from meeting activity"
                                disabled={deleteRequest.isPending}
                                onClick={() => void removeRequestActivity(event.requestId as string)}
                                className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#6B7280] transition hover:bg-red-50 hover:text-[#EF4444] disabled:pointer-events-none disabled:opacity-40"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                            <ArrowRight className="h-4 w-4 text-[#6B7280] transition group-hover:translate-x-1 group-hover:text-[#1E63FF]" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="p-4 text-sm text-[#6B7280]">No meeting updates yet.</p>
                    )}
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-[#111827]">Quick actions</h2>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                    <Link to="/lounge/conversations" className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 text-sm font-medium text-[#6B7280] transition hover:text-[#1E63FF]">
                      <span>Communication History</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link to="/lounge/profile" className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 text-sm font-medium text-[#6B7280] transition hover:text-[#1E63FF]">
                      <span>Room settings</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link to="/lounge/aliases" className="flex items-center justify-between px-4 py-3 text-sm font-medium text-[#6B7280] transition hover:text-[#1E63FF]">
                      <span>Alias Management</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </section>
              </aside>
            </section>
          </div>
    </LoungeShell>
  );
};

export default LoungeSimple;
