import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Handshake,
  Mail,
  MessageSquareHeart,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { usePublicProfile } from '@/features/personal-link/usePublicProfile';
import { useCreateRequest } from '@/features/personal-link/useCreateRequest';
import { useAuthSession } from '@/features/personal-link/useAuthSession';
import { useEffect, useMemo, useState } from 'react';
import type { RequestType } from '@/features/personal-link/types';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';

const requestTypeLabels: Record<RequestType, string> = {
  general: 'General inquiry',
  schedule: 'Schedule a call',
  mentoring: 'Mentoring',
  collab: 'Collaboration',
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PublicProfile = () => {
  const { slug = '' } = useParams();
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const { session, isAuthenticated } = useAuthSession();
  const profile = usePublicProfile(slug, apiUrl, { requireRemote: true });
  const createRequest = useCreateRequest(apiUrl, { requireRemote: true });

  const [step, setStep] = useState<1 | 2>(1);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorEmail, setVisitorEmail] = useState('');
  const [message, setMessage] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('general');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const step1Errors = useMemo(
    () => ({
      visitorName: visitorName.trim() ? '' : 'Name is required.',
      visitorEmail: !visitorEmail.trim()
        ? 'Email is required.'
        : !emailRegex.test(visitorEmail)
          ? 'Invalid email format.'
          : '',
      message: !message.trim()
        ? 'Message is required.'
        : message.trim().length < 10
          ? 'At least 10 characters.'
          : '',
    }),
    [visitorName, visitorEmail, message],
  );

  const step1Valid = !step1Errors.visitorName && !step1Errors.visitorEmail && !step1Errors.message;

  useEffect(() => {
    if (session?.displayName) {
      setVisitorName((current) => current || session.displayName);
    }
    if (session?.email) {
      setVisitorEmail((current) => current || session.email);
    }
  }, [session?.displayName, session?.email]);

  if (profile.isRemoteUnavailable) {
    return (
      <div className="p-6">
        <div className="flex max-w-xl items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Public profile unavailable.</p>
            <p>This deployment does not have a remote personal-link API configured.</p>
          </div>
        </div>
      </div>
    );
  }

  if (profile.isError) {
    return (
      <div className="p-6">
        <div className="flex max-w-xl items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Public profile unavailable.</p>
            <p>We couldn&apos;t load this public profile right now. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile.isLoading && profile.data === null) {
    return <div className="p-6">Link not found.</div>;
  }

  const data = profile.data;
  const requestTypes = (['general', 'schedule', 'mentoring', 'collab'] as RequestType[]).filter(
    (type) => {
      if (type === 'general') return data?.allowGeneralRequest;
      if (type === 'schedule') return data?.allowScheduleRequest;
      if (type === 'mentoring') return data?.allowMentoringRequest;
      return data?.allowCollabRequest;
    },
  );
  const isPrivate = data?.profileVisibility === 'private';
  const isPaused = data?.responsePolicy === 'paused';
  const canAcceptRequests = !isPrivate && !isPaused && requestTypes.length > 0;

  const submit = async () => {
    if (!canAcceptRequests) {
      setSubmitError(isPrivate ? 'This link is private.' : isPaused ? 'Requests are paused for this link right now.' : 'Requests are not enabled for this link.');
      return;
    }

    setSubmitError('');
    const preferredTimeNote = [preferredDate, preferredTime].filter(Boolean).join(' ');
    const visitorTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await createRequest.mutateAsync({
        hostSlug: slug,
        visitorName,
        visitorEmail: session?.email || visitorEmail,
        visitorTimezone,
        deliveryMode: 'mediated',
        requestType,
        message,
        preferredTimeNote,
      });

      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to send request.');
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.16),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.04),_transparent_24%)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 rounded-full border border-white/10 bg-card/70 px-4 py-3 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.55)] backdrop-blur">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="PonsLink" className="h-8 w-auto" loading="eager" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">private link communication</p>
              <p className="text-xs text-zinc-400">Trusted requests, scheduling, and live sessions.</p>
            </div>
          </div>
        </div>
        <section className="overflow-hidden rounded-[32px] border border-border/70 bg-card/85 p-6 shadow-[0_30px_120px_-40px_rgba(15,23,42,0.45)] backdrop-blur lg:p-8">
          <div className="space-y-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  Personal Link
                </div>

                {isPrivate ? (
                  <div className="max-w-xl rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                    This link is private. The profile can still be reviewed, but new inbound requests are closed right now.
                  </div>
                ) : isPaused ? (
                  <div className="max-w-xl rounded-2xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-3 text-sm leading-6 text-indigo-100">
                    Requests are paused for this link right now. Check back later or wait for the host to reopen availability.
                  </div>
                ) : null}

                <div className="flex items-start gap-4">
                  {data?.profileImageUrl ? (
                    <img
                      src={data.profileImageUrl}
                      alt="profile"
                      className="h-20 w-20 rounded-[24px] object-cover ring-1 ring-border/60"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-primary/10 text-primary ring-1 ring-primary/20">
                      <UserRound className="h-8 w-8" />
                    </div>
                  )}
                  <div className="space-y-3">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      {data?.displayName ?? 'Profile'}
                    </h1>
                    <p className="text-base leading-7 text-foreground/90">{data?.headline}</p>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{data?.bio}</p>
                  </div>
                </div>
              </div>

              {canAcceptRequests ? (
                <div className="max-w-sm rounded-[28px] border border-indigo-500/20 bg-[#0f1020]/80 p-5 text-white shadow-[0_20px_80px_-35px_rgba(79,70,229,0.7)]">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-indigo-300/80">quick contact</p>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight">Start a request with one message</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Open the request composer from the bottom-right corner. PonsLink mediates follow-up updates so neither side has to expose a direct email address.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(true)}
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
                  >
                    <MessageSquareHeart className="h-4 w-4" />
                    Open composer
                  </button>
                </div>
              ) : (
                <div className="max-w-sm rounded-[28px] border border-white/10 bg-[#0f1020]/65 p-5 text-white shadow-[0_20px_80px_-35px_rgba(15,23,42,0.55)]">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-zinc-500">request status</p>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight">Inbound requests are unavailable</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {isPrivate
                      ? 'The host has closed this link to new outreach.'
                      : isPaused
                        ? 'The host is temporarily pausing new requests while keeping the profile visible.'
                        : 'No request lanes are currently enabled for this profile.'}
                  </p>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: MessageSquareHeart,
                  title: 'Start with context',
                  body: 'Open the composer and leave a direct message instead of navigating a long form.',
                },
                {
                  icon: CalendarClock,
                  title: 'Optional timing',
                  body: 'Add your preferred date and time only when you want to suggest a slot.',
                },
                {
                  icon: Handshake,
                  title: 'Email-first follow-up',
                  body: 'Accepted requests continue by email with calendar registration and a direct call link.',
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-medium">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {isComposerOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsComposerOpen(false)} aria-hidden="true" />
      ) : null}

      {canAcceptRequests ? (
        <div className={`fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:px-0 sm:pb-0 ${isComposerOpen ? 'pointer-events-none' : ''}`}>
          <button
            type="button"
            onClick={() => setIsComposerOpen(true)}
            className="pointer-events-auto inline-flex min-h-14 w-full items-center gap-3 rounded-[24px] border border-indigo-500/20 bg-[#09090d]/95 px-5 py-3 text-left text-white shadow-[0_24px_80px_-30px_rgba(15,23,42,0.75)] transition hover:border-indigo-400/40 hover:bg-[#12131c] sm:rounded-full"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500 text-white shadow-[0_0_25px_rgba(99,102,241,0.45)]">
              <MessageSquareHeart className="h-5 w-5" />
            </span>
            <span className="flex flex-col items-start">
              <span className="text-sm font-semibold">Send message</span>
              <span className="text-xs text-zinc-400">Compose a request with mediated follow-up</span>
            </span>
          </button>
        </div>
      ) : null}

      {isComposerOpen && canAcceptRequests ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-0 pb-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:px-0 sm:pb-0">
            <div className="pointer-events-auto w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-[#09090d]/95 text-white shadow-[0_24px_80px_-30px_rgba(15,23,42,0.75)] backdrop-blur-xl sm:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">request</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  {step === 1 ? 'Send message' : 'Preferred timing'}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">Step {step} of 2 · PonsLink mediates follow-up notifications.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition hover:border-white/20 hover:text-white"
                aria-label="Close request composer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5">
              {done ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-200">
                    Request sent. The host will review it in the lounge and PonsLink will handle follow-up notifications.
                  </div>
                </div>
              ) : (
                <>
                  {submitError ? (
                    <div className="mb-4 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-4">
                      {!isAuthenticated ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300">
                          You are sending this request as Anonymous. PonsLink will mediate follow-up notifications without exposing email addresses.
                        </div>
                      ) : null}
                      <label className="block space-y-2 text-sm">
                        <span className="text-zinc-400">Name</span>
                        <input
                          className={`w-full rounded-2xl border bg-white/[0.03] px-4 py-3 outline-none transition focus:ring-4 ${
                            step1Errors.visitorName && visitorName
                              ? 'border-destructive/50 focus:ring-destructive/10'
                              : 'border-white/10 focus:border-indigo-400/40 focus:ring-indigo-500/10'
                          }`}
                          value={visitorName}
                          onChange={(e) => setVisitorName(e.target.value)}
                          placeholder="How should they address you?"
                        />
                      </label>
                      <label className="block space-y-2 text-sm">
                        <span className="text-zinc-400">Email</span>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                          <input
                            className={`w-full rounded-2xl border bg-white/[0.03] py-3 pl-11 pr-4 outline-none transition focus:ring-4 ${
                              step1Errors.visitorEmail && visitorEmail
                                ? 'border-destructive/50 focus:ring-destructive/10'
                                : 'border-white/10 focus:border-indigo-400/40 focus:ring-indigo-500/10'
                            }`}
                            value={visitorEmail}
                            onChange={(e) => setVisitorEmail(e.target.value)}
                            placeholder="Where should PonsLink send updates?"
                          />
                        </div>
                      </label>
                      <label className="block space-y-2 text-sm">
                        <span className="text-zinc-400">Message</span>
                        <textarea
                          className={`min-h-32 w-full rounded-2xl border bg-white/[0.03] px-4 py-3 outline-none transition focus:ring-4 ${
                            step1Errors.message && message
                              ? 'border-destructive/50 focus:ring-destructive/10'
                              : 'border-white/10 focus:border-indigo-400/40 focus:ring-indigo-500/10'
                          }`}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="What do you want to discuss, and why now?"
                        />
                      </label>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.05]"
                        onClick={() => setShowAdvancedOptions((prev) => !prev)}
                      >
                        {showAdvancedOptions ? 'Hide request type' : 'Choose request type'}
                      </button>
                      {showAdvancedOptions ? (
                        <label className="block space-y-2 text-sm">
                          <span className="text-zinc-400">Request type</span>
                          <select
                            className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 outline-none transition focus:border-indigo-400/40 focus:ring-4 focus:ring-indigo-500/10"
                            value={requestType}
                            onChange={(e) => setRequestType(e.target.value as RequestType)}
                          >
                            {requestTypes.map((type) => (
                              <option key={type} value={type}>
                                {requestTypeLabels[type]}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-indigo-500 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!step1Valid}
                        onClick={() => setStep(2)}
                      >
                        Add timing details <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.08] px-4 py-3 text-xs leading-5 text-indigo-100">
                        Optional. If the host accepts, PonsLink will send the next-step notification without exposing either party&apos;s email address.
                      </div>
                      <label className="block space-y-2 text-sm">
                        <span className="text-zinc-400">Preferred date</span>
                        <input
                          type="date"
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 outline-none transition focus:border-indigo-400/40 focus:ring-4 focus:ring-indigo-500/10"
                          value={preferredDate}
                          onChange={(e) => setPreferredDate(e.target.value)}
                        />
                      </label>
                      <label className="block space-y-2 text-sm">
                        <span className="text-zinc-400">Preferred time</span>
                        <input
                          type="time"
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 outline-none transition focus:border-indigo-400/40 focus:ring-4 focus:ring-indigo-500/10"
                          value={preferredTime}
                          onChange={(e) => setPreferredTime(e.target.value)}
                        />
                      </label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          className="flex cursor-pointer items-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/[0.05]"
                          onClick={() => setStep(1)}
                        >
                          <ArrowLeft className="h-4 w-4" /> Back
                        </button>
                        <button
                          type="button"
                          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={createRequest.isPending}
                          onClick={() => void submit()}
                        >
                          {createRequest.isPending ? 'Sending...' : 'Send request'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        ) : null}
    </div>
  );
};

export default PublicProfile;
