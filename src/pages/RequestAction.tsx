import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiClientError } from '@/features/personal-link/apiClient';
import { getConfiguredPersonalLinkApiUrl } from '@/features/personal-link/usePersonalLinkRepository';
import { useRequestAction } from '@/features/personal-link/useRequestAction';
import type { Booking, RequestDecisionPayload } from '@/features/personal-link/types';

const toLocalDateTimeValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const addMinutes = (value: string, minutes: number) => {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return toLocalDateTimeValue(date);
};

const getDefaultWindow = () => {
  const start = new Date();
  start.setMinutes(start.getMinutes() + 30);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);

  return {
    start: toLocalDateTimeValue(start),
    end: toLocalDateTimeValue(end),
  };
};

const getTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const buildDecisionPayload = (start: string, end: string): RequestDecisionPayload => ({
  proposedStartAt: start,
  proposedEndAt: end,
  roomType: 'video-one-to-one',
  timezone: getTimezone(),
});

const parseDate = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isRetryableStatus = (status: number | null) => status === null || status === 408 || status === 429 || status >= 500;

const getServerErrorMessage = (error: ApiClientError) => {
  if (typeof error.body !== 'object' || error.body === null || !('error' in error.body)) {
    return null;
  }

  const value = (error.body as { error?: unknown }).error;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getErrorState = (error: unknown) => {
  if (error instanceof ApiClientError) {
    if (error.status === 410) {
      return { message: 'This request link has expired or was already used.', retryable: false };
    }

    if (error.status === 404) {
      return { message: 'This request could not be found.', retryable: false };
    }

    if (error.status === 409) {
      return { message: 'This request was already handled.', retryable: false };
    }

    if (error.status === 400) {
      return {
        message: 'This request action is no longer valid. Please open the latest link from the sender.',
        retryable: false,
      };
    }

    return {
      message: getServerErrorMessage(error) ?? 'We could not complete this request action. Please try again.',
      retryable: isRetryableStatus(error.status),
    };
  }

  if (error instanceof Error && error.message.trim()) {
    return { message: error.message.trim(), retryable: true };
  }

  return {
    message: 'We could not complete this request action. Please try again.',
    retryable: true,
  };
};

const formatBookingWindow = (booking: Booking | undefined) => {
  if (!booking) {
    return 'The meeting has been confirmed.';
  }

  const start = parseDate(booking.scheduledStartAt);
  const end = parseDate(booking.scheduledEndAt);
  if (!start || !end) {
    return 'The meeting has been confirmed.';
  }

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    timeStyle: 'short',
  });

  return `Scheduled for ${dateFormatter.format(start)}, ${timeFormatter.format(start)} to ${timeFormatter.format(end)} (${booking.timezone}).`;
};

const RequestAction = () => {
  const { action } = useParams<{ action: string }>();
  const location = useLocation();
  const didRunAccept = useRef(false);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const token = params.get('token')?.trim() ?? '';
  const defaultWindow = useMemo(() => getDefaultWindow(), []);
  const { accept, proposeTime, directCall, decline } = useRequestAction({ apiUrl: getConfiguredPersonalLinkApiUrl() });
  const acceptMutationRef = useRef(accept);
  const proposeMutationRef = useRef(proposeTime);
  const directCallMutationRef = useRef(directCall);
  const declineMutationRef = useRef(decline);

  const [startAt, setStartAt] = useState(defaultWindow.start);
  const [endAt, setEndAt] = useState(defaultWindow.end);
  const [message, setMessage] = useState('');
  const [validationError, setValidationError] = useState('');

  const isValidAction = action === 'accept' || action === 'propose-time' || action === 'direct-call' || action === 'decline';
  const activeMutation = action === 'accept' ? accept : action === 'propose-time' ? proposeTime : action === 'direct-call' ? directCall : decline;
  const activeError = validationError || (activeMutation.error ? getErrorState(activeMutation.error).message : '');
  const canRetryAccept = action === 'accept' && accept.isError && !validationError && getErrorState(accept.error).retryable;
  const acceptSummary = formatBookingWindow(accept.data);
  const proposeSummary = formatBookingWindow(proposeTime.data);

  const buildDecisionPayloadFromForm = (): RequestDecisionPayload | null => {
    const start = parseDate(startAt);
    const end = parseDate(endAt);

    if (!start || !end) {
      setValidationError('Enter a valid start and end time.');
      return null;
    }

    if (start.getTime() >= end.getTime()) {
      setValidationError('End time must be after the start time.');
      return null;
    }

    return buildDecisionPayload(startAt, endAt);
  };

  const runAccept = (forced = false) => {
    if (!action || !isValidAction || didRunAccept.current) {
      return;
    }

    if (!forced && accept.status !== 'idle') {
      return;
    }

    if (!token) return;
    didRunAccept.current = true;
    setValidationError('');
    accept.mutate(
      { token },
      {
        onError: () => {
          didRunAccept.current = false;
        },
      },
    );
  };

  const retryAccept = () => {
    if (!token) return;
    didRunAccept.current = false;
    setValidationError('');
    accept.reset();
    runAccept(true);
  };

  const handlePropose = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (proposeTime.isPending) return;
    if (!token) return;
    setValidationError('');
    proposeTime.reset();

    const decisionPayload = buildDecisionPayloadFromForm();
    if (!decisionPayload) {
      return;
    }

    proposeTime.mutate({
      token,
      payload: {
        ...decisionPayload,
        message: message.trim() || undefined,
      },
    });
  };

  const handleDirectCall = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (directCall.isPending) return;
    if (!token) return;
    setValidationError('');
    directCall.reset();
    directCall.mutate({ token, message: message.trim() || undefined });
  };

  const handleDecline = () => {
    if (decline.isPending) return;
    if (!token) return;
    setValidationError('');
    decline.reset();
    decline.mutate({ token });
  };

  useEffect(() => {
    acceptMutationRef.current = accept;
    proposeMutationRef.current = proposeTime;
    directCallMutationRef.current = directCall;
    declineMutationRef.current = decline;
  }, [accept, proposeTime, directCall, decline]);

  useEffect(() => {
    acceptMutationRef.current?.reset?.();
    proposeMutationRef.current?.reset?.();
    directCallMutationRef.current?.reset?.();
    declineMutationRef.current?.reset?.();
    didRunAccept.current = false;
    setValidationError('');
    setMessage('');
    setStartAt(defaultWindow.start);
    setEndAt(defaultWindow.end);
  }, [action, token, defaultWindow.end, defaultWindow.start]);

  useEffect(() => {
    if (action !== 'accept' || !token || !isValidAction || accept.status !== 'idle') {
      didRunAccept.current = false;
      return;
    }

    if (didRunAccept.current) {
      return;
    }

    didRunAccept.current = true;
    setValidationError('');
    acceptMutationRef.current.mutate(
      { token },
      {
        onError: () => {
          didRunAccept.current = false;
        },
      },
    );
  }, [action, token, accept.status, isValidAction, endAt, startAt]);

  useEffect(() => {
    if (action !== 'accept' || !accept.isSuccess || !accept.data?.joinUrl || typeof window === 'undefined') {
      return;
    }

    window.location.assign(accept.data.joinUrl);
  }, [action, accept.isSuccess, accept.data?.joinUrl]);

  if (!token) {
    return (
      <main className="min-h-screen bg-[#07070a] px-6 py-16 text-white">
        <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.4em] text-amber-200/70">PonsLink request action</p>
          <h1 className="mt-4 text-3xl font-semibold">Action link unavailable</h1>
          <p className="mt-4 text-white/70">This request link is missing its action token.</p>
          <Link className="mt-8 inline-flex rounded-full border border-white/15 px-5 py-3 text-sm text-white/80" to="/">
            Back to PonsLink
          </Link>
        </section>
      </main>
    );
  }

  if (!isValidAction) {
    return (
      <main className="min-h-screen bg-[#07070a] px-6 py-16 text-white">
        <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.4em] text-amber-200/70">PonsLink request action</p>
          <h1 className="mt-4 text-3xl font-semibold">Invalid action</h1>
          <p className="mt-4 text-white/70">This action link is not supported.</p>
          <Link className="mt-8 inline-flex rounded-full border border-white/15 px-5 py-3 text-sm text-white/80" to="/">
            Back to PonsLink
          </Link>
        </section>
      </main>
    );
  }

  const title = action === 'propose-time' ? 'Propose another time' : action === 'direct-call' ? 'Call request' : action === 'decline' ? 'Decline request' : 'Meeting request';

  return (
    <main className="min-h-screen bg-[#07070a] px-6 py-16 text-white">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-[0.4em] text-cyan-200/70">PonsLink request action</p>
        <h1 className="mt-4 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">
          This public email action only uses the one-time token in your link. You do not need to log in, and PonsLink keeps the recipient identity private.
        </p>

        {action === 'accept' && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-black/25 p-5">
            {accept.isPending && <p aria-live="polite" className="text-white/70" role="status">Accepting this meeting request...</p>}
            {accept.isSuccess && (
              <div>
                <h2 className="text-2xl font-semibold">Meeting accepted</h2>
                <p className="mt-2 text-white/70">{acceptSummary}</p>
              </div>
            )}
            {activeError && <p className="text-rose-200" role="alert">{activeError}</p>}
            {canRetryAccept && (
              <button
                className="mt-4 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={accept.isPending}
                onClick={retryAccept}
                type="button"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {action === 'propose-time' && (
          <form className="mt-8 space-y-5" onSubmit={handlePropose}>
            <label className="block text-sm text-white/70">
              Start time
              <input
                aria-label="Start time"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
                type="datetime-local"
                value={startAt}
                disabled={proposeTime.isPending}
                onChange={(event) => {
                  setValidationError('');
                  setStartAt(event.target.value);
                  setEndAt(addMinutes(event.target.value, 30));
                }}
              />
            </label>
            <label className="block text-sm text-white/70">
              End time
              <input
                aria-label="End time"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
                type="datetime-local"
                value={endAt}
                disabled={proposeTime.isPending}
                min={startAt}
                onChange={(event) => {
                  setValidationError('');
                  setEndAt(event.target.value);
                }}
              />
            </label>
            <label className="block text-sm text-white/70">
              Message
              <textarea
                aria-label="Message"
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
                value={message}
                disabled={proposeTime.isPending}
                onChange={(event) => {
                  setValidationError('');
                  setMessage(event.target.value);
                }}
              />
            </label>
            <button
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black"
              disabled={proposeTime.isPending || proposeTime.isSuccess}
              type="submit"
            >
              {proposeTime.isPending ? 'Sending...' : 'Send proposed time'}
            </button>
            {proposeTime.isSuccess && (
              <p aria-live="polite" className="text-emerald-200" role="status">
                Proposed time sent. {proposeSummary}
              </p>
            )}
            {activeError && <p className="text-rose-200" role="alert">{activeError}</p>}
          </form>
        )}

        {action === 'direct-call' && (
          <form className="mt-8 space-y-5" onSubmit={handleDirectCall}>
            <label className="block text-sm text-white/70">
              Message
              <textarea
                aria-label="Message"
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
                value={message}
                disabled={directCall.isPending}
                onChange={(event) => {
                  setValidationError('');
                  setMessage(event.target.value);
                }}
              />
            </label>
            <button
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black"
              disabled={directCall.isPending || directCall.isSuccess}
              type="submit"
            >
              {directCall.isPending ? 'Sending...' : 'Request live call'}
            </button>
            {directCall.isSuccess && (
              <div aria-live="polite" className="space-y-2 text-emerald-200" role="status">
                <p>Call request {directCall.data?.status === 'queued' ? 'queued' : 'sent'}.</p>
                {directCall.data?.loungeUrl && (
                  <a
                    className="inline-flex rounded-full border border-emerald-200/30 px-4 py-2 text-sm font-semibold text-emerald-100"
                    href={directCall.data.loungeUrl}
                  >
                    View request status
                  </a>
                )}
              </div>
            )}
            {activeError && <p className="text-rose-200" role="alert">{activeError}</p>}
          </form>
        )}

        {action === 'decline' && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-black/25 p-5">
            <p className="text-sm leading-6 text-white/70">
              Declining this request will notify the visitor status page and close this one-time action link.
            </p>
            <button
              className="mt-5 rounded-full bg-rose-200 px-5 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
              disabled={decline.isPending || decline.isSuccess}
              onClick={handleDecline}
              type="button"
            >
              {decline.isPending ? 'Declining...' : 'Decline request'}
            </button>
            {decline.isSuccess && (
              <div aria-live="polite" className="mt-4 space-y-2 text-emerald-200" role="status">
                <h2 className="text-2xl font-semibold">Request declined</h2>
                <p>The visitor status page will show that this request was declined.</p>
              </div>
            )}
            {activeError && <p className="mt-4 text-rose-200" role="alert">{activeError}</p>}
          </div>
        )}
      </section>
    </main>
  );
};

export default RequestAction;
