import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Ban, CalendarClock, CheckCircle2, Clock3, Mail, MessageSquareText, RadioTower, UserRound } from 'lucide-react';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useRequestDetail } from '@/features/personal-link/useRequestDetail';
import { useFriends } from '@/features/personal-link/useFriends';
import { useState } from 'react';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { RequestDecisionPayload } from '@/features/personal-link/types';

const LoungeRequestDetail = () => {
  const { session } = useAuthSession();
  const { requestId = '' } = useParams();
  const navigate = useNavigate();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const { detail, accept, counter, decline } = useRequestDetail(requestId, repositorySelection);
  const { list, blockVisitorIdentity } = useFriends(repositorySelection);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [roomType, setRoomType] = useState<'audio-one-to-one' | 'video-one-to-one'>('audio-one-to-one');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const actionPending = accept.isPending || counter.isPending || decline.isPending || list.isPending;

  const parseDecisionDateTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString();
  };

  const buildDecisionPayload = (): RequestDecisionPayload | null => {
    const proposedStartAt = parseDecisionDateTime(start);
    const proposedEndAt = parseDecisionDateTime(end);

    if (!proposedStartAt || !proposedEndAt) {
      setErrorMessage('Start and end time are required.');
      return null;
    }

    if (new Date(proposedStartAt).getTime() >= new Date(proposedEndAt).getTime()) {
      setErrorMessage('End time must be after start time.');
      return null;
    }

    setErrorMessage('');
    return {
      proposedStartAt,
      proposedEndAt,
      roomType,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  };

  if (!session) return <Navigate to="/login" replace />;
  if (!detail.data) return <div className="p-6">Request not found.</div>;

  const request = detail.data;
  const isBlocked = (list.data ?? []).some((friend) => friend.friendUserId === `visitor:${request.visitorEmail.trim().toLowerCase()}` && friend.status === 'blocked');
  const canAct = !isBlocked;

  const handleAccept = () => {
    if (actionPending) {
      return;
    }

    const payload = buildDecisionPayload();
    if (!payload) {
      return;
    }

    void accept.mutateAsync(payload).then(() => {
      setMessage('Request accepted.');
      navigate('/lounge/bookings');
    });
  };

  const handleCounter = () => {
    if (actionPending) {
      return;
    }

    const payload = buildDecisionPayload();
    if (!payload) {
      return;
    }

    void counter.mutateAsync(payload).then(() => setMessage('Alternative time proposed.'));
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_24%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 rounded-full border border-border/70 bg-card/75 px-4 py-3 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.5)] backdrop-blur">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="PonsLink" className="h-8 w-auto" loading="eager" />
            <p className="hidden text-xs text-muted-foreground sm:block">Request review and session prep</p>
          </div>
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/lounge/conversations" className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground">
            <MessageSquareText className="h-4 w-4" />
            Communication History
          </Link>
          <Link to="/lounge/bookings" className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/75 px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground">
            <RadioTower className="h-4 w-4" />
            Reservations
          </Link>
        </div>
        <section className="rounded-[28px] border border-border/70 bg-card/85 p-6 shadow-[0_30px_120px_-45px_rgba(15,23,42,0.45)] backdrop-blur lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                <MessageSquareText className="h-3.5 w-3.5" />
                Request detail
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight">{request.visitorName}</h1>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1">
                        <Mail className="h-4 w-4" />
                        {request.visitorEmail}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1">
                      <Clock3 className="h-4 w-4" />
                      {request.requestType} · {request.status}
                    </span>
                  </div>
                </div>
                </div>
                <div className="rounded-3xl border border-border/70 bg-background/70 p-5">
                  <p className="text-sm leading-7 text-foreground/90">{request.message}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Preferred time</p>
                    <p className="mt-3 text-sm leading-6">{request.preferredTimeNote || 'The visitor did not leave a preferred time.'}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Visitor timezone</p>
                    <p className="mt-3 text-sm leading-6">{request.visitorTimezone || 'Unknown'}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Expires at</p>
                    <p className="mt-3 text-sm leading-6">{request.expiresAt ?? 'None'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-background/85 p-5 sm:p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Decision</p>
                <h2 className="text-2xl font-semibold tracking-tight">Choose next action</h2>
                <p className="text-sm leading-6 text-muted-foreground">Set the time and room type first, then accept or propose an alternative time.</p>
              </div>

              {isBlocked ? (
                <div className="mt-5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  This visitor is blocked. You cannot create a new booking.
                </div>
              ) : null}
              <div className="mt-5 space-y-4">
                <label className="block space-y-2 text-sm">
                  <span className="text-muted-foreground">Start time</span>
                  <input aria-label="Start time" type="datetime-local" className="w-full rounded-2xl border border-border/70 bg-card px-4 py-3 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10" value={start} onChange={(e) => setStart(e.target.value)} />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="text-muted-foreground">End time</span>
                  <input aria-label="End time" type="datetime-local" className="w-full rounded-2xl border border-border/70 bg-card px-4 py-3 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10" value={end} onChange={(e) => setEnd(e.target.value)} />
                </label>
                <label className="block space-y-2 text-sm">
                  <span className="text-muted-foreground">Session type</span>
                  <select aria-label="Session type" className="w-full rounded-2xl border border-border/70 bg-card px-4 py-3 outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10" value={roomType} onChange={(e) => setRoomType(e.target.value as 'audio-one-to-one' | 'video-one-to-one')}>
                    <option value="audio-one-to-one">1:1 Audio</option>
                    <option value="video-one-to-one">1:1 Video</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 grid gap-3">
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBlocked || !canAct || actionPending}
                  onClick={handleAccept}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Accept
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 px-4 py-3 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBlocked || !canAct || actionPending}
                  onClick={handleCounter}
                >
                  <CalendarClock className="h-4 w-4" />
                  대체 시간 제안
                </button>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 px-4 py-3 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isBlocked || actionPending}
                    onClick={() => {
                      if (actionPending) {
                        return;
                      }
                      void decline.mutateAsync().then(() => setMessage('Request declined.'));
                    }}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Decline
                  </button>
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border/70 px-4 py-3 text-sm font-medium transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isBlocked || actionPending}
                    onClick={() => void blockVisitorIdentity.mutateAsync({ email: request.visitorEmail, displayName: request.visitorName }).then(() => setMessage('Visitor blocked. New requests from them will be prevented.'))}
                  >
                    <Ban className="h-4 w-4" />
                    Block visitor
                  </button>
                </div>
              </div>

              {errorMessage ? <p className="mt-5 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-700">{errorMessage}</p> : null}
              {message ? <p className="mt-5 rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}
              <div className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <RadioTower className="h-3.5 w-3.5" />
                A booking will be created with these settings when you accept or propose an alternative time.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoungeRequestDetail;
