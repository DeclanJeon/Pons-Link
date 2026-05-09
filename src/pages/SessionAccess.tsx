import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        <p className="text-sm uppercase tracking-[0.28em] text-[#1E63FF]">{t('sessionAccess.eyebrow')}</p>
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

  if (!result) return renderState(t('sessionAccess.checking'), t('sessionAccess.checkingBody'));
  if (result.state === 'allowed' && result.reservation) return <Navigate to={buildRoomTypedJoinPath(result.reservation)} replace />;
  if (result.state === 'email_mismatch') {
    return renderState(
      t('sessionAccess.emailMismatch'),
      t('sessionAccess.emailMismatchBody'),
      <>
        <p>{t('sessionAccess.bookingEmail')}: {result.reservation?.guestEmail ?? t('common.unavailable')}</p>
        <p className="mt-2 text-xs">{t('sessionAccess.resendHelp')}</p>
      </>,
      { to: '/', label: t('sessionAccess.goHome') },
    );
  }
  if (result.state === 'unauthenticated') {
    return renderState(
      t('sessionAccess.tokenRequired'),
      t('sessionAccess.tokenRequiredBody'),
      t('sessionAccess.tokenRequiredDetail'),
    );
  }
  if (result.state === 'waiting') {
    return renderState(
      t('sessionAccess.waiting'),
      t('sessionAccess.waitingBody'),
      t('sessionAccess.waitingDetail'),
    );
  }
  if (result.state === 'expired') {
    return renderState(
      t('sessionAccess.expired'),
      t('sessionAccess.expiredBody'),
      t('sessionAccess.expiredDetail'),
      { to: '/login', label: t('sessionAccess.backLogin') },
    );
  }
  return renderState(
    t('sessionAccess.notFound'),
    t('sessionAccess.notFoundBody'),
    t('sessionAccess.notFoundDetail'),
  );
};

export default SessionAccess;
