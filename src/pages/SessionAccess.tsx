import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { getConfiguredPersonalLinkApiUrl, usePersonalLinkRepository } from '@/features/personal-link/usePersonalLinkRepository';
import type { SessionAccessResult } from '@/features/personal-link/types';

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

  if (!result) return <div className="p-6">Checking session access...</div>;
  if (result.state === 'allowed' && result.reservation) return <Navigate to={result.reservation.joinPath} replace />;
  if (result.state === 'email_mismatch') {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-bold">Email mismatch</h1>
        <p>Please reconnect using the latest guest link from the notification email.</p>
        <p className="text-sm text-muted-foreground">Booking email: {result.reservation?.guestEmail ?? 'unavailable'}</p>
        <div className="flex flex-col gap-2">
          <Link className="rounded border px-3 py-2 text-center" to="/">Go to home</Link>
          <p className="text-xs text-muted-foreground">Ask the host to resend the latest notification email if needed.</p>
        </div>
      </div>
    );
  }
  if (result.state === 'unauthenticated') {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold">Access token required</h1>
        <p>Please reconnect using the session link from the notification email.</p>
        <p className="text-sm text-muted-foreground">If the link is expired or the token is missing, ask the host for a new one.</p>
      </div>
    );
  }
  if (result.state === 'waiting') {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold">Not time to join yet</h1>
        <p>Please reconnect at the scheduled time.</p>
        <p className="text-sm text-muted-foreground">Double-check the schedule in the notification email and your calendar.</p>
      </div>
    );
  }
  if (result.state === 'expired') {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-6">
        <h1 className="text-2xl font-bold">Join window has expired</h1>
        <p>Rescheduling is needed.</p>
        <p className="text-sm text-muted-foreground">You can reconnect with the latest link once the host provides a new time.</p>
        <Link className="rounded border px-3 py-2 text-center" to="/login">Back to login</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-3 p-6">
      <h1 className="text-2xl font-bold">Session not found</h1>
      <p>Please reconnect using the latest link from the notification email.</p>
      <p className="text-sm text-muted-foreground">If the token is missing or the link has expired, ask the host for a new one.</p>
    </div>
  );
};

export default SessionAccess;
