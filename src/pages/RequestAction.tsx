import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { Booking, RequestActionDirectCallResult, RequestDecisionPayload } from '@/features/personal-link/types';

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

const getErrorMessage = (error: unknown) => {
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: number }).status) : null;
  if (status === 410) return 'This request link is expired or already used.';
  if (status === 404) return 'This request could not be found.';
  if (status === 409) return 'This request was already handled.';
  return 'We could not complete this request action. Please ask the sender to send a new link.';
};

const RequestAction = () => {
  const { action } = useParams<{ action: string }>();
  const location = useLocation();
  const repository = usePersonalLinkRepository({ apiUrl: getConfiguredPersonalLinkApiUrl() });
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const token = params.get('token')?.trim() ?? '';
  const defaultWindow = useMemo(() => getDefaultWindow(), []);

  const [startAt, setStartAt] = useState(defaultWindow.start);
  const [endAt, setEndAt] = useState(defaultWindow.end);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [directCall, setDirectCall] = useState<RequestActionDirectCallResult | null>(null);

  const runAccept = async () => {
    if (!token || status !== 'idle') return;
    setStatus('loading');
    setErrorMessage('');

    try {
      const result = await repository.acceptRequestByActionToken(token, buildDecisionPayload(startAt, endAt));
      setBooking(result);
      setStatus('success');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStatus('error');
    }
  };

  useEffect(() => {
    if (action === 'accept') {
      void runAccept();
    }
  }, [action, token]);

  const handlePropose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setStatus('loading');
    setErrorMessage('');

    try {
      const result = await repository.proposeTimeByActionToken(token, {
        ...buildDecisionPayload(startAt, endAt),
        message: message.trim() || undefined,
      });
      setBooking(result);
      setStatus('success');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStatus('error');
    }
  };

  const handleDirectCall = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    setStatus('loading');
    setErrorMessage('');

    try {
      const result = await repository.requestDirectCallByActionToken(token, message.trim() || undefined);
      setDirectCall(result);
      setStatus('success');
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStatus('error');
    }
  };

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

  const title = action === 'propose-time' ? 'Propose another time' : action === 'direct-call' ? 'Call request' : 'Meeting request';

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
            {status === 'loading' && <p className="text-white/70">Accepting this meeting request…</p>}
            {status === 'success' && (
              <div>
                <h2 className="text-2xl font-semibold">Meeting accepted</h2>
                <p className="mt-2 text-white/70">{booking?.roomTitle ?? 'The meeting has been confirmed.'}</p>
              </div>
            )}
            {status === 'error' && <p className="text-rose-200">{errorMessage}</p>}
          </div>
        )}

        {action === 'propose-time' && (
          <form className="mt-8 space-y-5" onSubmit={handlePropose}>
            <label className="block text-sm text-white/70">
              Start time
              <input
                aria-label="Start time"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white"
                type="datetime-local"
                value={startAt}
                onChange={(event) => {
                  setStartAt(event.target.value);
                  setEndAt(addMinutes(event.target.value, 30));
                }}
              />
            </label>
            <label className="block text-sm text-white/70">
              End time
              <input
                aria-label="End time"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white"
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
              />
            </label>
            <label className="block text-sm text-white/70">
              Message
              <textarea
                aria-label="Message"
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            <button className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black" disabled={status === 'loading'} type="submit">
              Send proposed time
            </button>
            {status === 'success' && <p className="text-emerald-200">Proposed time sent</p>}
            {status === 'error' && <p className="text-rose-200">{errorMessage}</p>}
          </form>
        )}

        {action === 'direct-call' && (
          <form className="mt-8 space-y-5" onSubmit={handleDirectCall}>
            <label className="block text-sm text-white/70">
              Message
              <textarea
                aria-label="Message"
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            <button className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black" disabled={status === 'loading'} type="submit">
              Call now
            </button>
            {status === 'success' && (
              <p className="text-emerald-200">Call request {directCall?.status === 'queued' ? 'queued' : 'sent'}</p>
            )}
            {status === 'error' && <p className="text-rose-200">{errorMessage}</p>}
          </form>
        )}
      </section>
    </main>
  );
};

export default RequestAction;
