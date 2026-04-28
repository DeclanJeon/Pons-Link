import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  MessageSquareHeart,
  X,
} from 'lucide-react';
import { useAuthSession } from './useAuthSession';
import { normalizeSlug } from './slug';
import { useCreateRequest } from './useCreateRequest';
import { ApiClientError } from './apiClient';
import { getConfiguredPersonalLinkApiUrl } from './usePersonalLinkRepository';
import type { ContactRequest, PublicProfile, RequestType } from './types';

type PublicHostProfile = PublicProfile & {
  displayName?: string;
  profileImageUrl?: string;
};

interface HostRequestComposerProps {
  hostSlug: string;
  profile?: PublicHostProfile | null;
  defaultOpen?: boolean;
  showLauncher?: boolean;
  closeable?: boolean;
  requirePreferredDate?: boolean;
  defaultRequestType?: RequestType;
  offlineNotice?: boolean;
  notice?: string;
}

const getRequestTypes = (profile?: PublicHostProfile | null): RequestType[] =>
  (['general', 'schedule', 'mentoring', 'collab'] as RequestType[]).filter((type) => {
    if (type === 'general') return profile?.allowGeneralRequest;
    if (type === 'schedule') return profile?.allowScheduleRequest;
    if (type === 'mentoring') return profile?.allowMentoringRequest;
    return profile?.allowCollabRequest;
  });

const getMeetingAccessStorageKey = (hostSlug: string) =>
  `pons-link:meeting-access:${normalizeSlug(hostSlug)}`;

export const getCanAcceptHostRequests = (profile?: PublicHostProfile | null) => {
  const requestTypes = getRequestTypes(profile);
  return {
    requestTypes,
    isPrivate: profile?.profileVisibility === 'private',
    isPaused: profile?.responsePolicy === 'paused',
    canAcceptRequests:
      profile?.profileVisibility !== 'private' && profile?.responsePolicy !== 'paused' && requestTypes.length > 0,
  };
};

export const HostRequestComposer = ({
  hostSlug,
  profile,
  defaultOpen = false,
  showLauncher = true,
  closeable = true,
  requirePreferredDate = false,
  defaultRequestType = 'general',
  offlineNotice = false,
  notice,
}: HostRequestComposerProps) => {
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const { session } = useAuthSession();
  const createRequest = useCreateRequest(apiUrl, { requireRemote: true });

  const [step, setStep] = useState<1 | 2>(1);
  const [isComposerOpen, setIsComposerOpen] = useState(defaultOpen);
  const [message, setMessage] = useState('');
  const [requestType, setRequestType] = useState<RequestType>(defaultRequestType);
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [done, setDone] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<ContactRequest | null>(null);
  const [submitError, setSubmitError] = useState('');

  const { requestTypes, isPrivate, isPaused, canAcceptRequests } = useMemo(
    () => getCanAcceptHostRequests(profile),
    [profile],
  );

  useEffect(() => {
    if (!requestTypes.includes(requestType) && requestTypes[0]) {
      setRequestType(requestTypes[0]);
    }
  }, [requestType, requestTypes]);

  const messageError = useMemo(
    () => (!message.trim()
      ? 'Message is required.'
      : message.trim().length < 10
        ? 'At least 10 characters.'
        : ''),
    [message],
  );

  const isHost = useMemo(() => {
    if (!session) {
      return false;
    }

    const ownerAliases = [normalizeSlug(session.primaryAlias ?? ''), normalizeSlug(session.uniqueNumber ?? '')];
    const normalizedHostSlug = normalizeSlug(hostSlug);

    return ownerAliases.some((alias) => alias && alias === normalizedHostSlug);
  }, [hostSlug, session]);

  const step1Valid = !messageError;
  const timingValid = !requirePreferredDate || Boolean(preferredDate);

  const visitorDisplayName = useMemo(
    () => session?.displayName?.trim() || 'PonsLink Guest',
    [session?.displayName],
  );

  const visitorEmail = useMemo(
    () => session?.email?.trim() || 'noreply@ponslink.app',
    [session?.email],
  );

  const closeComposer = () => {
    if (!closeable) return;
    setIsComposerOpen(false);
  };

  const visitorTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    [],
  );

  const preferredTimeNote = useMemo(() => {
    if (!preferredDate) return '';

    const localDateTime = `${preferredDate}T${preferredTime || '00:00'}`;
    const parsed = new Date(localDateTime);
    return Number.isNaN(parsed.getTime()) ? [preferredDate, preferredTime].filter(Boolean).join(' ') : parsed.toISOString();
  }, [preferredDate, preferredTime]);

  const submit = async () => {
    if (isHost) {
      setSubmitError('You cannot send a meeting request to your own room.');
      return;
    }

    if (!canAcceptRequests) {
      setSubmitError(
        isPrivate
          ? 'This link is private.'
          : isPaused
            ? 'Requests are paused for this link right now.'
            : 'Requests are not enabled for this link.',
      );
      return;
    }

    if (!timingValid) {
      setSubmitError('Preferred meeting date is required.');
      return;
    }

    setSubmitError('');
    try {
      const request = await createRequest.mutateAsync({
        hostSlug,
        visitorName: visitorDisplayName,
        visitorEmail,
        visitorTimezone,
        deliveryMode: 'mediated',
        requestType,
        message,
        preferredTimeNote,
      });

      setCreatedRequest(request);
      if (request.meetingAccess?.url && typeof window !== 'undefined') {
        window.localStorage.setItem(getMeetingAccessStorageKey(hostSlug), request.meetingAccess.url);
        window.location.assign(request.meetingAccess.url);
        return;
      }
      setDone(true);
    } catch (err) {
      if (err instanceof ApiClientError && typeof err.body === 'object' && err.body !== null) {
        const apiError = err.body as { error?: unknown };
        const errorMessage = typeof apiError.error === 'string' ? apiError.error : null;

        if (errorMessage) {
          if (err.status === 403) {
            setSubmitError('You cannot send a request to your own room.');
            return;
          }

          setSubmitError(errorMessage);
          return;
        }
      }

      if (err instanceof ApiClientError && err.status === 403) {
        setSubmitError('You cannot send a request to your own room.');
        return;
      }

      setSubmitError(err instanceof Error ? err.message : 'Failed to send request.');
    }
  };

  if (isHost) {
    return null;
  }

  if (!canAcceptRequests) {
    return null;
  }

  return (
    <>
      {isComposerOpen && closeable ? (
        <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm" onClick={closeComposer} aria-hidden="true" />
      ) : null}

      {showLauncher && !isComposerOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:px-0 sm:pb-0">
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

      {isComposerOpen ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-0 pb-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:px-0 sm:pb-0">
          <div className="pointer-events-auto w-full overflow-hidden rounded-t-[28px] border border-white/10 bg-[#09090d]/95 text-white shadow-[0_24px_80px_-30px_rgba(15,23,42,0.75)] backdrop-blur-xl sm:rounded-[28px]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">meeting request</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">
                  {offlineNotice ? 'Host is offline right now' : step === 1 ? 'Send message' : 'Preferred timing'}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {notice ?? (offlineNotice
                    ? `Leave a meeting request for ${profile?.displayName ?? hostSlug}. It will be sent to the host by email.`
                    : `Step ${step} of 2 · PonsLink mediates follow-up notifications.`)}
                </p>
              </div>
              {closeable ? (
                <button
                  type="button"
                  onClick={closeComposer}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition hover:border-white/20 hover:text-white"
                  aria-label="Close request composer"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="px-5 py-5">
              {done ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-200">
                    Request sent.
                  </div>
                  {createdRequest?.meetingAccess?.url ? (
                    <a
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
                      href={createdRequest.meetingAccess.url}
                    >
                      Open request status <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
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
                      <label className="block space-y-2 text-sm">
                        <span className="text-zinc-400">Message</span>
                        <textarea
                          aria-label="Message"
                          className={`min-h-32 w-full rounded-2xl border bg-white/[0.03] px-4 py-3 outline-none transition focus:ring-4 ${
                            messageError && message
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
                        {requirePreferredDate
                          ? 'Pick the meeting date you want. When you send, PonsLink forwards the request to the host email.'
                          : 'Optional. If the host accepts, PonsLink will send the next-step notification without exposing either party\'s email address.'}
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
    </>
  );
};
