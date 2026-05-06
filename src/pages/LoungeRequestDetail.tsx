import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Ban, CalendarClock, CheckCircle2, Clock3, Copy, ExternalLink, Mail, MessageSquareText, RadioTower, UserRound } from 'lucide-react';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useRequestDetail } from '@/features/personal-link/useRequestDetail';
import { useFriends } from '@/features/personal-link/useFriends';
import { useEffect, useState } from 'react';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { RequestDecisionPayload } from '@/features/personal-link/types';

const ANONYMOUS_GUEST_EMAIL = 'noreply@ponslink.app';

const getVisitorIdentityLabel = (visitorName: string, visitorEmail: string) => {
  const email = visitorEmail.trim();
  if (!email || email.toLowerCase() === ANONYMOUS_GUEST_EMAIL) {
    return visitorName.trim() || 'Guest';
  }

  return email;
};

const toDateTimeLocalValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getDefaultWindow = () => {
  const start = new Date();
  start.setMinutes(start.getMinutes() + 30);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);
  return {
    start: toDateTimeLocalValue(start),
    end: toDateTimeLocalValue(end),
  };
};

const toIsoDateTime = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getPreferredDateStatus = (preferredTimeNote: string, now = new Date()) => {
  const preferred = new Date(preferredTimeNote);

  if (!preferredTimeNote.trim() || Number.isNaN(preferred.getTime())) {
    return {
      label: 'No requested date',
      detail: `System date: ${now.toLocaleString()}`,
      expired: false,
    };
  }

  return {
    label: preferred.getTime() >= now.getTime() ? 'Requested date has not passed' : 'Requested date has passed',
    detail: `Requested: ${preferred.toLocaleString()} · System date: ${now.toLocaleString()}`,
    expired: preferred.getTime() < now.getTime(),
  };
};

const formatCountdown = (preferredTimeNote: string, now: Date) => {
  const preferred = new Date(preferredTimeNote);
  if (!preferredTimeNote.trim() || Number.isNaN(preferred.getTime())) {
    return 'No meeting time set';
  }

  const diff = preferred.getTime() - now.getTime();
  if (diff <= 0) {
    return '00:00:00';
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  return days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const useNow = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
};

const LoungeRequestDetail = () => {
  const { session } = useAuthSession();
  const { requestId = '' } = useParams();
  const navigate = useNavigate();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const { detail, accept, counter, paidProposal, decline } = useRequestDetail(requestId, repositorySelection);
  const { list, blockVisitorIdentity } = useFriends(repositorySelection);
  const defaultWindow = getDefaultWindow();
  const [start, setStart] = useState(defaultWindow.start);
  const [end, setEnd] = useState(defaultWindow.end);
  const [roomType, setRoomType] = useState<'audio-one-to-one' | 'video-one-to-one'>('video-one-to-one');
  const [priceText, setPriceText] = useState('50,000 KRW / 30 minutes');
  const [proposalMessage, setProposalMessage] = useState('I can handle this as a paid consultation. If you want to proceed, reply with your preferred time and I will confirm the next step.');
  const [message, setMessage] = useState('');

  const actionPending = accept.isPending || counter.isPending || paidProposal.isPending || decline.isPending || list.isPending || blockVisitorIdentity.isPending;
  const now = useNow();

  if (!session) return <Navigate to="/login" replace />;
  if (!detail.data) return <div className="p-6">Request not found.</div>;

  const request = detail.data;
  const isBlocked = (list.data ?? []).some((friend) => friend.friendUserId === `visitor:${request.visitorEmail.trim().toLowerCase()}` && friend.status === 'blocked');
  const showBlockActions = repository.kind !== 'remote';
  const visitorIdentity = getVisitorIdentityLabel(request.visitorName, request.visitorEmail);
  const preferredDateStatus = getPreferredDateStatus(request.preferredTimeNote, now);
  const isRegisteredVisitor = Boolean(request.senderUserId);
  const canUseTimeActions = request.status === 'pending';
  const canReschedule = canUseTimeActions && isRegisteredVisitor;

  const buildPayload = (): RequestDecisionPayload | null => {
    const proposedStartAt = toIsoDateTime(start);
    const proposedEndAt = toIsoDateTime(end);

    if (!proposedStartAt || !proposedEndAt || new Date(proposedStartAt).getTime() >= new Date(proposedEndAt).getTime()) {
      setMessage('Enter a valid meeting time.');
      return null;
    }

    setMessage('');
    return {
      proposedStartAt,
      proposedEndAt,
      roomType,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  };

  const handleCounter = () => {
    const payload = buildPayload();
    if (!payload) return;
    void counter.mutateAsync(payload).then(() => setMessage('Reschedule request sent to the visitor.'));
  };

  const handleAccept = () => {
    const payload = buildPayload();
    if (!payload) return;
    void accept.mutateAsync(payload).then(() => setMessage('Request accepted. The visitor room opens when the session window starts.'));
  };

  const handlePaidProposal = () => {
    const proposal = `Paid consultation proposal\nPrice: ${priceText}\n\n${proposalMessage}`;
    void navigator.clipboard?.writeText(proposal).catch(() => undefined);
    void paidProposal.mutateAsync({ priceText, message: proposalMessage }).then(() => setMessage('Paid consultation proposal marked and copied. Send it through your preferred channel.'));
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(30,99,255,0.12),_transparent_34%),radial-gradient(circle_at_80%_0%,_rgba(16,185,129,0.08),_transparent_28%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 rounded-full border border-border/70 bg-white px-4 py-3 shadow-[0_18px_55px_-45px_rgba(15,23,42,0.45)]">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-8 w-8" loading="eager" />
            <div>
              <p className="text-sm font-semibold">PonsLink</p>
              <p className="hidden text-xs text-muted-foreground sm:block">Request review and session prep</p>
            </div>
          </div>
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/lounge/conversations" className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-3 py-2 text-sm text-muted-foreground transition hover:border-[#1E63FF]/30 hover:text-[#1E63FF]">
            <MessageSquareText className="h-4 w-4" />
            Communication History
          </Link>
          <Link to="/lounge/bookings" className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white px-3 py-2 text-sm text-muted-foreground transition hover:border-[#1E63FF]/30 hover:text-[#1E63FF]">
            <RadioTower className="h-4 w-4" />
            Reservations
          </Link>
        </div>
        <section className="overflow-hidden rounded-[32px] border border-border/70 bg-white shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)]">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#1E63FF]/45 to-transparent" />
          <div className="space-y-6 p-6 lg:p-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#1E63FF]/20 bg-[#EAF1FF] px-3 py-1 text-xs font-medium text-[#1E63FF]">
                <MessageSquareText className="h-3.5 w-3.5" />
                Request detail
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#1E63FF] ring-1 ring-[#1E63FF]/20">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-semibold tracking-tight text-foreground">{request.visitorName}</h1>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1">
                        <Mail className="h-4 w-4" />
                        {visitorIdentity}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1">
                      <Clock3 className="h-4 w-4" />
                      {request.requestType} · {request.status} · {isRegisteredVisitor ? 'registered visitor' : 'guest visitor'}
                    </span>
                  </div>
                </div>
                </div>
                <div className="rounded-[28px] border border-border/70 bg-[#F8FAFC] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Visitor message</p>
                  <blockquote className="mt-3 border-l border-[#1E63FF]/30 pl-4 text-sm leading-7 text-foreground">{request.message}</blockquote>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-[#F8FAFC] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Preferred time</p>
                    <p className="mt-3 text-sm leading-6 text-foreground">{request.preferredTimeNote || 'The visitor did not leave a preferred time.'}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-[#F8FAFC] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Visitor timezone</p>
                    <p className="mt-3 text-sm leading-6 text-foreground">{request.visitorTimezone || 'Unknown'}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-[#F8FAFC] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Expires at</p>
                    <p className="mt-3 text-sm leading-6 text-foreground">{request.expiresAt ?? 'None'}</p>
                  </div>
                </div>
                <div className={`rounded-2xl border px-4 py-3 text-sm ${
                  preferredDateStatus.expired
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}>
                  <p className="font-medium">{preferredDateStatus.label}</p>
                  <p className="mt-1 text-xs opacity-80">{preferredDateStatus.detail}</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight">
                    Countdown: {formatCountdown(request.preferredTimeNote, now)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-border/70 bg-[#F8FAFC] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Actions</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">Meet or respond</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Open the visitor room, reset the time for registered visitors, or decline.</p>
                </div>
                {request.meetingAccess?.url ? (
                  <a
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1E63FF] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_35px_-20px_rgba(30,99,255,0.85)] transition hover:bg-[#174fd1]"
                    href={request.meetingAccess.url}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Join visitor room
                  </a>
                ) : null}
              </div>
              {!request.meetingAccess?.url ? (
                <p className="mt-4 inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                  Meeting access link is missing. Check backend connectivity or request creation fallback.
                </p>
              ) : null}
              {preferredDateStatus.expired ? (
                <p className="mt-4 inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                  Requested time has passed. Keep the visitor room link available and set a new session window if you respond.
                </p>
              ) : null}
              {isBlocked ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  This visitor is blocked.
                </div>
              ) : null}
              <div className="mt-4 grid gap-3 rounded-2xl border border-border/70 bg-white p-4 sm:grid-cols-3">
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Start</span>
                  <input aria-label={`Start time for ${request.visitorName}`} className="w-full rounded-xl border border-border/70 bg-[#F8FAFC] px-3 py-2 text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10 disabled:opacity-50" type="datetime-local" value={start} disabled={!canUseTimeActions || actionPending} onChange={(event) => setStart(event.target.value)} />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">End</span>
                  <input aria-label={`End time for ${request.visitorName}`} className="w-full rounded-xl border border-border/70 bg-[#F8FAFC] px-3 py-2 text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10 disabled:opacity-50" type="datetime-local" value={end} disabled={!canUseTimeActions || actionPending} onChange={(event) => setEnd(event.target.value)} />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Session type</span>
                  <select aria-label={`Session type for ${request.visitorName}`} className="w-full rounded-xl border border-border/70 bg-[#F8FAFC] px-3 py-2 text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10 disabled:opacity-50" value={roomType} disabled={!canUseTimeActions || actionPending} onChange={(event) => setRoomType(event.target.value as 'audio-one-to-one' | 'video-one-to-one')}>
                    <option value="video-one-to-one">1:1 Video</option>
                    <option value="audio-one-to-one">1:1 Audio</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#1E63FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#174fd1] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canUseTimeActions || actionPending}
                  onClick={handleAccept}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Accept
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 bg-white px-4 py-3 text-sm font-medium text-muted-foreground transition hover:text-[#1E63FF] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canReschedule || actionPending}
                  onClick={handleCounter}
                >
                  <CalendarClock className="h-4 w-4" />
                  Reschedule meeting
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 bg-white px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={actionPending}
                  onClick={() => void decline.mutateAsync(undefined).then(() => setMessage('Request declined.'))}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Decline
                </button>
                {showBlockActions ? (
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={actionPending}
                    onClick={() => void blockVisitorIdentity.mutateAsync({ email: request.visitorEmail, displayName: request.visitorName }).then(() => setMessage('Visitor blocked. New requests from them will be prevented.'))}
                  >
                    <Ban className="h-4 w-4" />
                    Block visitor
                  </button>
                ) : (
                  <p className="inline-flex items-center text-sm text-muted-foreground">
                    Visitor block actions are currently hidden on this screen because they are not yet exposed in the remote backend lounge.
                  </p>
                )}
              </div>
              {!isRegisteredVisitor ? (
                <p className="mt-4 rounded-xl border border-border/70 bg-white px-3 py-2 text-xs leading-5 text-muted-foreground">
                  Guest visitors can only send a meeting request, so PonsLink cannot email them a reschedule request.
                </p>
              ) : null}
              <div className="mt-4 rounded-2xl border border-border/70 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Manual paid proposal</p>
                <p className="mt-1 text-sm text-muted-foreground">Phase 2 keeps payment manual: copy this proposal, send it to the visitor, and track the request as paid proposal sent.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted-foreground">Price</span>
                    <input className="w-full rounded-xl border border-border/70 bg-[#F8FAFC] px-3 py-2 text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10 disabled:opacity-50" value={priceText} disabled={!canUseTimeActions || actionPending} onChange={(event) => setPriceText(event.target.value)} />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted-foreground">Proposal message</span>
                    <textarea className="min-h-24 w-full rounded-xl border border-border/70 bg-[#F8FAFC] px-3 py-2 text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10 disabled:opacity-50" value={proposalMessage} disabled={!canUseTimeActions || actionPending} onChange={(event) => setProposalMessage(event.target.value)} />
                  </label>
                </div>
                <button
                  className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#1E63FF]/20 bg-[#EAF1FF] px-4 py-3 text-sm font-semibold text-[#1E63FF] transition hover:bg-[#dbe8ff] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canUseTimeActions || actionPending}
                  onClick={handlePaidProposal}
                >
                  <Copy className="h-4 w-4" />
                  Copy and mark paid proposal sent
                </button>
              </div>
              {message ? <p className="mt-4 rounded-2xl border border-[#1E63FF]/20 bg-[#EAF1FF] px-4 py-3 text-sm text-[#174fd1]">{message}</p> : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoungeRequestDetail;
