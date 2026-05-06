import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { SessionAccessResult, SessionReservation } from '@/features/personal-link/types';

const buildRoomTypedJoinPath = (reservation: SessionReservation): string => {
  const roomType = reservation.roomType?.trim();
  if (!roomType) {
    return reservation.joinPath;
  }

  try {
    const parsed = new URL(reservation.joinPath, 'https://pons.invalid');
    if (!parsed.searchParams.has('type')) {
      parsed.searchParams.set('type', roomType);
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    if (/(^|[?&])type=/.test(reservation.joinPath)) {
      return reservation.joinPath;
    }
    const separator = reservation.joinPath.includes('?') ? '&' : '?';
    return `${reservation.joinPath}${separator}type=${encodeURIComponent(roomType)}`;
  }
};

const SessionAccess = () => {
  const { reservationId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('token') ?? undefined;
  const apiUrl = getConfiguredPersonalLinkApiUrl();
  const repositorySelection = apiUrl ? { apiUrl } : undefined;
  const repository = usePersonalLinkRepository(repositorySelection);
  const [result, setResult] = useState<SessionAccessResult | null>(null);

  useEffect(() => {
    void repository.getSessionAccess(reservationId, accessToken).then(setResult);
  }, [accessToken, repository, reservationId]);

  const renderState = (
    title: string,
    body: string,
    detail?: ReactNode,
    action?: { to: string; label: string },
  ) => (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-6 py-16 text-foreground">
      <section className="w-full max-w-xl rounded-2xl border border-border/70 bg-white p-8 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.45)]">
        <p className="text-sm uppercase tracking-[0.28em] text-[#1E63FF]">PonsLink session access</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p>
        {detail ? <div className="mt-5 rounded-2xl border border-border/70 bg-[#F8FAFC] px-4 py-3 text-sm text-muted-foreground">{detail}</div> : null}
        {action ? (
          <Link className="mt-6 inline-flex rounded-full bg-[#1E63FF] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#174fd1]" to={action.to}>
            {action.label}
          </Link>
        ) : null}
      </section>
    </main>
  );

  if (!result) return renderState('Checking session access', 'We are verifying the guest link before opening the room.');
  if (result.state === 'allowed' && result.reservation) return <Navigate to={buildRoomTypedJoinPath(result.reservation)} replace />;
  if (result.state === 'email_mismatch') {
    return renderState(
      'Email mismatch',
      'Please reconnect using the latest guest link from the notification email.',
      <>
        <p>Booking email: {result.reservation?.guestEmail ?? 'unavailable'}</p>
        <p className="mt-2 text-xs">Ask the host to resend the latest notification email if needed.</p>
      </>,
      { to: '/', label: 'Go to home' },
    );
  }
  if (result.state === 'unauthenticated') {
    return renderState(
      'Access token required',
      'Please reconnect using the session link from the notification email.',
      'If the link is expired or the token is missing, ask the host for a new one.',
    );
  }
  if (result.state === 'waiting') {
    return renderState(
      'Not time to join yet',
      'Please reconnect at the scheduled time.',
      'Double-check the schedule in the notification email and your calendar.',
    );
  }
  if (result.state === 'expired') {
    return renderState(
      'Join window has expired',
      'Rescheduling is needed.',
      'You can reconnect with the latest link once the host provides a new time.',
      { to: '/login', label: 'Back to login' },
    );
  }
  return renderState(
    'Session not found',
    'Please reconnect using the latest link from the notification email.',
    'If the token is missing or the link has expired, ask the host for a new one.',
  );
};

export default SessionAccess;
