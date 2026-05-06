import { Navigate, Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, Inbox, MessageSquareText } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import LoungeShell from '@/components/lounge/LoungeShell';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useRequests, useExpireRequests } from '@/features/personal-link/useRequests';
import { useEffect, useState } from 'react';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { ContactRequest, RequestDecisionPayload } from '@/features/personal-link/types';

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

const ANONYMOUS_GUEST_EMAIL = 'noreply@ponslink.app';

const getVisitorIdentityLabel = (visitorName: string, visitorEmail: string) => {
  const email = visitorEmail.trim();
  if (!email || email.toLowerCase() === ANONYMOUS_GUEST_EMAIL) {
    return visitorName.trim() || 'Guest';
  }

  return email;
};

const LoungeRequestCard = ({
  request,
  repositorySelection,
}: {
  request: ContactRequest;
  repositorySelection?: { apiUrl: string };
}) => {
  const defaultWindow = getDefaultWindow();
  const repository = usePersonalLinkRepository(repositorySelection);
  const queryClient = useQueryClient();
  const [start, setStart] = useState(defaultWindow.start);
  const [end, setEnd] = useState(defaultWindow.end);
  const [roomType, setRoomType] = useState<'audio-one-to-one' | 'video-one-to-one'>('video-one-to-one');
  const [message, setMessage] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'requests'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'bookings'] });
    void queryClient.invalidateQueries({ queryKey: ['personal-link', 'email-deliveries'] });
  };
  const accept = useMutation({
    mutationFn: (payload: RequestDecisionPayload) => repository.acceptRequest(request.id, payload),
    onSuccess: invalidate,
  });
  const counter = useMutation({
    mutationFn: (payload: RequestDecisionPayload) => repository.counterProposeRequest(request.id, payload),
    onSuccess: invalidate,
  });
  const decline = useMutation({
    mutationFn: () => repository.declineRequest(request.id),
    onSuccess: invalidate,
  });

  const now = useNow();
  const actionPending = accept.isPending || counter.isPending || decline.isPending;
  const canAct = request.status === 'pending';
  const preferredDateStatus = getPreferredDateStatus(request.preferredTimeNote, now);
  const canUseTimeActions = canAct;
  const isRegisteredVisitor = Boolean(request.senderUserId);
  const canReschedule = canUseTimeActions && isRegisteredVisitor;
  const visitorIdentity = getVisitorIdentityLabel(request.visitorName, request.visitorEmail);

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

  const handleAccept = () => {
    const payload = buildPayload();
    if (!payload) return;
    void accept.mutateAsync(payload).then(() => setMessage('Request accepted. The visitor status link will open the meeting when it is time.'));
  };

  const handleCounter = () => {
    const payload = buildPayload();
    if (!payload) return;
    void counter.mutateAsync(payload).then(() => setMessage('Reschedule request sent to the visitor.'));
  };

  return (
    <article className="group overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-[0_22px_70px_-52px_rgba(15,23,42,0.55)] transition duration-300 hover:-translate-y-0.5 hover:border-[#1E63FF]/30 hover:shadow-[0_30px_90px_-55px_rgba(30,99,255,0.42)]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1E63FF]">{request.requestType} request</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{request.visitorName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{visitorIdentity}</p>
            </div>
            {request.meetingAccess?.url ? (
              <a
                className="inline-flex w-fit items-center gap-2 rounded-full bg-[#1E63FF] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_35px_-20px_rgba(30,99,255,0.85)] transition hover:bg-[#174fd1]"
                href={request.meetingAccess.url}
              >
                Join visitor room <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                Meeting access link is missing. Check backend connectivity or request creation fallback.
              </span>
            )}
          </div>
          <blockquote className="border-l border-[#1E63FF]/30 pl-4 text-sm leading-7 text-foreground">
            {request.message}
          </blockquote>
          {request.preferredTimeNote ? (
            <p className="text-sm text-muted-foreground">Preferred: {request.preferredTimeNote}</p>
          ) : null}
          <div className={`rounded-2xl border px-3 py-2 text-sm ${
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
          {preferredDateStatus.expired ? (
            <p className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
              Requested time has passed. Keep the visitor room link available and set a new session window if you accept.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex w-fit rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-sm text-muted-foreground">
              {request.requestType} · {request.status} · {isRegisteredVisitor ? 'registered visitor' : 'guest visitor'}
            </span>
            {request.expiresAt ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-[#F8FAFC] px-3 py-1 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4" />
                Expires {request.expiresAt}
              </span>
            ) : null}
          </div>
          <Link to={`/lounge/requests/${request.id}`} className="inline-flex text-sm font-medium text-[#1E63FF] transition hover:text-[#174fd1] hover:underline">
            Details
          </Link>
        </div>

        <div className="space-y-3 border-t border-border bg-[#F8FAFC] p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Response</p>
            <p className="mt-1 text-sm text-muted-foreground">Set a session window only if you accept or reschedule.</p>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Start</span>
            <input aria-label={`Start time for ${request.visitorName}`} className="w-full rounded-xl border border-border/70 bg-white px-3 py-2 text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10 disabled:opacity-50" type="datetime-local" value={start} disabled={!canUseTimeActions || actionPending} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">End</span>
            <input aria-label={`End time for ${request.visitorName}`} className="w-full rounded-xl border border-border/70 bg-white px-3 py-2 text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10 disabled:opacity-50" type="datetime-local" value={end} disabled={!canUseTimeActions || actionPending} onChange={(event) => setEnd(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Session type</span>
            <select aria-label={`Session type for ${request.visitorName}`} className="w-full rounded-xl border border-border/70 bg-white px-3 py-2 text-foreground outline-none transition focus:border-[#1E63FF]/40 focus:ring-4 focus:ring-[#1E63FF]/10 disabled:opacity-50" value={roomType} disabled={!canUseTimeActions || actionPending} onChange={(event) => setRoomType(event.target.value as 'audio-one-to-one' | 'video-one-to-one')}>
              <option value="video-one-to-one">1:1 Video</option>
              <option value="audio-one-to-one">1:1 Audio</option>
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#1E63FF] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#174fd1] disabled:cursor-not-allowed disabled:opacity-50" disabled={!canUseTimeActions || actionPending} onClick={handleAccept} type="button">
              <CheckCircle2 className="h-4 w-4" /> Accept
            </button>
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border/70 bg-white px-3 py-2 text-sm font-medium text-muted-foreground transition hover:text-[#1E63FF] disabled:cursor-not-allowed disabled:opacity-50" disabled={!canReschedule || actionPending} onClick={handleCounter} type="button">
              <CalendarClock className="h-4 w-4" /> Reschedule
            </button>
            <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border/70 bg-white px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canAct || actionPending} onClick={() => void decline.mutateAsync().then(() => setMessage('Request declined.'))} type="button">
              <AlertTriangle className="h-4 w-4" /> Decline
            </button>
          </div>
          {!isRegisteredVisitor ? (
            <p className="rounded-xl border border-border/70 bg-white px-3 py-2 text-xs leading-5 text-muted-foreground">
              Guest visitors can only send a meeting request, so PonsLink cannot email them a reschedule request.
            </p>
          ) : null}
          {message ? <p className="rounded-xl border border-[#1E63FF]/20 bg-[#EAF1FF] px-3 py-2 text-sm text-[#174fd1]">{message}</p> : null}
        </div>
      </div>
    </article>
  );
};

const LoungeRequests = () => {
  const { session } = useAuthSession();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const requests = useRequests(undefined, repositorySelection);
  const expireRequests = useExpireRequests(apiUrl);

  useEffect(() => {
    if (repository.kind === 'remote') {
      return;
    }

    void expireRequests.mutateAsync();
  }, [expireRequests, repository.kind]);

  if (!session) return <Navigate to="/login" replace />;

  return (
    <LoungeShell badges={{ requests: (requests.data ?? []).length }}>
        <section className="overflow-hidden rounded-lg border border-border/70 bg-white shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)]">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[#1E63FF]/45 to-transparent" />
          <div className="p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#1E63FF]/20 bg-[#EAF1FF] px-3 py-1 text-xs font-medium text-[#1E63FF]">
                <Inbox className="h-3.5 w-3.5" />
                Request inbox
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground">Meeting requests</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Review the visitor, requested time, live room link, and response options from one queue.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-[#F8FAFC] px-5 py-4">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Total</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{(requests.data ?? []).length}</p>
            </div>
          </div>
          </div>
        </section>

        {(requests.data ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#1E63FF]">
              <MessageSquareText className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-semibold">No requests yet</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Share your public link so visitors can leave their purpose and preferred time.</p>
          </div>
        ) : (
          <section className="grid gap-4">
            {(requests.data ?? []).map((request) => (
              <LoungeRequestCard key={request.id} request={request} repositorySelection={repositorySelection} />
            ))}
          </section>
        )}
    </LoungeShell>
  );
};

export default LoungeRequests;
